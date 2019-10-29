"use strict";

import { Connection } from "../src/connection";

const envOrDefault = (envVar: string, defaultValue: string): string => {
  const envVarVal = process.env[envVar];
  return envVarVal === undefined ? defaultValue : envVarVal;
};

export function getTestConnection(): Connection {
  return new Connection(
    envOrDefault("OBS_USERNAME", "fakeUsername"),
    envOrDefault("OBS_PASSWORD", "fakePassword")
  );
}
