/**
 * Copyright (c) 2019 SUSE LLC
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

import { Connection } from "./connection";
import { Package } from "./package";
import { Project } from "./project";
import { dateFromUnixTimeStamp, deleteUndefinedMembers } from "./util";

/** A commit of a package on OBS */
export interface Revision {
  /** The number of this Revision */
  readonly revision: number;

  /**
   * Counter that is monotonically increasing for every version.
   *
   * The versionRevision (vrev on OBS) is maintained by the server and ensures a
   * strictly monotone increasing number for a given version. It consists of the
   * version parsed from the the build description and the checkin counter. The
   * checkin counter gets reset to zero if the new version did not exist
   * yet. Together with the build counter this forms the version-release of the
   * resulting binary.
   */
  readonly versionRevision: number;

  /** MD5 hash of this revision as identifier */
  readonly md5Hash: string;

  /**
   * Version (e.g. 1.5.0) of the package at this revision parsed from the source
   */
  readonly version?: string;

  /** Time at which this revision was committed */
  readonly commitTime: Date;

  /**
   * User ID of the user that committed this revision.
   *
   * Most commits *should* have a userId available, but in case accounts get
   * deleted this information is lost and then .
   */
  readonly userId?: string;

  /** A commit message of this revision, if present */
  readonly comment?: string;

  /**
   * If this revision was created by accepting a request, then the request's ID
   * is available in this field.
   */
  readonly requestId?: number;
}

interface RevisionApiReply {
  $: {
    rev: string;
    vrev: string;
  };
  srcmd5: string;
  version: string;
  time: number;
  user: string;
  comment?: string;
  requestid?: string;
}

interface RevisionListApiReply {
  revisionlist: { revision: RevisionApiReply[] };
}

const valueOrUndefined = (value: string) =>
  value === "unknown" ? undefined : value;

export async function fetchRevisions(
  con: Connection,
  projectName: string,
  packageName: string
): Promise<ReadonlyArray<Revision>>;

export async function fetchRevisions(
  con: Connection,
  proj: Project,
  pkg: Package
): Promise<ReadonlyArray<Revision>>;

/**
 * Fetch the revisions of the given package from the API.
 */
export async function fetchRevisions(
  con: Connection,
  proj: Project | string,
  pkg: Package | string
): Promise<ReadonlyArray<Revision>> {
  if (typeof proj !== "string") {
    if (proj.apiUrl !== con.url) {
      throw new Error(
        `The Project's API URL (${proj.apiUrl}) does not match the one of the Connection (${con.url})`
      );
    }
  }

  const projectName = typeof proj === "string" ? proj : proj.name;
  const packageName = typeof pkg === "string" ? pkg : pkg.name;

  const revs = (await con.makeApiCall(
    `/source/${projectName}/${packageName}/_history`
  )) as RevisionListApiReply;

  return Object.freeze(
    revs.revisionlist.revision.map(rev => {
      return deleteUndefinedMembers({
        revision: parseInt(rev.$.rev, 10),
        versionRevision: parseInt(rev.$.vrev, 10),
        md5Hash: rev.srcmd5,
        version: valueOrUndefined(rev.version),
        commitTime: dateFromUnixTimeStamp(rev.time),
        userId: valueOrUndefined(rev.user),
        comment: rev.comment,
        requestId:
          rev.requestid === undefined ? undefined : parseInt(rev.requestid, 10)
      });
    })
  );
}
