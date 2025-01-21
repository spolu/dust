import { Div3D, Hover3D } from "@dust-tt/sparkle";
import Link from "next/link";
import React from "react";

import { ImgBlock } from "@app/components/home/ContentBlocks";
import { A, Grid, H2, P, Strong } from "@app/components/home/ContentComponents";
import { classNames } from "@app/lib/utils";

export function DifferentiationSection() {
  return (
    <>
      <Grid>
        <div className="col-span-12 mb-6">
          <div>
            <H2 from="from-sky-200" to="to-blue-400">
              Leverage and customize Dust where you need it
            </H2>
            <P size="lg">
              Leverage the power of AI directly from your tools and workflows.
              Build custom development for more agency and deeper integrations.
            </P>
          </div>
        </div>
        <div
          className={classNames(
            "col-span-12 pt-8",
            "grid grid-cols-1 gap-x-8 gap-y-20",
            "sm:grid-cols-3 md:gap-y-16"
          )}
        >
          <ImgBlock
            title={<>Access Dust where you need it</>}
            content={
              <>
                “Access Dust wherever you work in your key tools (Slack,
                Zendesk) our directly in Chrome with your page context.”
              </>
            }
          >
            <Hover3D
              depth={-20}
              perspective={1000}
              className={classNames("relative")}
            >
              <Div3D depth={-20}>
                <img src="/static/landing/slack/slack1.png" />
              </Div3D>
              <Div3D depth={20} className="absolute top-0">
                <img src="/static/landing/slack/slack2.png" />
              </Div3D>
              <Div3D depth={40} className="absolute top-0">
                <img src="/static/landing/slack/slack3.png" />
              </Div3D>
              <Div3D depth={70} className="absolute top-0">
                <img src="/static/landing/slack/slack4.png" />
              </Div3D>
            </Hover3D>
          </ImgBlock>
          <ImgBlock
            title={<>Add to existing workflows</>}
            content={
              <>
                Trigger AI actions via Zapier, Make or Slack workflows to
                automate tasks end-to-end.
              </>
            }
          >
            <Hover3D
              depth={-20}
              perspective={1000}
              className={classNames("relative")}
            >
              <Div3D depth={-40}>
                <img src="/static/landing/model/model1.png" />
              </Div3D>
              <Div3D depth={0} className="absolute top-0">
                <img src="/static/landing/model/model2.png" />
              </Div3D>
              <Div3D depth={50} className="absolute top-0 drop-shadow-lg">
                <img src="/static/landing/model/model3.png" />
              </Div3D>
              <Div3D depth={120} className="absolute top-0 drop-shadow-lg">
                <img src="/static/landing/model/model4.png" />
              </Div3D>
            </Hover3D>
          </ImgBlock>
          <ImgBlock
            title={<>Code to boost capabilities</>}
            content={
              <>
                Leverage our developer platform to build agentic
                functionalities, custom data ingestions and deeper integrations.
              </>
            }
          >
            <Hover3D
              depth={-20}
              perspective={1000}
              className={classNames("relative")}
            >
              <Div3D depth={-20}>
                <img src="/static/landing/apps/apps1.png" />
              </Div3D>
              <Div3D depth={0} className="absolute top-0">
                <img src="/static/landing/apps/apps2.png" />
              </Div3D>
              <Div3D depth={15} className="absolute top-0">
                <img src="/static/landing/apps/apps3.png" />
              </Div3D>
              <Div3D depth={60} className="absolute top-0">
                <img src="/static/landing/apps/apps4.png" />
              </Div3D>
            </Hover3D>
          </ImgBlock>
        </div>
      </Grid>
    </>
  );
}
