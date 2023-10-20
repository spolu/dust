import { Logo } from "@dust-tt/sparkle";
import { Button } from "@dust-tt/sparkle";
import { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import Script from "next/script";
import { signIn } from "next-auth/react";
import { ParsedUrlQuery } from "querystring";
import React, { ReactNode, useEffect, useRef, useState } from "react";

import { GoogleSignInButton } from "@app/components/Button";
import Particles from "@app/components/home/particles";
import ScrollingHeader from "@app/components/home/scrollingHeader";
import { getSession, getUserFromSession } from "@app/lib/auth";
import { classNames } from "@app/lib/utils";

const { GA_TRACKING_ID = "" } = process.env;

export const getServerSideProps: GetServerSideProps<{
  gaTrackingId: string;
}> = async (context) => {
  const session = await getSession(context.req, context.res);
  const user = await getUserFromSession(session);

  if (user && user.workspaces.length > 0) {
    let url = `/w/${user.workspaces[0].sId}`;

    if (context.query.wId) {
      url = `/api/login?wId=${context.query.wId}`;
    }
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
    props: { gaTrackingId: GA_TRACKING_ID },
  };
};

const defaultGridClasses = "grid grid-cols-12 gap-6";

const defaultFlexClasses = "flex flex-col gap-4";

const hClasses = {
  h1: "font-objektiv text-4xl font-bold tracking-tight text-slate-50 md:text-6xl drop-shadow-lg",
  h2: "font-objektiv text-3xl font-bold tracking-tight text-slate-50 md:text-5xl drop-shadow-lg",
  h3: "font-objektiv text-xl font-bold tracking-tight text-slate-50 md:text-2xl drop-shadow-md",
  h4: "font-objektiv text-lg font-bold tracking-tight text-slate-50 md:text-xl drop-shadow-md",
};

const pClasses = {
  normal: "font-regular text-lg text-slate-400 md:text-xl drop-shadow",
  big: "font-regular text-xl text-slate-400 md:text-2xl drop-shadow",
};

interface ContentProps {
  children: ReactNode;
  className?: string;
  variant?: string;
}

export const Grid = ({ children, className = "" }: ContentProps) => (
  <div className={classNames(className, defaultGridClasses)}>{children}</div>
);

export const H1 = ({ children, className = "" }: ContentProps) => (
  <h1 className={classNames(className, hClasses.h1)}>{children}</h1>
);

export const H2 = ({ children, className = "" }: ContentProps) => (
  <h2 className={classNames(className, hClasses.h2)}>{children}</h2>
);
export const H3 = ({ children, className = "" }: ContentProps) => (
  <h3 className={classNames(className, hClasses.h3)}>{children}</h3>
);

export const P = ({ children, className = "", variant }: ContentProps) => (
  <p
    className={classNames(
      className,
      variant === "big" ? pClasses.big : pClasses.normal
    )}
  >
    {children}
  </p>
);

export const Strong = ({ children, className = "" }: ContentProps) => (
  <strong className={classNames(className, "font-bold text-slate-300")}>
    {children}
  </strong>
);

export default function Home({
  gaTrackingId,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const router = useRouter();
  const [logoY, setLogoY] = useState<number>(0);
  const logoRef = useRef<HTMLDivElement | null>(null);

  const scrollRef1 = useRef<HTMLDivElement | null>(null);
  const scrollRef2 = useRef<HTMLDivElement | null>(null);
  const scrollRef3 = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logoRef.current) {
      const logoPosition = logoRef.current.offsetTop;
      setLogoY(logoPosition);
    }
  }, []);

  function getCallbackUrl(routerQuery: ParsedUrlQuery): string {
    let callbackUrl = "/api/login";
    if (routerQuery.wId) {
      callbackUrl += `?wId=${routerQuery.wId}`;
    } else if (routerQuery.inviteToken) {
      callbackUrl += `?inviteToken=${routerQuery.inviteToken}`;
    }
    return callbackUrl;
  }

  return (
    <>
      <HeadComponent />
      <ScrollingHeader showItemY={logoY}>
        <div className="flex h-full w-full items-center px-4">
          <Logo className="logo invisibleFirst hidden h-[24px] w-[96px] opacity-0 transition-all duration-500 ease-out md:block" />
          <div className="flex-grow" />
          <div className="flex items-center gap-2">
            {!(router.query.signIn && router.query.signIn !== "github") && (
              <div className="font-regular font-objektiv text-xs text-slate-400">
                Sign in with{" "}
                <span
                  className="cursor-pointer font-bold hover:text-blue-400"
                  onClick={() => {
                    void signIn("github", {
                      callbackUrl: getCallbackUrl(router.query),
                    });
                  }}
                >
                  GitHub
                </span>{" "}
                or
              </div>
            )}
            <GoogleSignInButton
              onClick={() =>
                signIn("google", {
                  callbackUrl: getCallbackUrl(router.query),
                })
              }
            >
              <img src="/static/google_white_32x32.png" className="h-4 w-4" />
              <span className="ml-2 mr-1">Sign in with Google</span>
            </GoogleSignInButton>
          </div>
        </div>
      </ScrollingHeader>

      {/* Keeping the background dark */}
      <div className="fixed bottom-0 left-0 right-0 top-0 -z-50 bg-slate-900" />
      {/* Particle system */}
      <div className="fixed bottom-0 left-0 right-0 top-0 -z-40 overflow-hidden">
        <Particles
          scrollRef1={scrollRef1}
          scrollRef2={scrollRef2}
          scrollRef3={scrollRef3}
        />
      </div>

      <main className="z-10 mx-6 flex flex-col items-center">
        <div className="container flex max-w-7xl flex-col gap-16">
          <Grid>
            <div className="col-span-8 col-start-3 flex flex-col gap-16">
              <div style={{ height: "24vh" }} />
              <div ref={logoRef}>
                <Logo className="h-[48px] w-[192px]" />
              </div>
              <H1>
                <span className="text-red-400 sm:font-objektiv md:font-objektiv">
                  Amplify your team's potential
                </span>{" "}
                <br />
                with customizable and secure AI&nbsp;assistants
              </H1>
              <P variant="big" className="col-span-6 col-start-3">
                <Strong>AI is changing the way we work.</Strong>
                <br />
                Effectively channeling the potential of AI is a competitive
                edge.
              </P>
            </div>
          </Grid>
          <Grid>
            <P className="col-span-4">
              Deploy Large Language Models on concrete use cases in your company
              today.
            </P>
            <P className="col-span-4">
              Empower teams to tailor assistants to their needs, with the best
              models and internal company knowledge.
            </P>
            <P className="col-span-4">
              Maintain granular control over data access and with a safe and
              privacy-obsessed application.
            </P>
          </Grid>

          <Grid>
            <div
              className={classNames(
                defaultFlexClasses,
                "col-span-8 flex flex-col gap-4"
              )}
            >
              <H2>
                Get the state of the&nbsp;art,
                <br />
                today and&nbsp;tomorrow.
              </H2>
              <P variant="big">
                Dust gives you&nbsp;access to the&nbsp;
                <Strong>leading models</Strong>, and&nbsp; augments them
                with&nbsp;
                <Strong>your&nbsp;company’s internal&nbsp;information</Strong>.
              </P>
            </div>
          </Grid>
          <Grid>
            <P className="col-span-4">
              Proprietary and open-source models suited to your needs: OpenAI,
              Anthropic, Mistral, …
            </P>
            <P className="col-span-4">
              Your own knowledge base continuously in sync: Notion, Slack,
              GitHub, Google Drive, and more.
            </P>
            <P className="col-span-4">
              Modular and composable: Dust is deeply customizable to your exact
              needs and will evolve as those needs evolve.
            </P>
          </Grid>
          <Grid>
            <div
              className={classNames(
                defaultFlexClasses,
                "col-span-8 col-start-5 flex flex-col gap-4 text-right"
              )}
            >
              <h2 className={hClasses.h2}>
                Bring your&nbsp;team
                <br />
                up&nbsp;to&nbsp;speed.
              </h2>
              <p className={pClasses.big}>
                Moving to AI is a paradigm shift in your team’s workflow.
                <br />
                Dust{" "}
                <Strong>
                  spotlights your most creative and driven team members
                </Strong>{" "}
                and <Strong>spreads their findings</Strong> effortlessly
                throughout your&nbsp;organization.
              </p>
            </div>
          </Grid>
          <Grid>
            <P className="col-span-4">
              Seamlessly manage workspace invitations with SSO.
            </P>
            <P className="col-span-4">
              Allow assistants and teammates to collaborate across workflows to
              solve problems faster.
            </P>
            <P className="col-span-4">
              Learn from best practices to easily deploy assistants with
              specific data source specs and custom instructions for your use
              cases across functions.
            </P>
          </Grid>
        </div>
        <div
          ref={scrollRef1}
          className="mx-auto sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl"
        >
          <div className="mt-32">
            <div className="gap-8 md:grid md:grid-cols-8">
              <div className="flex flex-col justify-center self-center text-left md:col-span-4 md:pr-8">
                <div
                  className="mt-2"
                  style={{
                    filter: "drop-drop-shadow(0 10px 8px rgb(0 0 0 / 0.3))",
                  }}
                >
                  <div className="font-objektiv text-xl font-bold tracking-tighter text-red-400 md:text-2xl">
                    GPT-4 and all your internal knowledge, <br />
                    <span className="text-3xl text-rose-200 md:text-5xl">
                      combined
                    </span>
                    .
                  </div>
                  <p className="font-regular text-md mt-4 font-objektiv text-slate-300 md:text-lg">
                    Use Dust for unified and safe access to GPT-4.
                  </p>
                  <p className="font-regular text-md mt-4 font-objektiv text-slate-300 md:text-lg">
                    Connect Dust to your team’s data and break down knowledge
                    silos with always up-to-date answers
                    in&nbsp;a&nbsp;chat&nbsp;UI.
                  </p>
                </div>
                <div className="flex flex-1"></div>
              </div>
              <div className="mt-8 md:col-span-4 md:mt-0">
                <div className="z-10mx-auto overflow-hidden ">
                  <img
                    className="z-10 mx-auto w-[500px] rotate-2"
                    src="/static/landing_data_sources.png"
                  />
                </div>
              </div>
            </div>
          </div>

          <div ref={scrollRef2} className="mt-16">
            <div className="gap-8 md:grid md:grid-cols-8">
              <div className="order-1 flex flex-col justify-center self-center text-left md:order-2 md:col-span-4 md:pr-8">
                <div className="mt-2 flex-initial">
                  <div className="font-objektiv text-xl font-bold tracking-tighter text-emerald-500 md:text-2xl">
                    Get your teams <br />
                    <span className="text-3xl text-green-300 md:text-5xl">
                      up to speed
                    </span>{" "}
                    on AI.
                  </div>
                  <p className="font-regular text-md mt-4 font-objektiv text-slate-300 md:text-lg">
                    Let your team share prompts and conversations to ramp up on
                    the potential of generative AI for their tasks.
                  </p>
                  <p className="font-regular text-md mt-4 font-objektiv text-slate-300 md:text-lg">
                    Get suggestions from Dust on documentation updates and
                    improvements based on ongoing internal conversations and
                    decisions.
                  </p>
                </div>
                <div className="flex flex-1"></div>
              </div>
              <div className="order-2 mt-8 md:order-1 md:col-span-4 md:mt-0">
                <div className="mx-auto">
                  <img
                    className="mx-auto w-[500px] -rotate-2"
                    src="/static/landing_chat.png"
                  />
                </div>
              </div>
            </div>
          </div>

          <div ref={scrollRef3} className="mt-16">
            <div className="gap-8 md:grid md:grid-cols-8">
              <div className="flex flex-col justify-center self-center text-left md:col-span-4 md:pr-8">
                <div className="mt-2 flex-initial">
                  <div className="font-objektiv text-xl font-bold tracking-tighter text-blue-500 md:text-2xl">
                    Build your own <br />
                    <span className="text-3xl text-sky-300 md:text-5xl">
                      powerful workflows
                    </span>
                    .
                  </div>
                  <p className="font-regular text-md mt-4 font-objektiv text-slate-300 md:text-lg">
                    Build custom Large Language Model apps on top of your
                    company data. Let Dust assist you with the details of
                    working with LLMs as you adapt them to your specific needs.
                  </p>
                  <div className="mt-6">
                    <Link href="https://docs.dust.tt">
                      <Button
                        variant="tertiary"
                        size="sm"
                        label="View Documentation"
                      />
                    </Link>
                  </div>
                </div>
                <div className="flex flex-1"></div>
              </div>
              <div className="mt-8 md:col-span-4 md:mt-0">
                <div className="mx-auto">
                  <img
                    className="mx-auto w-[500px] rotate-2"
                    src="/static/landing_block.png"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="h-32"></div>

          <div className="grid grid-cols-1">
            <p className="font-objektiv text-3xl font-bold text-red-400">
              Our product
              <br />
              <span className="text-3xl text-rose-300 md:text-5xl">
                constitution
              </span>
            </p>
          </div>

          <div className="h-6"></div>

          <div className="grid gap-4 text-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="font-semibold text-slate-100">
                Augmenting humans, not&nbsp;replacing&nbsp;them
              </p>
              <div className="h-2"></div>
              <p className="font-regular text-slate-500">
                We're optimistic about making work life better for smart people.
                We're building R2-D2, not Skynet.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-100">
                Uncompromising on data security & privacy
              </p>
              <div className="h-2"></div>
              <p className="font-regular text-slate-500">
                We aspire to define standards rather than simply abide by
                the&nbsp;existing ones.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-100">
                Hard problems over hype
              </p>
              <div className="h-2"></div>
              <p className="font-regular text-slate-500">
                There's more to do than wrapping GPT into a chat UI. We're in
                this to solve hard problems on user experience and product
                quality.
              </p>
            </div>
            <div>
              <p className="font-semibold text-slate-100">
                Building with an&nbsp;AI&nbsp;core
              </p>
              <div className="h-2"></div>
              <p className="font-regular text-slate-500">
                We're building with large language models in mind from the
                ground up, rather than sprinkling them here and&nbsp;there.
              </p>
            </div>
          </div>

          <div className="h-32"></div>
        </div>

        <div className="mx-auto my-10 mt-32 max-w-3xl pb-8 text-center font-objektiv font-objektiv text-sm text-slate-500">
          Dust © 2022-2023 –{" "}
          <Link href="https://dust-tt.notion.site/Legal-Notice-58b453f74d634ef7bb807d29a59b3db1">
            Legal
          </Link>
          {" - "}
          <Link href="/website-privacy">Website Privacy</Link>
          {" - "}
          <Link href="/platform-privacy">Platform Privacy</Link>
          {" - "}
          <Link href="/terms">Terms</Link>
          {" - "}
          <Link href="https://dust-tt.notion.site/Cookie-Policy-ec63a7fb72104a7babff1bf413e2c1ec">
            Cookies
          </Link>
        </div>
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaTrackingId}`}
            strategy="afterInteractive"
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
             window.dataLayer = window.dataLayer || [];
             function gtag(){window.dataLayer.push(arguments);}
             gtag('js', new Date());

             gtag('config', '${gaTrackingId}');
            `}
          </Script>
        </>
      </main>
    </>
  );
}

