import {
  Button,
  Hover3D,
  RocketIcon,
  UserGroupIcon,
  LightbulbIcon,
} from "@dust-tt/sparkle";
import type { ReactElement } from "react-markdown/lib/react-markdown";

import {
  UseCasesSection,
  type UseCase,
} from "@app/components/home/content/Solutions/UseCasesSection";

import {
  CustomerStoriesSection,
  type CustomerStory,
} from "@app/components/home/content/Solutions/CustomerStoriesSection";

import {
  CarousselContentBlock,
  MetricComponent,
  Quote,
} from "@app/components/home/ContentBlocks";
import { Grid, H2 } from "@app/components/home/ContentComponents";
import type { LandingLayoutProps } from "@app/components/home/LandingLayout";
import LandingLayout from "@app/components/home/LandingLayout";
import {
  getParticleShapeIndexByName,
  shapeNames,
} from "@app/components/home/Particles";
import type { SolutionSectionAssistantBlockProps } from "@app/components/home/SolutionSection";
import {
  BenefitsSection,
  type Benefit,
} from "@app/components/home/content/Solutions/BenefitsSection";
import TrustedBy from "@app/components/home/TrustedBy";
import { classNames } from "@app/lib/utils";
import { HeroSection } from "@app/components/home/content/Solutions/HeroSection";

import Link from "next/link";

export async function getServerSideProps() {
  return {
    props: {
      shape: getParticleShapeIndexByName(shapeNames.octahedron),
    },
  };
}

interface pageSettingsProps {
  uptitle: string;
  title: React.ReactNode;
  description: React.ReactNode;
  from: string;
  to: string;
}

const pageSettings: pageSettingsProps = {
  uptitle: "Customer Support",
  title: <>Instant knowledge, exceptional support</>,
  from: "from-sky-200",
  to: "to-sky-500",
  description: (
    <>
      Equip your&nbsp;team with AI&nbsp;assistants to&nbsp;accelerate issue
      resolution and&nbsp;increase customer satisfaction.
    </>
  ),
};

// Settings for Hero section
const supportHeroProps = {
  uptitle: pageSettings.uptitle,
  title: pageSettings.title,
  description: pageSettings.description,
  fromColor: pageSettings.from,
  toColor: pageSettings.to,
  visuals: [
    {
      src: "/static/landing/support/support1.png",
      alt: "Support Visual 1",
      depth: -30,
    },
    {
      src: "/static/landing/support/support2.png",
      alt: "Support Visual 2",
      depth: -10,
    },
    {
      src: "/static/landing/support/support3.png",
      alt: "Support Visual 3",
      depth: 20,
    },
    {
      src: "/static/landing/support/support4.png",
      alt: "Support Visual 4",
      depth: 50,
    },
  ],
  ctaButtons: {
    primary: {
      label: "Get started",
      href: "/home/pricing",
      icon: RocketIcon,
    },
    secondary: {
      label: "Talk to sales",
      href: "/home/contact",
    },
  },
};

// Parameters for the Benefits Section
const supportBenefits: Benefit[] = [
  {
    icon: RocketIcon,
    title: "Resolve Issues Faster",
    description:
      "Surface relevant information from all connected knowledge bases and draft messages in 50+ languages.",
  },
  {
    icon: UserGroupIcon,
    title: "Boost Team Productivity",
    description:
      "Keep teams in sync with real-time information across all channels and cut onboarding time for new joiners.",
  },
  {
    icon: LightbulbIcon,
    title: "Grasp Customer Needs",
    description:
      "Convert support interactions into insights, driving data-backed product and documentation improvements.",
  },
];

// Parameters for the Use Cases Section
const supportUseCases: UseCase[] = [
  {
    title: "Ticket Resolution",
    content:
      "Accelerate response times with dynamic answer suggestions and contextual knowledge at every step.",
    images: ["/static/landing/solutions/support1.png"],
  },
  {
    title: "Agent Coaching",
    content:
      "Offer feedback to support agents using real-time best practices and ticket insights for consistent, quality service.",
    images: ["/static/landing/solutions/support2.png"],
  },
  {
    title: "Documentation Builder",
    content:
      "Convert resolved tickets into searchable articles and FAQs, capturing best practices for future use.",
    images: ["/static/landing/solutions/support3.png"],
  },
  {
    title: "Customer Insights",
    content:
      "Identify trends from customer feedback, helping teams proactively improve service and satisfaction.",
    images: ["/static/landing/solutions/support4.png"],
  },
];

