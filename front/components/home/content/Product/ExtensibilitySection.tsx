import { Div3D, Hover3D } from "@dust-tt/sparkle";
import Link from "next/link";
import React from "react";

import { ImgBlock } from "@app/components/home/ContentBlocks";
import { A, Grid, H2, P, Strong } from "@app/components/home/ContentComponents";
import { classNames } from "@app/lib/utils";

export function ExtensibilitySection() {
  return (
    <>
      <Grid>
        <div className="col-span-12 mb-6">
          <div>
            <H2 from="from-pink-200" to="to-pink-400">
              Push further with custom code
            </H2>
            <P size="lg">
              Developer friendly&nbsp;platform designed to&nbsp;build custom
              actions and&nbsp;application orchestration to&nbsp;fit your
              team’s&nbsp;exact&nbsp;needs.{" "}
              <Link href="/home/solutions/dust-platform" shallow={true}>
                <A variant="primary">More about Dust's&nbsp;Platform</A>
              </Link>
            </P>
          </div>
        </div>
        <div
          className={classNames(
            "col-span-12 pt-8",
            "grid grid-cols-1 gap-x-8 gap-y-20",
            "md:grid-cols-3 md:gap-y-16"
          )}
        >
          <ImgBlock
            title={<>Build your own agentic tools</>}
            content={
              <>
                Develop advanced or agentic capabilities, from document
                auto-updates, triggered actions, or external API access.
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
          <ImgBlock
            title={<>Build your own connections</>}
            content={
              <>
                No ceiling on data connections. Leverage the API to import in
                knowledge from any source and let assistants tackle more
                ambitious use cases.
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
            title={<>Build your own integrations</>}
            content={
              <>
                Use our API to embed assistants in your apps or websites,
                unlocking fully custom user experiences and deep automation.
              </>
            }
          >
            <Hover3D
              depth={-20}
              perspective={1000}
              className={classNames("relative")}
            >
              <Div3D depth={-20}>
                <img src="/static/landing/connect/connect1.png" />
              </Div3D>
              <Div3D depth={0} className="absolute top-0">
                <img src="/static/landing/connect/connect2.png" />
              </Div3D>
              <Div3D depth={15} className="absolute top-0">
                <img src="/static/landing/connect/connect3.png" />
              </Div3D>
              <Div3D depth={60} className="absolute top-0">
                <img src="/static/landing/connect/connect4.png" />
              </Div3D>
            </Hover3D>
          </ImgBlock>
        </div>
      </Grid>
    </>
  );
}
