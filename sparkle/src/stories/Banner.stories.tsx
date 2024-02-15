import type { Meta } from "@storybook/react";
import React from "react";

import { Button } from "@sparkle/_index";
import { Banner } from "@sparkle/components/Banner";

const meta = {
  title: "Molecule/Banner",
  component: Banner,
} satisfies Meta<typeof Banner>;

export default meta;

export const BasicBanner = () => {
  return (
    <div className="s-flex s-h-full s-w-full s-flex-col s-gap-10">
      <Banner>
        <div className="s-flex s-items-center s-gap-x-4">
          <strong className="s-font-semibold">GeneriCon 2023</strong>
          <p>
            Join us in Denver from June 7 – 9 to see what’s coming next&nbsp;
          </p>
          <Button variant="tertiary" size="sm" label="Register Now" />
        </div>
      </Banner>
      <Banner variant="incident">
        <div className="s-flex s-items-center">
          <strong className="s-font-semibold">OpenAI Outage:</strong>&nbsp;It
          may cause slowness and errors from assistants using GPT or data
          retrieval. We are monitoring the situation&nbsp;
          <strong className="s-font-semibold">
            <a
              href="http://status.dust.tt/"
              target="_blank"
              className="s-underline"
            >
              here
            </a>
          </strong>
          .
        </div>
      </Banner>
      <Banner variant="error">
        <div className="s-flex s-items-center">
          <strong className="s-font-semibold">OpenAI Outage:</strong>&nbsp;It
          may cause slowness and errors from assistants using GPT or data
          retrieval. We are monitoring the situation&nbsp;
          <strong className="s-font-semibold">
            <a
              href="http://status.dust.tt/"
              target="_blank"
              className="s-underline"
            >
              here
            </a>
          </strong>
          .
        </div>
      </Banner>
    </div>
  );
};
