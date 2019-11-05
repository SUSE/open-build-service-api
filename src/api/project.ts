import { assert } from "console";
import { Connection } from "../connection";
import { Project } from "../obs";
import { Group, User, groupFromApi, userFromApi } from "../user";
import { extractElementAsArray, extractElementIfPresent } from "../util";
import { BaseProject, BaseRepository } from "./base_types";


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
    group: extractElementAsArray<Group>(res.project, "group", {
      construct: groupFromApi
    }),

    kind: extractElementIfPresent<Project.Kind>(res.project, "kind"),
    link: extractElementAsArray<Project.Link>(res.project, "link", {
      type: Project.Link
    }),
    lock: lockElem === undefined ? false : simpleFlagToBoolean(lockElem),
    mountproject: extractElementIfPresent<string>(res.project, "mountproject"),
    name: projName,
    person: extractElementAsArray<User>(res.project, "person", {
      construct: userFromApi
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
