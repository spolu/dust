import { Context } from "@temporalio/activity";
import {
  ActivityExecuteInput,
  ActivityInboundCallsInterceptor,
  Next,
} from "@temporalio/worker";
import tracer from "dd-trace";

import logger, { Logger } from "@connectors/logger/logger";
import { statsDClient } from "@connectors/logger/withlogging";

import { ExternalOauthTokenError } from "./error";
import { syncFailed } from "./sync_status";
import {
  cancelWorkflow,
  getConnectorId,
  getDoNotCancelOnTokenRevoked,
} from "./temporal";

/** An Activity Context with an attached logger */
export interface ContextWithLogger extends Context {
  logger: typeof logger;
}

export class ActivityInboundLogInterceptor
  implements ActivityInboundCallsInterceptor
{
  public readonly logger: Logger;
  private readonly context: Context;

  constructor(ctx: Context, logger: Logger) {
    this.context = ctx;
    this.logger = logger.child({
      activityName: ctx.info.activityType,
      workflowName: ctx.info.workflowType,
      workflowId: ctx.info.workflowExecution.workflowId,
      workflowRunId: ctx.info.workflowExecution.runId,
      activityId: ctx.info.activityId,
    });

    // Set a logger instance on the current Activity Context to provide
    // contextual logging information to each log entry generated by the Activity.
    (ctx as ContextWithLogger).logger = this.logger;
  }

  async execute(
    input: ActivityExecuteInput,
    next: Next<ActivityInboundCallsInterceptor, "execute">
  ): Promise<unknown> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let error: any = undefined;
    const startTime = new Date();
    const tags = [
      `activity_name:${this.context.info.activityType}`,
      `workflow_name:${this.context.info.workflowType}`,
      // `activity_id:${this.context.info.activityId}`,
      // `workflow_id:${this.context.info.workflowExecution.workflowId}`,
      // `workflow_run_id:${this.context.info.workflowExecution.runId}`,
      `attempt:${this.context.info.attempt}`,
    ];

    try {
      this.logger.info("Activity started.");
      return await tracer.trace(
        `${this.context.info.workflowType}-${this.context.info.activityType}`,
        {
          resource: this.context.info.activityType,
          type: "temporal-activity",
        },
        async (span) => {
          span?.setTag("attempt", this.context.info.attempt);
          span?.setTag(
            "workflow_id",
            this.context.info.workflowExecution.workflowId
          );
          span?.setTag(
            "workflow_run_id",
            this.context.info.workflowExecution.runId
          );

          return next(input);
        }
      );

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: unknown) {
      error = err;

      const maybeNangoError = err as {
        code?: string;
        status?: number;
        config?: { url?: string };
      };
      if (
        maybeNangoError.code === "ERR_BAD_RESPONSE" &&
        maybeNangoError.status &&
        [520, 522, 502, 500].includes(maybeNangoError.status) &&
        maybeNangoError.config?.url?.includes("api.nango.dev")
      ) {
        this.logger.info(
          {
            raw_json_error: JSON.stringify(maybeNangoError, null, 2),
          },
          "Got 5xx Bad Response from external API"
        );
        error = {
          __is_dust_error: true,
          message: `Got ${maybeNangoError.status} Bad Response from Nango`,
          type: "nango_5xx_bad_response",
        };
      }

      if (err instanceof ExternalOauthTokenError) {
        // We have a connector working on an expired token, we need to cancel the workflow.
        const workflowId = this.context.info.workflowExecution.workflowId;

        const connectorId = await getConnectorId(workflowId);
        if (connectorId) {
          await syncFailed(connectorId, "oauth_token_revoked");

          const doNotCancelOnTokenRevoked = await getDoNotCancelOnTokenRevoked(
            workflowId
          );
          if (doNotCancelOnTokenRevoked) {
            this.logger.info(
              "Skipping cancelling workflow because of expired token."
            );
          } else {
            // We cancel the workflow only if it's not a long running workflow
            this.logger.info("Cancelling workflow because of expired token.");
            await cancelWorkflow(workflowId);
          }
        }
      }
      throw err;
    } finally {
      const durationMs = new Date().getTime() - startTime.getTime();
      if (error) {
        let errorType = "unhandled_internal_activity_error";
        if (error.__is_dust_error !== undefined) {
          // this is a dust error
          errorType = error.type;
          this.logger.error(
            { error, durationMs, attempt: this.context.info.attempt },
            "Activity failed"
          );
        } else {
          // unknown error type
          this.logger.error(
            {
              error,
              error_stack: error?.stack,
              durationMs: durationMs,
              attempt: this.context.info.attempt,
            },
            "Unhandled activity error"
          );
        }

        tags.push(`error_type:${errorType}`);
        statsDClient.increment("activity_failed.count", 1, tags);
      } else {
        this.logger.info({ durationMs: durationMs }, "Activity completed.");
        statsDClient.increment("activities_success.count", 1, tags);
        // statsDClient.distribution(
        //   "activities.duration.distribution",
        //   durationMs,
        //   tags
        // );
      }
    }
  }
}
