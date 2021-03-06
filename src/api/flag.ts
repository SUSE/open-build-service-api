/**
 * Copyright (c) 2019-2020 SUSE LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * This module contains functions to handle the simple-flag-element and
 * flag-element from OBS API and convert them into more usable forms.
 *
 * See: https://build.opensuse.org/apidocs/obs.rng for their definition in the
 * schema.
 */

import * as assert from "assert";
import { inspect } from "util";
import {
  extractElementAsArray,
  extractElementIfPresent,
  withoutUndefinedMembers
} from "../util";
import { Arch } from "./base-types";

/** Representation of a FlagSwitch as extracted from OBS' API */
export type FlagSwitchApiReply =
  | {
      $?: { repository?: string; arch?: Arch };
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

function flagSwitchFromApi(data: FlagSwitchApiReply): FlagSwitch | undefined {
  return data === ""
    ? undefined
    : withoutUndefinedMembers({
        arch: extractElementIfPresent<Arch>(data.$, "arch"),
        repository: extractElementIfPresent<string>(data.$, "repository")
      });
}

function flagSwitchToApi(flagSwitch: FlagSwitch): FlagSwitchApiReply {
  const inner: FlagSwitch = {};
  if (flagSwitch.repository !== undefined) {
    inner.repository = flagSwitch.repository;
  }
  if (flagSwitch.arch !== undefined) {
    inner.arch = flagSwitch.arch;
  }
  return { $: inner };
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
  // FIXME: make this field optional
  disable: FlagSwitch[];
  // FIXME: make this field optional
  enable: FlagSwitch[];
}

export interface FlagApiReply {
  enable?: FlagSwitchApiReply | FlagSwitchApiReply[];
  disable?: FlagSwitchApiReply | FlagSwitchApiReply[];
}

/** Converts the reply from OBS' API to a [[Flag]] interface */
export function flagFromApi(data: FlagApiReply | undefined): Flag | undefined {
  if (data === undefined) {
    return undefined;
  }

  let defaultValue: DefaultValue = DefaultValue.Unspecified;

  const findGlobalSwitch = (
    flags?: FlagSwitchApiReply | FlagSwitchApiReply[]
  ): boolean => {
    if (flags === undefined) {
      return false;
    }
    if (Array.isArray(flags)) {
      return flags.find((elem) => elem === "") !== undefined;
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
    assert(
      (defaultValue = DefaultValue.Unspecified),
      "flagFromApi: defaultValue must be Unspecified as a default disable was found"
    );
    defaultValue = DefaultValue.Disable;
  }

  const extractEnableDisable = (key: "enable" | "disable"): FlagSwitch[] => {
    return data[key] !== undefined && data[key] !== ""
      ? (extractElementAsArray<FlagSwitch | undefined>(data, key, {
          construct: flagSwitchFromApi
        }).filter((elem) => elem !== undefined) as FlagSwitch[])
      : [];
  };

  return {
    defaultValue,
    disable: extractEnableDisable("disable"),
    enable: extractEnableDisable("enable")
  };
}

/** Converts a [[Flag]] back to the form that OBS' API expects */
export function flagToApi(flag: Flag | undefined): FlagApiReply | undefined {
  if (flag === undefined) {
    return undefined;
  }

  // start out with an empty array so that the default value is always at the
  // beginning
  const disable: FlagSwitchApiReply[] = [];
  const enable: FlagSwitchApiReply[] = [];

  // add the default value if specified
  switch (flag.defaultValue) {
    case DefaultValue.Enable:
      enable.push("");
      break;
    case DefaultValue.Disable:
      disable.push("");
      break;
    case DefaultValue.Unspecified:
      break;
  }

  // now add the actual flags
  flag.disable.forEach((flagSwitch) => {
    disable.push(flagSwitchToApi(flagSwitch));
  });
  flag.enable.forEach((flagSwitch) => {
    enable.push(flagSwitchToApi(flagSwitch));
  });

  // - only include enable/disable with more than 1 element as arrays,
  // - single element enable/disable are included as the element only,
  // - enable/disable without elements are omitted
  const res: FlagApiReply = {};
  if (enable.length === 1) {
    res.enable = enable[0];
  } else if (enable.length > 1) {
    res.enable = enable;
  }

  if (disable.length === 1) {
    res.disable = disable[0];
  } else if (disable.length > 1) {
    res.disable = disable;
  }
  return res;
}

/**
 * A repository setting like [[CommonMeta.build]], [[CommonMeta.useForBuild]],
 * [[CommonMeta.debugInfo]], etc without any defaults applied with the following
 * possible types:
 *
 * - `undefined`: no setting has been applied in the project configuration (and
 *   OBS' default applies)
 * - boolean: this value applies to all architectures
 * - `Map<Arch, boolean | undefined>`: each architecture of the repository must
 *   be present as a key and the corresponding value is the setting for this
 *   architecture
 */
export type RepositorySettingWithoutDefaults =
  | Map<Arch, boolean | undefined>
  | boolean
  | undefined;

/**
 * Same as [[RepositorySettingWithoutDefaults]] but with defaults applied, so
 * none of the values are allowed to be `undefined`.
 */
export type RepositorySetting = Map<Arch, boolean> | boolean;

/**
 * Replace all undefined values in `repoSettings` with `defaultValue`
 */
export function applyDefaultSetting(
  repoSettings: RepositorySettingWithoutDefaults,
  defaultValue: boolean,
  allArchitectures?: Arch[]
): RepositorySetting {
  if (repoSettings === undefined) {
    return defaultValue;
  } else if (typeof repoSettings === "boolean") {
    return repoSettings;
  } else {
    assert(repoSettings instanceof Map, "repoSettings must be a Map");
    repoSettings.forEach((v, k) => {
      if (v === undefined) {
        repoSettings.set(k, defaultValue);
      }
    });
    (allArchitectures ?? []).forEach((arch) => {
      if (!repoSettings.has(arch)) {
        repoSettings.set(arch, defaultValue);
      }
    });
    assert(
      [...repoSettings.values()].reduce(
        (prev, cur) => prev && cur !== undefined,
        true
      ),
      `All values of the repositorySetting must be defined, but got ${[
        ...repoSettings.values()
      ]
        .map((v) => v ?? "undefined")
        .join(", ")}`
    );

    return repoSettings as Map<Arch, boolean>;
  }
}

/**
 * If the [[Arch]] => setting map contains only the same values, then this value
 * is returned. Otherwise `repoSettingMap` is returned.
 */
export function simplifyRepositorySetting(
  repoSettingMap: Map<Arch, boolean | undefined>
): RepositorySettingWithoutDefaults {
  const values = [...repoSettingMap.values()];
  if (repoSettingMap.size === 1) {
    return values[0];
  }

  assert(repoSettingMap.size > 1);
  let allEqual = false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] === values[0]) {
      allEqual = true;
    } else {
      allEqual = false;
      break;
    }
  }

  return allEqual ? values[0] : repoSettingMap;
}

