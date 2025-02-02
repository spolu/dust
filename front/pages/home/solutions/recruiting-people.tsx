import type { ReactElement } from "react";
import React from "react";

import { BlogSection } from "@app/components/home/content/Product/BlogSection";
import {
  CarousselContentBlock,
  HeaderContentBlock,
} from "@app/components/home/ContentBlocks";
import { Grid } from "@app/components/home/ContentComponents";
import type { LandingLayoutProps } from "@app/components/home/LandingLayout";
import LandingLayout from "@app/components/home/LandingLayout";
import {
  getParticleShapeIndexByName,
  shapeNames,
} from "@app/components/home/Particles";
import type { SolutionSectionAssistantBlockProps } from "@app/components/home/SolutionSection";
import { SolutionSection } from "@app/components/home/SolutionSection";
import TrustedBy from "@app/components/home/TrustedBy";

export async function getServerSideProps() {
  return {
    props: {
      shape: getParticleShapeIndexByName(shapeNames.torus),
      gtmTrackingId: process.env.NEXT_PUBLIC_GTM_TRACKING_ID ?? null,
    },
  };
}

interface pageSettingsProps {
  uptitle: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
  from: string;
  to: string;
}

const pageSettings: pageSettingsProps = {
  uptitle: "Recruiting and People",
  title: <>More&nbsp;time for&nbsp;people, teams, and&nbsp;managers</>,
  from: "from-amber-200",
  to: "to-amber-500",
  description: (
    <>
      Support the&nbsp;business and&nbsp;the team effectively across recruiting,
      onboarding, and&nbsp;career development initiatives.
    </>
  ),
};

export default function RecruitingPeople() {
  return (
    <>
      <HeaderContentBlock
        uptitle={"Dust for " + pageSettings.uptitle}
        title={pageSettings.title}
        from={pageSettings.from}
        to={pageSettings.to}
        subtitle={pageSettings.description}
      />
      <TrustedBy />
      <Grid>
        <SolutionSection
          title="Focus on&nbsp;being a&nbsp;business partner, not&nbsp;a&nbsp;help desk."
          blocks={[
            {
              color: "amber",
              contentBlocks: [
                {
                  title: (
                    <>
                      Give new hires the&nbsp;buddy they can always tap
                      on&nbsp;the shoulder
                    </>
                  ),
                  content: (
                    <>
                      Transform your&nbsp;onboard process with tailored
                      assistance for newcomers to&nbsp;discover
                      your&nbsp;methods, people, and&nbsp;culture.
                    </>
                  ),
                },
                {
                  title: (
                    <>Let your&nbsp;internal documentation do&nbsp;the work</>
                  ),
                  content: (
                    <>
                      Extract yourself from&nbsp;admin ping pong. Allow team
                      members to&nbsp;interact with an&nbsp;assistant that
                      answers common people-related questions in&nbsp;Slack
                      and&nbsp;points to&nbsp;the right internal resources.
                    </>
                  ),
                },
              ],
              assistantBlocks: [assistantExamples[0], assistantExamples[1]],
            },
          ]}
        />
        <SolutionSection
          title="Help your&nbsp;People Grow."
          blocks={[
            {
              color: "amber",
              contentBlocks: [
                {
                  title: "Create engaging learning experiences faster",
                  content: (
                    <>
                      Use internal documentation to create training materials
                      tailored to each role and team.
                    </>
                  ),
                },
                {
                  title: "Streamline performance reviews",
                  content: [
                    <>
                      Help reviewers collect data to&nbsp;get a&nbsp;holistic
                      view of&nbsp;their teammates' impact and&nbsp;make more
                      accurate evaluations.
                    </>,
                    <>
                      Get more thoughtful peer reviews, with AI-powered feedback
                      on&nbsp;tone, references to&nbsp;company principles,
                      priorities and&nbsp;business objectives.
                    </>,
                  ],
                },
              ],
              assistantBlocks: [assistantExamples[7], assistantExamples[6]],
            },
          ]}
        />
        <SolutionSection
          title="Give your&nbsp;hiring efforts a&nbsp;boost."
          blocks={[
            {
              color: "amber",
              contentBlocks: [
                {
                  title: <>Get a&nbsp;qualified pipeline in&nbsp;a flash</>,
                  content: [
                    <>
                      Easily draft consistent job descriptions. Analyze
                      and&nbsp;filter candidates' CVs by&nbsp;finding elements
                      that are a&nbsp;match for expectations.
                    </>,
                    <>
                      Train your&nbsp;team at&nbsp;writing exercises
                      and&nbsp;questions, reviewing exercises' responses,
                      and&nbsp;reading through candidates' subtexts.
                    </>,
                  ],
                },
                {
                  title: <>Raise the&nbsp;bar on&nbsp;interviews</>,
                  content: [
                    <>
                      Easily prepare the&nbsp;interview process including
                      questions that match the&nbsp;role expectations
                      and&nbsp;company guidelines.
                    </>,
                    <>
                      Give the&nbsp;team context on&nbsp;the status of&nbsp;a
                      hire.
                    </>,
                    <>
                      Help interviewers write consistent
                      and&nbsp;well-articulated feedback that directly connects
                      to&nbsp;your company's evaluation rubric.
                    </>,
                  ],
                },
              ],
              assistantBlocks: [
                assistantExamples[2],
                assistantExamples[3],
                assistantExamples[4],
              ],
            },
          ]}
        />
      </Grid>
      <BlogSection
        headerColorFrom="from-amber-200"
        headerColorTo="to-amber-500"
      />
    </>
  );
}

RecruitingPeople.getLayout = (
  page: ReactElement,
  pageProps: LandingLayoutProps
) => {
  return <LandingLayout pageProps={pageProps}>{page}</LandingLayout>;
};

const assistantExamples: SolutionSectionAssistantBlockProps[] = [
  {
    emoji: "🌱",
    name: "@onboardingBuddy",
    backgroundColor: "bg-amber-300",
    description: (
      <>
        Acts as&nbsp;a friendly guide to&nbsp;help new team members feel welcome
        and&nbsp;properly informed from&nbsp;day one and&nbsp;as they learn
        about the&nbsp;company
      </>
    ),
  },
  {
    emoji: "👋",
    name: "@askHR",
    backgroundColor: "bg-amber-300",
    description: (
      <>
        Answers questions the&nbsp;People team gets most regularly about company
        processes and&nbsp;policies based on&nbsp;internal documentation
        directly on&nbsp;Slack
      </>
    ),
  },
  {
    emoji: "🖋️",
    name: "@hiringOps",
    backgroundColor: "bg-amber-300",
    description: (
      <>
        Drafts job descriptions and&nbsp;matching social media communications
        based on&nbsp;company templates
      </>
    ),
  },
  {
    emoji: "🏅",
    name: "@reviewPrep",
    backgroundColor: "bg-amber-300",
    description: (
      <>
        Collects achievements, drafts actionable reviews, helps formulate
        feedback
      </>
    ),
  },
];

export function RecruitingCaroussel() {
  return (
    <CarousselContentBlock
      title={pageSettings.uptitle}
      subtitle={pageSettings.title}
      description={pageSettings.description}
      assistants={assistantExamples}
      from={pageSettings.from}
      to={pageSettings.to}
      border="border-pink-100/60"
      href="/home/solutions/recruiting-people"
    />
  );
}
