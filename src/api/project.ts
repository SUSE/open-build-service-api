import * as assert from "assert";
import { Connection, RequestMethod } from "../connection";
import { StatusReply, statusReplyFromApi } from "../error";
import * as project from "../project";
import * as user from "../user";
import {
  extractElementAsArray,
  extractElementIfPresent,
  setPropertyIfDefined,
  setPropertyOnCondition,
  deleteUndefinedMembers
} from "../util";
import { BaseProject, BaseRepository } from "./base_types";
import * as flag from "./flag";

/** Layout of a repository element as converted from OBS' API via xml2js */
interface BaseRepositoryApiReply {
  $: {
    name: string;
    rebuild?: string;
    block?: string;
    linkedbuild?: string;
  };
  arch: string[];
  releasetarget: project.ReleaseTargetApiReply[];
  path: project.PathApiReply[];
}

function baseRepositoryFromApi(data: BaseRepositoryApiReply): BaseRepository {
  return {
    arch: extractElementAsArray(data, "arch"),
    block: extractElementIfPresent<project.BlockMode>(data.$, "block"),
    linkedbuild: extractElementIfPresent<project.LinkedBuildMode>(
      data.$,
      "linkedbuild"
    ),
    name: data.$.name,
    path: extractElementAsArray(data, "path", {
      construct: project.pathFromApi
    }),
    rebuild: extractElementIfPresent<project.RebuildMode>(data.$, "rebuild"),
    releasetarget: extractElementAsArray(data, "releasetarget", {
      construct: project.releaseTargetFromApi
    })
  };
}

function baseRepositoryToApi(repo: BaseRepository): BaseRepositoryApiReply {
  return {
    $: {
      block: repo.block,
      linkedbuild: repo.linkedbuild,
      name: repo.name,
      rebuild: repo.rebuild
    },
    arch: repo.arch,
    path: repo.path.map(pth => project.pathToApi(pth)),
    releasetarget: repo.releasetarget.map(relTgt =>
      project.releaseTargetToApi(relTgt)
    )
  };
}

/**
 * Representation of a project on OBS
 *
 * This interface is very closely mimicking the way how the data are expected by
 * OBS' API and is thus relatively ugly to use in practice (e.g. the
 * [[debugInfo]], [[useForBuild]], etc. settings are configured externally from
 * the actual repository). This is merely an intermediate state that is used to
 * convert it to a more useful form later.
 */
export interface Project extends BaseProject {
  /** building enabled/disabled for certain repositories */
  readonly build?: flag.Flag;

  /** publishing of certain repositories enabled or disabled? */
  readonly publish?: flag.Flag;

  /**
   * useforbuild (build results from packages will be used to build other
   * packages in contrast to external dependencies) disabled?
   */
  readonly useForBuild?: flag.Flag;

  /** debuginfo generation settings */
  readonly debugInfo?: flag.Flag;

  // <binarydownload> field is used for things...
  // No idea what for and according to Adrian it should be hidden better, so here we go ;-)
  // readonly binarydownload?: flag.Flag;

  /** repositories for this project */
  readonly repository: BaseRepository[];
}

/**
 * @return the route to GET or PUT the project's _meta
 */
function metaRoute(name: string): string {
  return "/source/".concat(name, "/_meta");
}

/** Layout of the project configuration as received from OBS' API */
interface ProjectApiReply {
  project: {
    $: {
      name: string;
      kind?: project.Kind;
    };
    access?: flag.SimpleFlagApiReply;
    build?: flag.FlagApiReply;
    debuginfo?: flag.FlagApiReply;
    description: string;
    group?: user.GroupApiReply[];
    link?: project.LinkApiReply[];
    lock?: flag.SimpleFlagApiReply;
    mountproject?: string;
    person?: user.UserApiReply[];
    publish?: flag.FlagApiReply;
    repository?: BaseRepositoryApiReply[];
    sourceaccess?: flag.SimpleFlagApiReply;
    title: string;
    url?: string;
    useforbuild?: flag.FlagApiReply;
  };
}