export interface RepositorySettingFromFlagDefault {
  defaultSetting?: boolean;
}

export function repositorySettingFromFlag(
  repositoryName: string,
  architectures: Arch[],
  flag: Flag | undefined,
  options: RepositorySettingFromFlagDefault & { defaultSetting: true }
): RepositorySetting;

export function repositorySettingFromFlag(
  repositoryName: string,
  architectures: Arch[],
  flag: Flag | undefined,
  options?: RepositorySettingFromFlagDefault
): RepositorySettingWithoutDefaults;

/**
 * Extracts the repository setting given the [[Flag]].
 *
 * @param repositoryName  The name of the repository for which the settings should
 *     be extracted.
 * @param architectures  All architectures that apply to this repository.
 * @param flag  The [[Flag]] which was received from OBS which should be
 *     converted into a [[RepositorySetting]].
 * @param defaultSetting  A default that will be used for architectures which
 *     have no specific setting.
 *
 * @return The per architecture settings for the repository with the given name
 *     as extracted from the flag or the default.
 */
export function repositorySettingFromFlag(
  repositoryName: string,
  architectures: Arch[],
  flag: Flag | undefined,
  { defaultSetting }: { defaultSetting?: boolean } = {}
): RepositorySettingWithoutDefaults | RepositorySetting {
  // default value to be set/returned when no value can be determined:
  // use the defaultSetting if flag is undefined or defaulValue is Unspecified
  // otherwise true/false for Enable/Disable
  let globalDefault =
    flag !== undefined
      ? flag.defaultValue === DefaultValue.Unspecified
        ? defaultSetting
        : flag.defaultValue === DefaultValue.Enable
      : defaultSetting;

  // if flag is undefined => duno, have to return the default
  if (flag === undefined) {
    return globalDefault;
  }

  // enable & disable matching for this repo
  // this also includes enable/disable entries without a repository set (this
  // means that the architecture is globally disabled/enabled)
  const matchingDisable = flag.disable.filter(
    (flg) => flg.repository === repositoryName || flg.repository === undefined
  );
  const matchingEnable = flag.enable.filter(
    (flg) => flg.repository === repositoryName || flg.repository === undefined
  );

  // if enable and disable are empty => the default it is again
  if (matchingDisable.length === 0 && matchingEnable.length === 0) {
    return globalDefault;
  }

  const res = new Map<Arch, boolean | undefined>();

  const matchesAndDefault: {
    matches: FlagSwitch[];
    value: boolean;
  }[] = [
    { matches: matchingEnable, value: true },
    { matches: matchingDisable, value: false }
  ];

  // check each matching <enable>/<disable>:
  // - no arch field? => take this as the new "global" default
  // - arch field? => put it in the Map, but only if the architecture is
  //   actually one of those in architectures
  for (const { matches, value } of matchesAndDefault) {
    if (matches.length === 1 && matches[0].arch === undefined) {
      globalDefault = value;
    } else {
      for (const flg of matches) {
        if (
          architectures.find((arch) => arch === flg.arch) !== undefined &&
          flg.arch !== undefined
        ) {
          res.set(flg.arch, value);
        }
      }
    }
  }

  // do we have per arch settings?
  // => fill in the remaining arches with the global default
  architectures.forEach((arch) => {
    if (!res.has(arch)) {
      res.set(arch, globalDefault);
    }
  });

  if (res.size === 0) {
    return globalDefault;
  }

  return simplifyRepositorySetting(res);
}

