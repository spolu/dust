import type { Ampli } from "@app/lib/amplitude/browser/generated";
import { ampli } from "@app/lib/amplitude/browser/generated";
import { AMPLITUDE_PUBLIC_API_KEY } from "@app/lib/amplitude/config";

let BROWSER_CLIENT: Ampli | null = null;

export function getBrowserClient() {
  if (BROWSER_CLIENT) {
    return BROWSER_CLIENT;
  }

  const disabled = !window.location.href.startsWith("https://dust.tt/");

  ampli.load({
    // The environment property is a depreacted value, but still needed by the SDK. We don't use it.
    environment: "dustprod",
    disabled: false,
    client: {
      apiKey: AMPLITUDE_PUBLIC_API_KEY,
      configuration: {
        defaultTracking: {
          attribution: true,
          fileDownloads: false,
          formInteractions: true,
          pageViews: false,
          sessions: true,
        },
      },
    },
  });
  BROWSER_CLIENT = ampli;

  return BROWSER_CLIENT;
}
