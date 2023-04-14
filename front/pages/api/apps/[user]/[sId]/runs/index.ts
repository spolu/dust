import { auth_user } from "@app/lib/auth";
import { DustAPI } from "@app/lib/dust_api";
import { App, Provider, Run, User } from "@app/lib/models";
import { credentialsFromProviders } from "@app/lib/providers";
import { dumpSpecification } from "@app/lib/specification";
import logger from "@app/logger/logger";
import withLogging from "@app/logger/withlogging";
import { RunType } from "@app/types/run";
import { NextApiRequest, NextApiResponse } from "next";

export type GetRunsResponseBody = {
  runs: RunType[];
  total: number;
};

type GetRunsErrorResponseBody = {
  message: string;
  code: number;
};

export type PostRunsResponseBody = {
  run: RunType;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    GetRunsResponseBody | GetRunsErrorResponseBody | PostRunsResponseBody
  >
) {
  let [authRes, appUser] = await Promise.all([
    auth_user(req, res),
    User.findOne({
      where: {
        username: req.query.user,
      },
    }),
  ]);

  if (authRes.isErr()) {
    res.status(authRes.error.status_code).end();
    return;
  }
  let auth = authRes.value;

  if (!appUser) {
    res.status(404).end();
    return;
  }

  let [app] = await Promise.all([
    App.findOne({
      where: {
        userId: appUser.id,
        sId: req.query.sId,
      },
    }),
  ]);

  if (!app) {
    res.status(404).end();
    return;
  }

  switch (req.method) {
    case "POST":
      // Super important check as this would allow other users to run public app as their own (we do
      // pull the right credentials from the auth user), but the resulting run object (`core`) would
      // be visible by the owner of the app, leaking information both ways. We will allow that in
      // the future once we introduce a `front` `Run` object.
      if (!auth.canRunApp(app)) {
        res.status(404).end();
        return;
      }

      const [providers] = await Promise.all([
        Provider.findAll({
          where: {
            userId: auth.user().id,
          },
        }),
      ]);

      switch (req.body.mode) {
        // Run creation as part of the app execution process (Use pane).
        case "execute":
          if (
            !req.body ||
            !(typeof req.body.config == "string") ||
            !(typeof req.body.specificationHash === "string")
          ) {
            res.status(400).end();
            return;
          }

          const streamRes = await DustAPI.createRunStream(
            app.dustAPIProjectId,
            auth.user().id.toString(),
            {
              runType: "execute",
              specificationHash: req.body.specificationHash,
              inputs: req.body.inputs,
              config: { blocks: JSON.parse(req.body.config) },
              credentials: credentialsFromProviders(providers),
            }
          );

          if (streamRes.isErr()) {
            res.status(400).json(streamRes.error);
            return;
          }

          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });

          try {
            for await (const chunk of streamRes.value.chunkStream) {
              res.write(chunk);
              // @ts-expect-error
              res.flush();
            }
          } catch (e) {
            logger.error(
              {
                error: e,
              },
              "Error streaming from Dust API"
            );
          }

          let dustRunId: string;
          try {
            dustRunId = await streamRes.value.dustRunId;
          } catch (e) {
            logger.error(
              {
                error:
                  "No run ID received from Dust API after consuming stream",
              },
              "Error streaming from Dust API"
            );
            res.end();
            return;
          }

          Run.create({
            dustRunId,
            userId: auth.user().id,
            appId: app.id,
            runType: "execute",
          });

          res.end();
          return;

        // Run creation as part of the app design process (Specification pane).
        case "design":
          if (
            !req.body ||
            !(typeof req.body.config == "string") ||
            !(typeof req.body.specification === "string")
          ) {
            res.status(400).end();
            return;
          }

          const datasets = await DustAPI.getDatasets(app.dustAPIProjectId);
          if (datasets.isErr()) {
            res.status(500).end();
            return;
          }

          let latestDatasets: { [key: string]: string } = {};
          for (const d in datasets.value.datasets) {
            latestDatasets[d] = datasets.value.datasets[d][0].hash;
          }

          const config = JSON.parse(req.body.config);
          const inputConfigEntry: any = Object.values(config).find(
            (configValue: any) => configValue.type == "input"
          );
          const inputDataset = inputConfigEntry
            ? inputConfigEntry.dataset
            : null;

          const dustRun = await DustAPI.createRun(
            app.dustAPIProjectId,
            auth.user().id.toString(),
            {
              runType: "local",
              specification: dumpSpecification(
                JSON.parse(req.body.specification),
                latestDatasets
              ),
              datasetId: inputDataset,
              config: { blocks: config },
              credentials: credentialsFromProviders(providers),
            }
          );

          if (dustRun.isErr()) {
            res.status(400).json(dustRun.error);
            return;
          }

          Run.create({
            dustRunId: dustRun.value.run.run_id,
            userId: auth.user().id,
            appId: app.id,
            runType: "local",
          });

          await app.update({
            savedSpecification: req.body.specification,
            savedConfig: req.body.config,
            savedRun: dustRun.value.run.run_id,
          });

          res.status(200).json({ run: dustRun.value.run });
          return;

        default:
          res.status(400).end();
          return;
      }

    case "GET":
      let limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      let offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
      let runType = req.query.runType ? req.query.runType : "local";

      const where = {
        runType,
        userId: auth.user().id,
        appId: app.id,
      };

      const userRuns = await Run.findAll({
        where: where,
        limit,
        offset,
        order: [["createdAt", "DESC"]],
      });
      const totalNumberOfRuns = await Run.count({
        where,
      });
      const userDustRunIds = userRuns.map((r) => r.dustRunId);

      const dustRuns = await DustAPI.getRunsBatch(
        app.dustAPIProjectId,
        userDustRunIds
      );

      if (dustRuns.isErr()) {
        console.log(dustRuns.error);
        res.status(400).json(dustRuns.error);
        return;
      }

      res.status(200).json({
        runs: userDustRunIds.map((dustRunId) => dustRuns.value.runs[dustRunId]),
        total: totalNumberOfRuns,
      });
      return;

    default:
      res.status(405).end();
      return;
  }
}

export default withLogging(handler);
