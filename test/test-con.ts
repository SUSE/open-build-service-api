"use strict";

import { Connection } from "../src/connection";

const envOrDefault = (envVar: string, defaultValue: string): string => {
  const envVarVal = process.env[envVar];
  return envVarVal === undefined ? defaultValue : envVarVal;
};

export const enum ApiType {
  Production = "https://api.opensuse.org",
  Staging = "https://api-test.opensuse.org"
}

export function getTestConnection(
  apiType: ApiType = ApiType.Staging
): Connection {
  return new Connection(
    envOrDefault("OBS_USERNAME", "fakeUsername"),
    envOrDefault("OBS_PASSWORD", "fakePassword"),
    apiType
  );
}