// Parameters for the Customer Stories Section
const supportStories: CustomerStory[] = [
  {
    title: "Malt cuts support ticket closing time by 50% with Dust",
    content:
      "Malt streamlines customer support using Dust's AI platform for rapid, consistent multilingual responses.",
    href: "https://blog.dust.tt/malt-customer-support/",
    src: "https://blog.dust.tt/content/images/size/w2000/2024/12/Malt_Customer_Story_Dust_Support.jpg",
  },
  {
    title: "Pennylane's journey to deploy Dust for Customer Care teams",
    content:
      "Dust evolved from a simple support tool into an integral part of Pennylane's operations.",
    href: "https://blog.dust.tt/pennylane-dust-customer-support-journey/",
    src: "https://blog.dust.tt/content/images/size/w2000/2024/12/pennylane_dust_customer_story.png",
  },
  {
    title: "Lifen uses Dust AI assistants to boost team productivity",
    content:
      "Lifen uses Dust AI assistants to boost team productivity and save hours of work each week.",
    href: "https://blog.dust.tt/customer-story-lifen/",
    src: "https://blog.dust.tt/content/images/size/w2000/2024/11/lifen_dust_customer_story.jpg",
  },
];

export default function CustomerSupport() {
  return (
    <>
      <div className="container flex w-full flex-col gap-0 bg-slate-900/50 px-6 pb-12">
        <HeroSection {...supportHeroProps} />
        <Grid>
          <div
            className={classNames(
              "flex flex-col gap-8",
              "col-span-12",
              "lg:col-span-12 lg:col-start-1",
              "xl:col-span-12 xl:col-start-1",
              "2xl:col-start-1"
            )}
          >
            <BenefitsSection
              title="Solve faster, satisfy more"
              benefits={supportBenefits}
              fromColor={pageSettings.from}
              toColor={pageSettings.to}
            />
            <MetricComponent
              metrics={[
                {
                  value: "50%",
                  description: <>50%&nbsp; in ticket resolution time</>,
                },
                {
                  value: "8h",
                  description: <>8&nbsp;hours saved weekly per&nbsp;agent</>,
                },
              ]}
              from="from-amber-200"
              to="to-amber-500"
            />
          </div>
          <div
            className={classNames(
              "flex flex-col gap-8",
              "col-span-12",
              "lg:col-span-12 lg:col-start-1",
              "xl:col-span-12 xl:col-start-1",
              "2xl:col-start-1"
            )}
          >
            <UseCasesSection
              title="Your use cases, your way"
              description="Customize and automate tasks without writing a single line of code."
              useCases={supportUseCases}
              fromColor={pageSettings.from}
              toColor={pageSettings.to}
            />
          </div>
          <div
            className={classNames(
              "flex flex-col justify-center gap-8 pb-4",
              "col-span-12",
              "lg:col-span-12 lg:col-start-1",
              "xl:col-span-12 xl:col-start-1",
              "2xl:col-start-1"
            )}
          >
            <div>
              <H2 from={pageSettings.from} to={pageSettings.to}>
                Watch Dust work
              </H2>
              {/* <P size="lg">See a demo of the Dust product.</P> */}
            </div>
            <Hover3D depth={-40} perspective={1000} className="relative w-full">
              <div className="relative w-full pt-[56.25%]">
                {" "}
                {/* 16:9 aspect ratio */}
                <iframe
                  src="https://fast.wistia.net/embed/iframe/7ynip6mgfx?seo=true&videoFoam=true"
                  title="Dust product tour"
                  allow="autoplay; fullscreen"
                  frameBorder="0"
                  className="absolute inset-0 h-full w-full rounded-lg"
                ></iframe>{" "}
              </div>
            </Hover3D>
          </div>
          <div
            className={classNames(
              "flex flex-col gap-8 pb-12",
              "col-span-12",
              "lg:12 lg:col-start-1",
              "xl:col-span-12 xl:col-start-1",
              "2xl:col-start-1"
            )}
          >
            <Quote
              quote="We’re managing a&nbsp;higher volume of&nbsp;tickets and have cut processing time—from an&nbsp;average of 6&nbsp;minutes per ticket to&nbsp;just a&nbsp;few seconds."
              name="Anaïs Ghelfi"
              title="Head of Data Platform at Malt"
              logo="/static/landing/logos/malt.png"
            />
            <CustomerStoriesSection
              title="Customer stories"
              stories={supportStories}
              fromColor={pageSettings.from}
              toColor={pageSettings.to}
            />
          </div>
          <TrustedBy />
          <div
            className={classNames(
              "col-span-12 flex flex-col items-center",
              "lg:col-span-12 lg:col-start-1",
              "xl:col-span-10 xl:col-start-2"
            )}
          >
            {supportHeroProps.ctaButtons && (
              <div className="mt-4 flex justify-center gap-4">
                {supportHeroProps.ctaButtons.primary && (
                  <Link
                    href={supportHeroProps.ctaButtons.primary.href}
                    shallow={true}
                  >
                    <Button
                      variant="highlight"
                      size="md"
                      label={supportHeroProps.ctaButtons.primary.label}
                      icon={supportHeroProps.ctaButtons.primary.icon}
                    />
                  </Link>
                )}
                {supportHeroProps.ctaButtons.secondary && (
                  <Button
                    variant="outline"
                    size="md"
                    label={supportHeroProps.ctaButtons.secondary.label}
                    href={supportHeroProps.ctaButtons.secondary.href}
                  />
                )}
              </div>
            )}
          </div>
        </Grid>
      </div>
    </>
  );
}