export function repositorySettingToFlag(
  repoSettings: [string, RepositorySettingWithoutDefaults][],
  //  architectures: Arch[],
  defaultSetting?: boolean
): Flag | undefined {
  if (repoSettings.length === 0) {
    return undefined;
  }

  const disable: FlagSwitch[] = [];
  const enable: FlagSwitch[] = [];

  const pushFlagSwitchIfNotDefault = (
    flagSwitch: FlagSwitch,
    enableDisable: boolean
  ): void => {
    if (enableDisable) {
      if (defaultSetting === undefined || !defaultSetting) {
        enable.push(flagSwitch);
      }
    } else {
      if (defaultSetting === undefined || defaultSetting) {
        disable.push(flagSwitch);
      }
    }
  };

  for (const [repoName, repoSetting] of repoSettings) {
    if (repoSetting === undefined) {
      continue;
    }

    if (typeof repoSetting === "boolean") {
      const flagSwitch = { repository: repoName };
      pushFlagSwitchIfNotDefault(flagSwitch, repoSetting);
      continue;
    }

    assert(repoSetting instanceof Map, "repoSetting is expected to be a Map");

    repoSetting.forEach((enableDisable, arch) => {
      if (enableDisable !== undefined) {
        const flagSwitch = { arch, repository: repoName };
        pushFlagSwitchIfNotDefault(flagSwitch, enableDisable);
      }
    });
  }

  // FIXME: need to do some cleanup here, e.g. when one arch is universally
  // disabled => drop all per repo disables and add { repository: undefined,
  // arch: disabledArch } instead
  return {
    defaultValue:
      defaultSetting === undefined
        ? DefaultValue.Unspecified
        : defaultSetting
        ? DefaultValue.Enable
        : DefaultValue.Disable,
    disable,
    enable
  };
}

/** A boolean flag (see: https://build.opensuse.org/apidocs/obs.rng) */
export interface SimpleFlagApiReply {
  enable?: unknown;
  disable?: unknown;
}

/**
 * Convert a [[SimpleFlagApiReply]] to a boolean.
 */
export function simpleFlagToBoolean(data: SimpleFlagApiReply): boolean {
  if (
    (data.enable !== undefined && data.disable !== undefined) ||
    (data.enable === undefined && data.disable === undefined)
  ) {
    throw new Error(`Invalid simple-flag-element received: ${inspect(data)}`);
  }
  return data.enable !== undefined;
}

/**
 * Converts a boolean back to a [[SimpleFlagApiReply]]
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
