import { EnvironmentConfig } from "@dust-tt/types";

export const config = {
  getCurrentRegion: (): string => {
    return EnvironmentConfig.getEnvVariable("DUST_REGION");
  },
  getAlternativeRegionUrl: (): string => {
    return EnvironmentConfig.getEnvVariable("DUST_ALTERNATIVE_REGION_URL");
  },
  getLookupApiSecret: (): string => {
    return EnvironmentConfig.getEnvVariable("REGION_RESOLVER_SECRET");
  },
};
