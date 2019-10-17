import { assert } from "console";
import { Connection } from "../connection";
import { Project, User } from "../obs";
import { extractElementAsArray, extractElementIfPresent } from "../util";
import { BaseProject, BaseRepository } from "./base_types";

// Representation of a FlagSwitch as extracted from OBS' API
type FlagSwitchApiReply =
  | {
      $: { repository?: string; arch?: Project.Arch };
    }
  | "";

// This class is used to indicate whether certain repositories for a certain
// arch have a feature enabled or disabled
interface FlagSwitch {
  repository?: string;
  arch?: Project.Arch;
}

function flagSwitchFromApi(data: FlagSwitchApiReply): FlagSwitch | undefined {
  return data === ""
    ? undefined
    : {
        arch: extractElementIfPresent<Project.Arch>(data.$, "arch"),
        repository: extractElementIfPresent<string>(data.$, "repository")
      };
}

const enum DefaultValue {
  Enable,
  Disable,
  Unspecified
}

// A Flag is used to indicate whether a certain feature is explictly enabled
// and/or disabled for certain repositories+architecture combinations.
//
// For example: debuginfo generation can be explicitly disabled for certain
// repositories => these would have a Flag with `enable = undefined` and
// `disable = [FlagSwitch({"RepoA", "SomeArch"})]`.
interface Flag {
  defaultValue: DefaultValue;
  enable: FlagSwitch[];
  disable: FlagSwitch[];
}

export function projectSettingFromFlag(
  repositoryName: string,
  architectures: Project.Arch[],
  flag?: Flag,
  defaultSetting?: boolean
): Map<Project.Arch, boolean | undefined> | boolean | undefined {
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

function flagFromApi(data: {
  enable?: FlagSwitchApiReply | FlagSwitchApiReply[];
  disable?: FlagSwitchApiReply | FlagSwitchApiReply[];
}): Flag {
  let defaultValue: DefaultValue = DefaultValue.Unspecified;

  const findGlobalSwitch = (
    flags?: FlagSwitchApiReply | FlagSwitchApiReply[]
  ) => {
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

function simpleFlagToBoolean(data: { enable?: {}; disable?: {} }): boolean {
  if (
    (data.enable !== undefined && data.disable !== undefined) ||
    (data.enable === undefined && data.disable === undefined)
  ) {
    throw new Error(`Invalid simple-flag-element received: ${data}`);
  }
  return data.enable !== undefined;
}

function parseRepositoryFromApi(data: {
  $: {
    name: string;
    rebuild?: string;
    block?: string;
    linkedbuild?: string;
  };
  arch: string[];
  releasetarget: {
    $: { project: string; repository: string; trigger?: string };
  };
  path: { $: { repository: string; project: string } };
}): BaseRepository {
  return {
    arch: extractElementAsArray(data, "arch", {
      construct: (data: Project.Arch): Project.Arch => data
    }),
    block: extractElementIfPresent<Project.BlockMode>(data.$, "block"),
    linkedbuild: extractElementIfPresent<Project.LinkedBuildMode>(
      data.$,
      "linkedbuild"
    ),
    name: data.$.name,
    path: extractElementAsArray(data, "path", {
      type: Project.Path
    }),
    rebuild: extractElementIfPresent<Project.RebuildMode>(data.$, "rebuild"),
    releasetarget: extractElementAsArray(data, "releasetarget", {
      type: Project.ReleaseTarget
    })
  };
}

export interface Project extends BaseProject {
  // building enabled/disabled for certain repositories
  readonly build?: Flag;
  // publishing of certain repositories enabled or disabled?
  readonly publish?: Flag;
  // useforbuild (build results from packages will be used to build other
  // packages in contrast to external dependencies) disabled?
  readonly useforbuild?: Flag;
  // debuginfo generation settings
  readonly debuginfo?: Flag;

  // <binarydownload> field is used for things...
  // No idea what for and according to Adrian it should be hidden better, so here we go ;-)
  // readonly binarydownload?: Flag;

  // repositories for this project
  readonly repository: BaseRepository[];
}
// return the route to GET or PUT the project's _meta
function metaRoute(name: string): string {
  return "/source/".concat(name, "/_meta");
}

export async function getProject(
  conn: Connection,
  projName: string
): Promise<Project> {
  const res = await conn.makeApiCall(metaRoute(projName));
  assert(
    res.project.$.name === projName,
    "Expected the received project name and the sent project name to be equal"
  );

  const lockElem:
    | { enable?: {}; disable?: {} }
    | undefined = extractElementIfPresent(res.project, "lock");

  const accessElem = extractElementIfPresent<boolean>(res.project, "access", {
    construct: simpleFlagToBoolean
  });
  const sourceAccessElem = extractElementIfPresent<boolean>(
    res.project,
    "sourceaccess",
    { construct: simpleFlagToBoolean }
  );

  const proj = {
    access: accessElem,
    build: extractElementIfPresent<Flag>(res.project, "build", {
      construct: flagFromApi
    }),
    created: extractElementIfPresent<string>(res.project, "created"),
    debuginfo: extractElementIfPresent<Flag>(res.project, "debuginfo", {
      construct: flagFromApi
    }),
    description: res.project.description,
    group: extractElementAsArray<User.Group>(res.project, "group", {
      type: User.Group
    }),

    kind: extractElementIfPresent<Project.Kind>(res.project, "kind"),
    link: extractElementAsArray<Project.Link>(res.project, "link", {
      type: Project.Link
    }),
    lock: lockElem === undefined ? false : simpleFlagToBoolean(lockElem),
    mountproject: extractElementIfPresent<string>(res.project, "mountproject"),
    name: projName,
    person: extractElementAsArray<User.User>(res.project, "person", {
      type: User.User
    }),
    publish: extractElementIfPresent<Flag>(res.project, "publish", {
      construct: flagFromApi
    }),
    repository: extractElementAsArray(res.project, "repository", {
      construct: parseRepositoryFromApi
    }),
    sourceAccess: sourceAccessElem,
    title: res.project.title,
    updated: extractElementIfPresent<string>(res.project, "updated"),
    url: extractElementIfPresent<string>(res.project, "url"),
    useforbuild: extractElementIfPresent<Flag>(res.project, "useforbuild", {
      construct: flagFromApi
    })
  };

  return proj;
}

export async function create(conn: Connection, proj: Project): Promise<any> {
  return conn.makeApiCall("/source/".concat(proj.name, "/_meta"), "PUT");
}

export async function getMeta(conn: Connection, proj: Project): Promise<any> {
  return conn.makeApiCall(metaRoute(proj.name));
}
