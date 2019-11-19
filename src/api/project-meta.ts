import * as assert from "assert";
import { Connection, RequestMethod } from "../connection";
import { StatusReply, statusReplyFromApi } from "../error";
import * as project from "../project-meta";
import * as user from "../user";
import {
  deleteUndefinedAndEmptyMembers,
  deleteUndefinedMembers,
  extractElementAsArray,
  extractElementIfPresent
} from "../util";
import { BaseProjectMeta, BaseRepository } from "./base-types";
import * as flag from "./flag";

/** Layout of a repository element as converted from OBS' API via xml2js */
interface BaseRepositoryApiReply {
  $: {
    name: string;
    rebuild?: string;
    block?: string;
    linkedbuild?: string;
  };
  arch?: string[];
  releasetarget?: project.ReleaseTargetApiReply[];
  path?: project.PathApiReply[];
}

function baseRepositoryFromApi(data: BaseRepositoryApiReply): BaseRepository {
  return deleteUndefinedAndEmptyMembers({
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
  });
}

function baseRepositoryToApi(repo: BaseRepository): BaseRepositoryApiReply {
  return deleteUndefinedMembers({
    $: deleteUndefinedMembers({
      block: repo.block,
      linkedbuild: repo.linkedbuild,
      name: repo.name,
      rebuild: repo.rebuild
    }),
    arch: repo.arch,
    path: repo.path?.map(pth => project.pathToApi(pth)),
    releasetarget: repo.releasetarget?.map(relTgt =>
      project.releaseTargetToApi(relTgt)
    )
  });
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
export interface ProjectMeta extends BaseProjectMeta {
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
  readonly repository?: BaseRepository[];
}

/**
 * @return the route to GET or PUT the project's _meta
 */
function metaRoute(name: string): string {
  return "/source/".concat(name, "/_meta");
}

/** Layout of the project configuration as received from OBS' API */
interface ProjectMetaApiReply {
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

function projectMetaFromApi(data: ProjectMetaApiReply): ProjectMeta {
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
  deleteUndefinedAndEmptyMembers(res);
  return res;
}

function projectMetaToApi(proj: ProjectMeta): ProjectMetaApiReply {
  const projApi: ProjectMetaApiReply = {
    project: {
      $: { name: proj.name, kind: proj.kind },
      title: proj.title,
      description: proj.description,
      access: flag.booleanToSimpleFlag(proj.access),
      build: flag.flagToApi(proj.build),
      debuginfo: flag.flagToApi(proj.debugInfo),
      group: proj.group?.map(grp => user.groupToApi(grp)),
      link: proj.link?.map(lnk => project.linkToApi(lnk)),
      lock: flag.booleanToSimpleFlag(proj.lock),
      mountproject: proj.mountProject,
      person: proj.person?.map(pers => user.userToApi(pers)),
      publish: flag.flagToApi(proj.publish),
      repository: proj.repository?.map(repo => baseRepositoryToApi(repo)),
      sourceaccess: flag.booleanToSimpleFlag(proj.sourceAccess),
      url: proj.url,
      useforbuild: flag.flagToApi(proj.useForBuild)
    }
  };

  deleteUndefinedAndEmptyMembers(projApi.project.$);
  deleteUndefinedAndEmptyMembers(projApi.project);

  return projApi;
}

/**
 *
 */
export async function getProjectMeta(
  conn: Connection,
  projName: string
): Promise<ProjectMeta> {
  const res = await conn.makeApiCall(metaRoute(projName));
  assert(
    res.project.$.name === projName,
    "Expected the received project name and the sent project name to be equal"
  );
  return projectMetaFromApi(res);
}

export async function modifyOrCreateProject(
  conn: Connection,
  proj: ProjectMeta
): Promise<StatusReply> {
  const resp = await conn.makeApiCall("/source/".concat(proj.name, "/_meta"), {
    method: RequestMethod.PUT,
    payload: projectMetaToApi(proj)
  });
  return statusReplyFromApi(resp);
}