CustomerSupport.getLayout = (
  page: ReactElement,
  pageProps: LandingLayoutProps
) => {
  return <LandingLayout pageProps={pageProps}>{page}</LandingLayout>;
};

const assistantExamples: SolutionSectionAssistantBlockProps[] = [
  {
    emoji: "🤝",
    backgroundColor: "bg-sky-300",
    name: "@supportExpert",
    description: (
      <>
        Surfaces relevant information from&nbsp;your Help Center, FAQs,
        knowledge base, online documentation, and&nbsp;tickets. Understands
        errors codes without help from&nbsp;the tech&nbsp;team
      </>
    ),
  },
  {
    emoji: "📡",
    backgroundColor: "bg-sky-300",
    name: "@productInfo",
    description: (
      <>
        Answer questions on&nbsp;product evolutions, engineering activity,
        alerts, and&nbsp;downtime
      </>
    ),
  },
  {
    emoji: "🔮",
    backgroundColor: "bg-sky-300",
    name: "@supportAnalyst",
    description: (
      <>
        Identifies patterns and&nbsp;sentiment in&nbsp;support interactions
        to&nbsp;highlight recurring needs and&nbsp;actionable initiatives based
        on&nbsp;the internal product team nomenclature and&nbsp;infrastructure
      </>
    ),
  },
  {
    emoji: "💡",
    backgroundColor: "bg-sky-300",
    name: "@supportOnboarding",
    description: (
      <>
        Helps new members of&nbsp;the support team navigate the&nbsp;tools
        and&nbsp;processes in&nbsp;their first weeks to&nbsp;set them up for
        success
      </>
    ),
  },
  {
    emoji: "🚨",
    backgroundColor: "bg-sky-300",
    name: "@supportAlerts",
    description: (
      <>
        Connects to&nbsp;product and&nbsp;engineering communication channels
        to&nbsp;surface ongoing engineering activity, incidents or&nbsp;issues
        and&nbsp;highlight the&nbsp;possible impact on&nbsp;users
        and&nbsp;customers
      </>
    ),
  },
  {
    emoji: "😳",
    backgroundColor: "bg-sky-300",
    name: "@whatWouldUserDo",
    description: (
      <>
        Crafts training, product documentation and&nbsp;training materials
        through the&nbsp;eyes of&nbsp;your users to&nbsp;help improve content
        ahead of&nbsp;issues
      </>
    ),
  },
];

export function CustomerCaroussel() {
  return (
    <CarousselContentBlock
      title={pageSettings.uptitle}
      subtitle={pageSettings.title}
      description={pageSettings.description}
      assistants={assistantExamples}
      from={pageSettings.from}
      to={pageSettings.to}
      border="border-pink-100/60"
      href="/home/solutions/customer-support"
    />
  );
}