const HeadComponent = () => {
  return (
    <Head>
      <title>
        Dust - Amplify your team's potential with customizable and secure AI
        assistants
      </title>
      <link rel="shortcut icon" href="/static/favicon.png" />

      <meta name="apple-mobile-web-app-title" content="Dust" />
      <link rel="apple-touch-icon" href="/static/AppIcon.png" />
      <link
        rel="apple-touch-icon"
        sizes="60x60"
        href="/static/AppIcon_60.png"
      />
      <link
        rel="apple-touch-icon"
        sizes="76x76"
        href="/static/AppIcon_76.png"
      />
      <link
        rel="apple-touch-icon"
        sizes="120x120"
        href="/static/AppIcon_120.png"
      />
      <link
        rel="apple-touch-icon"
        sizes="152x152"
        href="/static/AppIcon_152.png"
      />
      <link
        rel="apple-touch-icon"
        sizes="167x167"
        href="/static/AppIcon_167.png"
      />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/static/AppIcon_180.png"
      />
      <link
        rel="apple-touch-icon"
        sizes="192x192"
        href="/static/AppIcon_192.png"
      />
      <link
        rel="apple-touch-icon"
        sizes="228x228"
        href="/static/AppIcon_228.png"
      />

      <meta
        id="meta-description"
        name="description"
        content="Dust is an AI assistant that safely brings the best large language models, continuously updated company knowledge, powerful collaboration applications, and an extensible platform to your team's fingertips."
      />
      <meta
        id="og-title"
        property="og:title"
        content="Dust - Secure AI assistant with your company's knowledge"
      />
      <meta id="og-image" property="og:image" content="/static/og_image.png" />

      <link rel="stylesheet" href="https://use.typekit.net/lzv1deb.css"></link>
    </Head>
  );
};
