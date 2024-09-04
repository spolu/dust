import "@app/styles/global.css";
import "@dust-tt/sparkle/dist/sparkle.css";
import "@app/styles/components.css";

import type { NextPage } from "next";
import type { AppProps } from "next/app";

import RootLayout from "@app/components/app/RootLayout";

export type NextPageWithLayout<P = unknown, IP = P> = NextPage<P, IP> & {
  getLayout?: (
    page: React.ReactElement,
    pageProps: AppProps
  ) => React.ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

export default function App({ Component, pageProps }: AppPropsWithLayout) {
  // Use the layout defined at the page level, if available.
  const getLayout = Component.getLayout ?? ((page) => page);

  return getLayout(
    <RootLayout>
      <Component {...pageProps} />
    </RootLayout>,
    pageProps
  );
}
