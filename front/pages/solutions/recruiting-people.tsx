import type { ReactElement } from "react";

import {
  Block,
  ContentAssistantBlock,
  DroidItem,
  HeaderContentBlock,
} from "@app/components/home/new/ContentBlocks";
import { Grid, H2 } from "@app/components/home/new/ContentComponents";
import type { LandingLayoutProps } from "@app/components/home/new/LandingLayout";
import LandingLayout from "@app/components/home/new/LandingLayout";
import {
  getParticleShapeIndexByName,
  shapeNames,
} from "@app/components/home/new/Particles";
import config from "@app/lib/api/config";
import { getSession } from "@app/lib/auth";
import {
  getUserFromSession,
  makeGetServerSidePropsRequirementsWrapper,
} from "@app/lib/iam/session";

export const getServerSideProps = makeGetServerSidePropsRequirementsWrapper({
  requireUserPrivilege: "none",
})<{
  gaTrackingId: string;
  shape: number;
}>(async (context) => {
  // Fetch session explicitly as this page redirects logged in users to our home page.
  const session = await getSession(context.req, context.res);
  const user = await getUserFromSession(session);

  if (user && user.workspaces.length > 0) {
    let url = `/w/${user.workspaces[0].sId}`;

    if (context.query.inviteToken) {
      url = `/api/login?inviteToken=${context.query.inviteToken}`;
    }

    return {
      redirect: {
        destination: url,
        permanent: false,
      },
    };
  }

  return {
    props: {
      gaTrackingId: config.getGaTrackingId(),
      shape: getParticleShapeIndexByName(shapeNames.torus),
    },
  };
});

const defaultHClasses =
  "text-white col-span-12 lg:col-span-10 lg:col-start-2 xl:col-span-8 xl:col-start-3 pt-8 pb-4 text-center";

export default function RecruitingPeople() {
  return (
    <>
      <HeaderContentBlock
        uptitle="Dust for Recruiting and People teams"
        title={<>More&nbsp;time for&nbsp;people, teams and&nbsp;managers.</>}
        from="from-amber-200"
        to="to-amber-400"
        subtitle={
          <>
            Onboard&nbsp;better, support managers&nbsp;and teams effectively,
            scale performance analysis and&nbsp;recruiting.
          </>
        }
      />
      <Grid>
        <H2 className={defaultHClasses}>
          Share knowledge better,
          <br />
          free time for you.
        </H2>{" "}
        <ContentAssistantBlock
          className="col-span-12 mb-4 lg:col-span-10 lg:col-start-2 xl:col-span-8 xl:col-start-3"
          layout="vertical"
          color="sky"
          content={
            <>
              <Block
                title={
                  <>
                    Onboard new people with accessible information at their own
                    pace
                  </>
                }
              >
                Transform your onboarding process using an AI assistant designed
                to guide newcomers through your methods, processes, people, and
                culture.
              </Block>
              <Block title={<>Put your internal documentation to work</>}>
                Create an assistant capable of answering any questions, point to
                the right internal resources, and spread your company culture
                and methods.
              </Block>
            </>
          }
          assistant={
            <>
              {peopleSlides[0]}
              {peopleSlides[1]}
            </>
          }
        />
        <H2 className={defaultHClasses}>Help your people grow.</H2>{" "}
        <ContentAssistantBlock
          className="col-span-12 md:col-span-8 md:col-start-3 lg:col-span-6 lg:col-start-4 xl:col-span-4 xl:col-start-5"
          layout="vertical"
          color="emerald"
          content={
            <>
              <Block title={<>Improve Feedback and Reviews</>}>
                Collect data from various channels to get a holistic view of
                each employee's work and make more accurate evaluations. Help
                your team write more thoughtfully, with AI-powered feedback on
                tone, references to company principles, priorities and business
                objectives.
              </Block>
            </>
          }
          assistant={<>{peopleSlides[6]}</>}
        />
        <H2 className={defaultHClasses}>
          Boost your team hiring&nbsp;efforts.
        </H2>
        <ContentAssistantBlock
          className="col-span-12 lg:col-span-10 lg:col-start-2 xl:col-span-6"
          layout="column sm:vertical"
          color="amber"
          content={
            <>
              <Block title="Level your team up on hiring">
                Make your company hiring practices, guidelines and knowledge
                easy to find and leverage for everyone. Make your team better at
                writing exercises, questions, revieweing exercises response,
                read through candidates subtext. Score a candidate’s take-home
                answers with your rubric in mind.
              </Block>
            </>
          }
          assistant=<>
            {peopleSlides[2]}
            {peopleSlides[3]}
          </>
        />
        <ContentAssistantBlock
          className="col-span-12 lg:col-span-10 lg:col-start-2 xl:col-span-6"
          layout="column sm:vertical"
          color="amber"
          content={
            <>
              <Block title="Make AI work for you">
                Analyse candidate’s CV in a second Extract information from
                texts, normalise lists of emails and names, batch write content.
                Draft job description, social media posts, outbound emails,
                interview questions in minutes, with company tones and
                structure.
              </Block>
            </>
          }
          assistant=<>
            {peopleSlides[4]}
            {peopleSlides[5]}
          </>
        />
      </Grid>
    </>
  );
}

RecruitingPeople.getLayout = (
  page: ReactElement,
  pageProps: LandingLayoutProps
) => {
  return <LandingLayout pageProps={pageProps}>{page}</LandingLayout>;
};

const peopleSlides = [
  <DroidItem
    key="0"
    emoji="🌱"
    avatarBackground="bg-sky-200"
    name="@onboardingBuddy"
    question="Your friendly guide to help new team members feel welcomed, informed, and integrated from day one."
  />,
  <DroidItem
    key="1"
    emoji="👋"
    avatarBackground="bg-sky-200"
    name="@people"
    question="Answer on slack all questions about processes, methodes, people and roles based on company documentation."
  />,
  <DroidItem
    key="2"
    emoji="🖋️"
    avatarBackground="bg-amber-200"
    name="@hiringOps"
    question="Draft job descriptions, emails, social media coms based on company standards."
  />,
  <DroidItem
    key="3"
    emoji="🔬"
    avatarBackground="bg-amber-200"
    name="@interviewReading"
    question="Help read and analyse candidate expert according to company principles."
  />,
  <DroidItem
    key="4"
    emoji="💬"
    avatarBackground="bg-amber-200"
    name="@hiringQuestions"
    question="Draft questions depending on the role, type of interview and stage in the process."
  />,
  <DroidItem
    key="5"
    emoji="🧐"
    avatarBackground="bg-amber-200"
    name="@candidate"
    question="Summarize available information about a candidate based on Company DB."
  />,
  <DroidItem
    key="6"
    emoji="🏅"
    avatarBackground="bg-emerald-200"
    name="@feedbackReview"
    question="Collects achievements, drafts actionable reviews, helps formulate feedback."
  />,
];