function projectFromApi(data: ProjectApiReply): Project {
  const lock = extractElementIfPresent(data.project, "lock", {
    construct: flag.simpleFlagToBoolean
  });

  const access = extractElementIfPresent<boolean>(data.project, "access", {
    construct: flag.simpleFlagToBoolean
  });
  const sourceAccessElem = extractElementIfPresent<boolean>(
    data.project,
    "sourceaccess",
    { construct: flag.simpleFlagToBoolean }
  );

  const res = {
    access,
    build: extractElementIfPresent<flag.Flag>(data.project, "build", {
      construct: flag.flagFromApi
    }),
    debugInfo: extractElementIfPresent<flag.Flag>(data.project, "debuginfo", {
      construct: flag.flagFromApi
    }),
    description: data.project.description,
    group: extractElementAsArray<user.Group>(data.project, "group", {
      construct: user.groupFromApi
    }),
    kind: extractElementIfPresent<project.Kind>(data.project.$, "kind"),
    link: extractElementAsArray<project.Link>(data.project, "link", {
      construct: project.linkFromApi
    }),
    lock,
    mountProject: extractElementIfPresent<string>(data.project, "mountproject"),
    name: data.project.$.name,
    person: extractElementAsArray<user.User>(data.project, "person", {
      construct: user.userFromApi
    }),
    publish: extractElementIfPresent<flag.Flag>(data.project, "publish", {
      construct: flag.flagFromApi
    }),
    repository: extractElementAsArray(data.project, "repository", {
      construct: baseRepositoryFromApi
    }),
    sourceAccess: sourceAccessElem,
    title: data.project.title,
    url: extractElementIfPresent<string>(data.project, "url"),
    useForBuild: extractElementIfPresent<flag.Flag>(
      data.project,
      "useforbuild",
      {
        construct: flag.flagFromApi
      }
    )
  };
  deleteUndefinedMembers(res);
  return res;
}

function projectToApi(proj: Project): ProjectApiReply {
  const projApi: ProjectApiReply = {
    project: {
      $: { name: proj.name, kind: proj.kind },
      title: proj.title,
      description: proj.description
    }
  };
  setPropertyIfDefined(
    projApi.project,
    "access",
    flag.booleanToSimpleFlag(proj.access)
  );
  setPropertyIfDefined(projApi.project, "build", flag.flagToApi(proj.build));
  setPropertyIfDefined(
    projApi.project,
    "debuginfo",
    flag.flagToApi(proj.debugInfo)
  );
  setPropertyIfDefined(
    projApi.project,
    "group",
    proj.group?.map(grp => user.groupToApi(grp))
  );
  setPropertyIfDefined(
    projApi.project,
    "link",
    proj.link?.map(lnk => project.linkToApi(lnk))
  );
  setPropertyIfDefined(
    projApi.project,
    "lock",
    flag.booleanToSimpleFlag(proj.lock)
  );
  setPropertyIfDefined(projApi.project, "mountproject", proj.mountProject);
  setPropertyIfDefined(
    projApi.project,
    "person",
    proj.person?.map(pers => user.userToApi(pers))
  );
  setPropertyIfDefined(
    projApi.project,
    "publish",
    flag.flagToApi(proj.publish)
  );
  setPropertyOnCondition(
    projApi.project,
    "repository",
    proj.repository.map(repo => baseRepositoryToApi(repo)),
    proj.repository.length > 0
  );
  setPropertyIfDefined(
    projApi.project,
    "sourceaccess",
    flag.booleanToSimpleFlag(proj.sourceAccess)
  );
  setPropertyIfDefined(projApi.project, "url", proj.url);
  setPropertyIfDefined(
    projApi.project,
    "useforbuild",
    flag.flagToApi(proj.useForBuild)
  );

  return projApi;
}

/**
 *
 */
export async function getProject(
  conn: Connection,
  projName: string
): Promise<Project> {
  const res = await conn.makeApiCall(metaRoute(projName));
  assert(
    res.project.$.name === projName,
    "Expected the received project name and the sent project name to be equal"
  );
  return projectFromApi(res);
}

export async function modifyOrCreateProject(
  conn: Connection,
  proj: Project
): Promise<StatusReply> {
  const resp = await conn.makeApiCall("/source/".concat(proj.name, "/_meta"), {
    method: RequestMethod.PUT,
    payload: projectToApi(proj)
  });
  return statusReplyFromApi(resp);
}
