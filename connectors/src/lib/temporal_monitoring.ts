import { isNangoError } from "@dust-tt/types";
import type { Context } from "@temporalio/activity";
import type {
  ActivityExecuteInput,
  ActivityInboundCallsInterceptor,
  Next,
} from "@temporalio/worker";
import tracer from "dd-trace";

import type { Logger } from "@connectors/logger/logger";
import type logger from "@connectors/logger/logger";
import { statsDClient } from "@connectors/logger/withlogging";

import { DustConnectorWorkflowError, ExternalOauthTokenError } from "./error";
import { syncFailed } from "./sync_status";
import { cancelWorkflow, getConnectorId } from "./temporal";

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
    let error: Error | any = undefined;
    const startTime = new Date();
    const tags = [
      `activity_name:${this.context.info.activityType}`,
      `workflow_name:${this.context.info.workflowType}`,
      // `activity_id:${this.context.info.activityId}`,
      // `workflow_id:${this.context.info.workflowExecution.workflowId}`,
      // `workflow_run_id:${this.context.info.workflowExecution.runId}`,
      `attempt:${this.context.info.attempt}`,
    ];

    // startToClose timeouts do not log an error by default; this code
    // ensures that the error is logged and the activity is marked as
    // failed.
    const startToCloseTimer = setTimeout(() => {
      const error = new DustConnectorWorkflowError(
        "Activity execution exceeded startToClose timeout (note: the activity might still be running)",
        "workflow_timeout_failure"
      );

      this.logger.error(
        {
          error,
          dustError: error,
          durationMs: this.context.info.startToCloseTimeoutMs,
          attempt: this.context.info.attempt,
        },
        "Activity failed"
      );
    }, this.context.info.startToCloseTimeoutMs);

    // We already trigger a monitor after 20 failures, but when the pod crashes (eg: OOM or segfault), the attempt never gets logged.
    // By looking at the attempt count before the activity starts, we can detect activities that are repeatedly crashing the pod.
    if (this.context.info.attempt > 25) {
      this.logger.error(
        {
          activity_name: this.context.info.activityType,
          workflow_name: this.context.info.workflowType,
          attempt: this.context.info.attempt,
        },
        "Activity has been attempted more than 25 times. Make sure it's not crashing the pod."
      );
    }
    try {
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

      if (
        isNangoError(err) &&
        [520, 522, 502, 500].includes(err.status) &&
        err.config?.url?.includes("api.nango.dev")
      ) {
        this.logger.info(
          {
            raw_json_error: JSON.stringify(err, null, 2),
          },
          "Got 5xx Bad Response from external API"
        );

        error = new DustConnectorWorkflowError(
          `Got ${err.status} Bad Response from Nango`,
          "transient_nango_activity_error",
          err
        );
      }

      if (err instanceof ExternalOauthTokenError) {
        // We have a connector working on an expired token, we need to cancel the workflow.
        const { workflowId } = this.context.info.workflowExecution;

        const connectorId = await getConnectorId(workflowId);
        if (connectorId) {
          await syncFailed(connectorId, "oauth_token_revoked");

          // In case of an invalid token, abort the workflow.
          this.logger.info("Cancelling workflow because of expired token.");
          await cancelWorkflow(workflowId);
        }
      }

      throw err;
    } finally {
      clearTimeout(startToCloseTimer);
      const durationMs = new Date().getTime() - startTime.getTime();
      if (error) {
        let errorType = "unhandled_internal_activity_error";
        if (
          error instanceof DustConnectorWorkflowError ||
          // temporary swallow during fix
          // TODO(pr, 2024-06-18) remove the temporary swallow
          error.message.includes("Error uploading structured data to Dust")
        ) {
          // This is a Dust error.
          errorType = error.type;
          this.logger.error(
            {
              error,
              dustError: error,
              durationMs,
              attempt: this.context.info.attempt,
            },
            "Activity failed"
          );
        } else {
          // Unknown error type.
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
        statsDClient.increment("activities_success.count", 1, tags);
      }
    }
  }
}
