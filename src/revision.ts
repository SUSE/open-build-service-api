import { Connection } from "./connection";
import { Package } from "./package";
import { Project } from "./project";
import { deleteUndefinedMembers, dateFromUnixTimeStamp } from "./util";

/** A commit of a package on OBS */
export interface Revision {
  /** The number of this Revision */
  revision: number;

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
  versionRevision: number;

  /** MD5 hash of this revision as identifier */
  md5Hash: string;

  /**
   * Version (e.g. 1.5.0) of the package at this revision parsed from the source
   */
  version?: string;

  /** Time at which this revision was committed */
  commitTime: Date;

  /**
   * User ID of the user that committed this revision.
   *
   * Most commits *should* have a userId available, but in case accounts get
   * deleted this information is lost and then .
   */
  userId?: string;

  /** A commit message of this revision, if present */
  comment?: string;

  /**
   * If this revision was created by accepting a request, then the request's ID
   * is available in this field.
   */
  requestId?: number;
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
): Promise<Revision[]>;

export async function fetchRevisions(
  con: Connection,
  proj: Project,
  pkg: Package
): Promise<Revision[]>;

/**
 * Fetch the revisions of the given package from the API.
 */
export async function fetchRevisions(
  con: Connection,
  proj: Project | string,
  pkg: Package | string
): Promise<Revision[]> {
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

  return revs.revisionlist.revision.map(rev => {
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
  });
}
