/**
 * This module contains functions to handle the simple-flag-element and
 * flag-element from OBS API and convert them into more usable forms.
 *
 * See: https://build.opensuse.org/apidocs/obs.rng for their definition in the
 * schema.
 */

"use strict";

import { extractElementIfPresent, extractElementAsArray } from "../util";
import { Arch } from "../project";
import { assert } from "console";

/** Representation of a FlagSwitch as extracted from OBS' API */
export type FlagSwitchApiReply =
  | {
      $: { repository?: string; arch?: Arch };
    }
  | "";

/**
 * This collection is used to indicate whether certain repositories for a
 * certain arch have a feature enabled or disabled.
 */
export interface FlagSwitch {
  repository?: string;
  arch?: Arch;
}

export function flagSwitchFromApi(
  data: FlagSwitchApiReply
): FlagSwitch | undefined {
  return data === ""
    ? undefined
    : {
        arch: extractElementIfPresent<Arch>(data.$, "arch"),
        repository: extractElementIfPresent<string>(data.$, "repository")
      };
}

export function flagSwitchToApi(
  flagSwitch: FlagSwitch | undefined
): FlagSwitchApiReply {
  if (flagSwitch === undefined) {
    return "";
  }
  return {
    $: { ...flagSwitch }
  };
}

export const enum DefaultValue {
  Enable,
  Disable,
  Unspecified
}

/**
 * A Flag is used to indicate whether a certain feature is explictly enabled
 * and/or disabled for certain repositories+architecture combinations.
 *
 * For example: debuginfo generation can be explicitly disabled for certain
 * repositories => these would have a Flag with `enable = undefined` and
 * `disable = [FlagSwitch({"RepoA", "SomeArch"})]`.
 */
export interface Flag {
  defaultValue: DefaultValue;
  disable: FlagSwitch[];
  enable: FlagSwitch[];
}

export interface FlagApiReply {
  enable?: FlagSwitchApiReply | FlagSwitchApiReply[];
  disable?: FlagSwitchApiReply | FlagSwitchApiReply[];
}

/** Converts the reply from OBS' API to a [[Flag]] interface */
export function flagFromApi(data: FlagApiReply): Flag {
  let defaultValue: DefaultValue = DefaultValue.Unspecified;

  const findGlobalSwitch = (
    flags?: FlagSwitchApiReply | FlagSwitchApiReply[]
  ): boolean => {
    if (flags === undefined) {
      return false;
    }
    if (Array.isArray(flags)) {
      return flags.find(elem => elem === "") !== undefined;
    }
    return flags === "";
  };

  if (findGlobalSwitch(data.enable) && findGlobalSwitch(data.disable)) {
    throw new Error(
      "Invalid flag: both 'enable' and 'disable' are the default"
    );
  }

  if (findGlobalSwitch(data.enable)) {
    defaultValue = DefaultValue.Enable;
  }
  if (findGlobalSwitch(data.disable)) {
    assert((defaultValue = DefaultValue.Unspecified));
    defaultValue = DefaultValue.Disable;
  }

  const extractEnableDisable = (key: "enable" | "disable"): FlagSwitch[] => {
    return data[key] !== undefined && data[key] !== ""
      ? (extractElementAsArray<FlagSwitch | undefined>(data, key, {
          construct: flagSwitchFromApi
        }).filter(elem => elem !== undefined) as FlagSwitch[])
      : [];
  };

  return {
    defaultValue,
    disable: extractEnableDisable("disable"),
    enable: extractEnableDisable("enable")
  };
}

// export function flagToApi(flag: Flag): FlagApiReply {}

export function projectSettingFromFlag(
  repositoryName: string,
  architectures: Arch[],
  flag?: Flag,
  defaultSetting?: boolean
): Map<Arch, boolean | undefined> | boolean | undefined {
  // default value to be set/returned when no value can be determined:
  // use the defaultSetting if flag is undefined or defaulValue is Unspecified
  // otherwise true/false for Enable/Disable
  const globalDefault =
    flag !== undefined
      ? flag.defaultValue === DefaultValue.Unspecified
        ? defaultSetting
        : flag.defaultValue === DefaultValue.Enable
      : defaultSetting;

  // if flag is undefined => duno, have to return the default
  if (flag === undefined) {
    return globalDefault;
  }

  const matchingDisable = flag.disable.filter(
    flg => flg.repository === repositoryName
  );
  const matchingEnable = flag.enable.filter(
    flg => flg.repository === repositoryName
  );

  // if enable and disable are empty => the default it is again
  if (matchingDisable.length === 0 && matchingEnable.length === 0) {
    return globalDefault;
  }

  const res = new Map();

  const matchesAndDefault: Array<{
    match: FlagSwitch[];
    value: boolean;
  }> = [
    { match: matchingEnable, value: true },
    { match: matchingDisable, value: false }
  ];

  // check each matching <enable>/<disable>:
  // no arch field? => return true/false directly
  // arch field? => put it in the Map
  for (const { match, value } of matchesAndDefault) {
    for (const flg of match) {
      if (flg.repository === repositoryName) {
        if (flg.arch === undefined) {
          return value;
        } else {
          res.set(flg.arch, value);
        }
      }
    }
  }

  // do we have per arch settings?
  // => fill in the remaining arches with the global default
  architectures.forEach(arch => {
    if (!res.has(arch)) {
      res.set(arch, globalDefault);
    }
  });

  return res;
}

/** A boolean flag (see: https://build.opensuse.org/apidocs/obs.rng) */
export interface SimpleFlagApiReply {
  enable?: {};
  disable?: {};
}

/**
 * Convert a [[SimpleFlagElement]] to a boolean.
 */
export function simpleFlagToBoolean(data: SimpleFlagApiReply): boolean {
  if (
    (data.enable !== undefined && data.disable !== undefined) ||
    (data.enable === undefined && data.disable === undefined)
  ) {
    throw new Error(`Invalid simple-flag-element received: ${data}`);
  }
  return data.enable !== undefined;
}

/**
 * Converts a boolean back to a [[SimpleFlagElement]]
 *
 * If `val` is undefined, then undefined is returned as well.
 */
export function booleanToSimpleFlag(
  val: boolean | undefined
): SimpleFlagApiReply | undefined {
  if (val === undefined) {
    return undefined;
  }
  return val ? { enable: {} } : { disable: {} };
}
