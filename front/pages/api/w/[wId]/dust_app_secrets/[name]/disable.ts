import type { DustAppSecretType } from "@dust-tt/types";
import type { NextApiRequest, NextApiResponse } from "next";

import { Authenticator, getSession } from "@app/lib/auth";
import { DustAppSecret } from "@app/lib/models/workspace";
import { withLogging } from "@app/logger/withlogging";

export type PostDustAppSecretsResponseBody = {
  secret: DustAppSecretType;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PostDustAppSecretsResponseBody>
): Promise<void> {
  const session = await getSession(req, res);
  const auth = await Authenticator.fromSession(
    session,
    req.query.wId as string
  );

  const owner = auth.workspace();
  if (!owner) {
    res.status(404).end();
    return;
  }

  if (!auth.isBuilder()) {
    res.status(403).end();
    return;
  }

  const secret = await DustAppSecret.findOne({
      where: {
        name: req.query.name,
        workspaceId: owner.id,
        status: "active"
      },
    });

  if (!secret) {
    res.status(404).end();
    return;
  }

  switch (req.method) {
    case "POST":
      await secret.update({
        status: "disabled",
      });

      console.log('DISABLING SECRET')

      res.status(200).json({
        secret: {
          name: secret.name,
          value: "REDACTED",
        },
      });
      return;

    default:
      res.status(405).end();
      return;
  }
}

export default withLogging(handler);
