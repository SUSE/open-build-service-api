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

import * as assert from "assert";
import { Connection, RequestMethod } from "../connection";
import { StatusReply, statusReplyFromApi, StatusReplyApiReply } from "../error";
import {
  deleteUndefinedAndEmptyMembers,
  withoutUndefinedMembers,
  extractElementAsArray,
  extractElementIfPresent
} from "../util";
import * as baseTypes from "./base-types";
import * as flag from "./flag";

/** Project types */
export enum Kind {
  Standard = "standard",
  Maintenance = "maintenance",
  MaintenanceIncident = "maintenance_incident",
  MaintenanceRelease = "maintenance_release"
}

/** Layout of a repository element as converted from OBS' API via xml2js */
interface BaseRepositoryApiReply {
  $: {
    name: string;
    rebuild?: string;
    block?: string;
    linkedbuild?: string;
  };
  arch?: string[];
  releaseTarget?: baseTypes.ReleaseTargetApiReply[];
  path?: baseTypes.PathApiReply[];
}

function baseRepositoryFromApi(
  data: BaseRepositoryApiReply
): baseTypes.BaseRepository {
  return deleteUndefinedAndEmptyMembers({
    arch: extractElementAsArray(data, "arch"),
    block: extractElementIfPresent<baseTypes.BlockMode>(data.$, "block"),
    linkedBuild: extractElementIfPresent<baseTypes.LinkedBuildMode>(
      data.$,
      "linkedbuild"
    ),
    name: data.$.name,
    path: extractElementAsArray(data, "path", {
      construct: baseTypes.pathFromApi
    }),
    rebuild: extractElementIfPresent<baseTypes.RebuildMode>(data.$, "rebuild"),
    releaseTarget: extractElementAsArray(data, "releasetarget", {
      construct: baseTypes.releaseTargetFromApi
    })
  });
}

function baseRepositoryToApi(
  repo: baseTypes.BaseRepository
): BaseRepositoryApiReply {
  return withoutUndefinedMembers({
    $: withoutUndefinedMembers({
      block: repo.block,
      linkedbuild: repo.linkedBuild,
      name: repo.name,
      rebuild: repo.rebuild
    }),
    arch: repo.arch,
    path: repo.path?.map((pth) => baseTypes.pathToApi(pth)),
    releasetarget: repo.releaseTarget?.map((relTgt) =>
      baseTypes.releaseTargetToApi(relTgt)
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
export interface ProjectMeta
  extends baseTypes.CommonMeta,
    baseTypes.BaseProjectMeta {
  // <binarydownload> field is used for things...
  // No idea what for and according to Adrian it should be hidden better, so here we go ;-)
  // readonly binarydownload?: flag.Flag;

  /** repositories for this project */
  readonly repository?: baseTypes.BaseRepository[];
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
      kind?: Kind;
    };
    access?: flag.SimpleFlagApiReply;
    link?: baseTypes.LinkApiReply[];
    mountproject?: string;
    repository?: BaseRepositoryApiReply[];
  } & baseTypes.CommonMetaApiReply;
}

/**
 * Convert a reply from OBS' API that has been processed by xml2js into a
 * [[ProjectMeta]] object.
 *
 * @return A [[ProjectMeta]] converted from the received `data`. All elements of
 *     the resulting object that would be `undefined` or empty are removed
 *     before being returned.
 */
export function projectMetaFromApi(data: ProjectMetaApiReply): ProjectMeta {
  const access = extractElementIfPresent<boolean>(data.project, "access", {
    construct: flag.simpleFlagToBoolean
  });

  const res = {
    access,
    kind: extractElementIfPresent<Kind>(data.project.$, "kind"),
    link: extractElementAsArray<baseTypes.Link>(data.project, "link", {
      construct: baseTypes.linkFromApi
    }),

    mountProject: extractElementIfPresent<string>(data.project, "mountproject"),
    name: data.project.$.name,
    repository: extractElementAsArray(data.project, "repository", {
      construct: baseRepositoryFromApi
    }),
    ...baseTypes.commonMetaFromApi(data.project)
  };
  return deleteUndefinedAndEmptyMembers(res);
}

/**
 * Convert a [[ProjectMeta]] into an Object that can be converted via xml2js to
 * a form that is accepted by OBS' API.
 */
export function projectMetaToApi(proj: ProjectMeta): ProjectMetaApiReply {
  const projApi: ProjectMetaApiReply = {
    project: withoutUndefinedMembers({
      $: deleteUndefinedAndEmptyMembers({ name: proj.name, kind: proj.kind }),
      ...baseTypes.commonMetaToApi(proj),
      access: flag.booleanToSimpleFlag(proj.access),
      link: proj.link?.map((lnk) => baseTypes.linkToApi(lnk)),
      mountproject: proj.mountProject,
      repository: proj.repository?.map((repo) => baseRepositoryToApi(repo))
    })
  };

  return projApi;
}

/**
 *
 */
export async function fetchProjectMeta(
  con: Connection,
  projName: string
): Promise<ProjectMeta> {
  const res = await con.makeApiCall<ProjectMetaApiReply>(metaRoute(projName));
  assert(
    res.project.$.name === projName,
    "Expected the received project name and the sent project name to be equal"
  );
  return projectMetaFromApi(res);
}

export async function modifyProjectMeta(
  con: Connection,
  proj: ProjectMeta
): Promise<StatusReply> {
  return statusReplyFromApi(
    await con.makeApiCall<StatusReplyApiReply>(
      "/source/".concat(proj.name, "/_meta"),
      {
        method: RequestMethod.PUT,
        payload: projectMetaToApi(proj)
      }
    )
  );
}
