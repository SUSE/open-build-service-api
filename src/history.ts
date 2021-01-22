/**
 * Copyright (c) 2020 SUSE LLC
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
import { Directory, fetchDirectory } from "./api/directory";
import { Connection } from "./connection";
import { isApiError } from "./error";
import { PackageFile } from "./file";
import { fetchFileList, fileListFromDirectory, Package } from "./package";
import {
  dateFromUnixTimeStamp,
  withoutUndefinedMembers,
  mapOrApply,
  runProcess
} from "./util";

interface BaseCommit {
  /** The md5 hash of this revision */
  readonly revisionHash: string;

  /** The message describing this commit */
  readonly commitMessage?: string;

  /**
   * The request number that resulted in this commit. Only present if an
   * accepted request created this commit, otherwise `undefined`.
   */
  readonly requestId?: number;

  /** The user that created this commit */
  readonly userId?: string;

  /** Timestamp when this commit was created */
  readonly commitTime: Date;

  /** Name of the project from where this commit comes from */
  readonly projectName: string;

  /** Name of the package from which this commit comes from */
  readonly packageName: string;

  /**
   * Version (e.g. 1.5.0) of the package at this revision parsed from the source
   */
  readonly version?: string;

  /** Revision number of the unexpanded commit */
  readonly revision: number;

  /**
   * Counter that is monotonically increasing with every version.
   *
   * The versionRevision (vrev on OBS) is maintained by the server and ensures a
   * strictly monotonically increasing number for a given version. It consists
   * of the version parsed from the the build description and the checkin
   * counter. The checkin counter gets reset to zero if the new version did not
   * exist yet. Together with the build counter this forms the version-release
   * of the resulting binary.
   */
  readonly versionRevision?: number;
}

interface CommitWithFiles extends BaseCommit {
  /**
   * Array of files at this specific revision.
   *
   * These files have no contents as fetching these would be far too costly.
   */
  readonly files: readonly PackageFile[];

  /** Whether this commit represents the state with links expanded or not. */
  readonly expanded?: boolean;
}

/**
 * Type for internal usage where the [[Commit.parentCommits]] field can be
 * modified, so that commits can be added later on.
 */
interface MutableCommit extends CommitWithFiles {
  parentCommits: MutableCommit[] | undefined;
}

/** */
export interface Commit extends CommitWithFiles {
  /**
   * The direct ancestors of this commit.
   *
   * If this field is `undefined` then this is the first commit, otherwise it
   * must be an array with at least one element.
   */
  readonly parentCommits: Commit[] | undefined;
}

/** A single (unconnected) revision of a package */
export type Revision = BaseCommit;

/** The representation of a revision as received from OBS API */
export interface RevisionApiReply {
  $: {
    rev: string;
    vrev: string;
  };
  srcmd5: string;
  version: string;
  /** The commit time as a unix time stamp */
  time: number;

  /**
   * The userid of the commit author.
   *
   * If not available (e.g. because the user got deleted), then it this field
   * contains the string 'unknown'.
   */
  user: string;

  /** The commit message */
  comment?: string;
  requestid?: string;
}

/**
 * The reply from OBS API to the `GET /source/$project/$package/_history` route
 * as decoded by xml2js.
 *
 * Schema: https://build.opensuse.org/apidocs/revisionlist.rng
 */
interface RevisionListApiReply {
  revisionlist: { revision: RevisionApiReply | RevisionApiReply[] };
}

const valueOrUndefined = (value: string) =>
  value === "unknown" ? undefined : value;

/** Converts a the revision as received directly from OBS to a [[Revision]] */
export function apiRevisionToRevision(
  rev: RevisionApiReply,
  pkg: { projectName: string; name: string }
): Omit<Revision, "commitMessage"> & { commitMessage: string } {
  // OBS will sometimes reply with '' as the requestid instead of simply
  // omitting the entry
  // we want to set it to undefined for consistency then
  let requestId: number | undefined;
  if (rev.requestid !== undefined) {
    requestId = parseInt(rev.requestid, 10);
    if (isNaN(requestId)) {
      requestId = undefined;
    }
  }

  return withoutUndefinedMembers({
    revisionHash: rev.srcmd5,
    version: valueOrUndefined(rev.version),
    revision: parseInt(rev.$.rev, 10),
    versionRevision: parseInt(rev.$.vrev, 10),
    commitTime: dateFromUnixTimeStamp(rev.time),
    userId: valueOrUndefined(rev.user),
    // Ensure that a commit message is present, because OBS sometimes returns a
    // reply where this field is missing, but then later gives you one where it
    // is "". So we do the same...
    commitMessage: rev.comment ?? "",
    requestId,
    projectName: pkg.projectName,
    packageName: pkg.name
  });
}

/**
 * Retrieve the history of the package `pkg` without including the history of
 * linked packages.
 *
 * @param con  The [[Connection]] to use for the API calls
 * @param pkg  The [[Package]] object which revisions should be retrieved.
 *
 * @return The revisions of the requested package. The revisions are ordered
 *     with ascending [[Revision.revision]] (at least OBS appears to return them
 *     this way).
 */
export async function fetchHistory(
  con: Connection,
  pkg: Package
): Promise<readonly Revision[]> {
  const revs = await con.makeApiCall<RevisionListApiReply>(
    `/source/${pkg.projectName}/${pkg.name}/_history`
  );

  return mapOrApply(revs.revisionlist.revision, (rev: RevisionApiReply) =>
    apiRevisionToRevision(rev, pkg)
  );
}

interface ExpandedRevisions {
  headCommit: MutableCommit | undefined;

  reversedExpandedPackageContents: Directory[];
}

async function fetchExpandedRevisions(
  con: Connection,
  pkg: Package
): Promise<ExpandedRevisions> {
  const revisions = await fetchHistory(con, pkg);

  const packageContentsAndExpanded = await Promise.all(
    revisions.map(
      async (rev): Promise<[Directory, boolean]> => {
        try {
          // FIXME: should use a function from the package module instead
          const expandedDir = await fetchDirectory(
            con,
            `/source/${pkg.projectName}/${pkg.name}?expand=1&linkrev=base&rev=${rev.revisionHash}`
          );
          return [expandedDir, true];
        } catch (err) {
          // it is possible that the sources cannot be expanded due to a conflict,
          // in that case well get an ApiError with status 400 telling us that
          // there is a conflict
          // If we got a different error, just rethrow it, we cannot handle it
          if (!isApiError(err) || err.statusCode !== 400) {
            throw err;
          }
          // retry with the unexpanded sources
          return [
            await fetchDirectory(
              con,
              `/source/${pkg.projectName}/${pkg.name}?expand=0&rev=${rev.revisionHash}`
            ),
            false
          ];
        }
      }
    )
  );

  assert(
    revisions.length === packageContentsAndExpanded.length,
    `Expected to get the same number of commints from the expanded history(${packageContentsAndExpanded.length}) back as from the unexpanded one (${revisions.length}).`
  );

  let headCommit: MutableCommit | undefined;
  let cur: MutableCommit | undefined;

  const reversedExpandedPackageContents = [];

  for (let i = packageContentsAndExpanded.length - 1; i >= 0; i--) {
    const [dentry, expanded] = packageContentsAndExpanded[i];
    const rev = revisions[i];

    reversedExpandedPackageContents.push(dentry);

    const {
      commitMessage,
      requestId,
      userId,
      commitTime,
      revision,
      versionRevision,
      version
    } = rev;

    const next = {
      revisionHash: dentry.revision ?? dentry.sourceMd5 ?? rev.revisionHash,
      files: fileListFromDirectory(pkg, dentry).files,
      commitMessage,
      requestId,
      userId,
      commitTime,
      parentCommits: undefined,
      projectName: pkg.projectName,
      packageName: pkg.name,
      revision,
      versionRevision,
      version,
      expanded
    };
    if (headCommit === undefined) {
      headCommit = next;
      cur = headCommit;
    } else {
      assert(cur !== undefined);
      cur.parentCommits = [next];
      cur = next;
    }
  }

  return { headCommit, reversedExpandedPackageContents };
}

/**
 * A link to another package with a guaranteed destination.
 *
 * This interface only exists because the [[LinkInfo]] interface which is
 * received from OBS has no guaranteed entries at all.
 */
interface ValidLinkInfo {
  package: string;
  project: string;
  revision?: string;
  baserev?: string;
  srcmd5?: string;
}

/**
 * Extract the link information from a [[Directory]] object.
 *
 * This function will also extract **broken** links! These are links with an
 * error in the expansion of the sources. However, we **must** know if there are
 * (even broken) links to create a more or less accurate history.
 *
 * @return
 *     - `undefined` if no link with a defined destination was found
 *     - a populated [[ValidLink]] object
 *
 * @throw If there are more than one `<linkinfo>` entries in this directory
 *     (this really should not happen, but it is theoretically possible as the
 *     schema doesn't forbid it)
 */
function validLinkFromDir(dentry: Directory): ValidLinkInfo | undefined {
  if (dentry.linkInfos !== undefined && dentry.linkInfos.length > 0) {
    // somehow we managed to get more than 1 <linkinfo>???
    if (dentry.linkInfos.length > 1) {
      throw new Error(
        `Package has multiple <linkinfos>. This is bonkers and unsupported. Please file a bugreport!`
      );
    }
    if (
      dentry.linkInfos[0].package !== undefined &&
      dentry.linkInfos[0].project !== undefined
    ) {
      const { project, baserev, srcmd5, rev } = dentry.linkInfos[0];
      return {
        revision: rev,
        package: dentry.linkInfos[0].package,
        project,
        baserev,
        srcmd5
      };
    }
  }
  return undefined;
}

/** Returns a key of the commit `cmt` for the `commitCache` map */
const getCommitKey = (cmt: {
  projectName: string;
  packageName: string;
  revisionHash: string;
}): string => `${cmt.projectName}/${cmt.packageName}@${cmt.revisionHash}`;

/**
 * Saves the `commit` in a map where each commit is keyed by the value returned
 * from [[getCommitKey]].
 */
function insertIntoCommitCache(
  commit: Commit,
  commitCache: Map<string, Commit>
): void {
  commitCache.set(getCommitKey(commit), commit);

  if (commit.parentCommits !== undefined) {
    commit.parentCommits.forEach((parent) =>
      insertIntoCommitCache(parent, commitCache)
    );
  }
}

/** Returns the key of a package for the `pkgHistoryCache` map */
const getPkgKey = (pkg: Package): string => `${pkg.projectName}/${pkg.name}`;

/**
 * Recursively inserts all commits starting at `commit` into the `commitCache`
 * and `pkgHistoryCache`.
 */
function insertCommitsIntoAllCaches(
  pkg: Package,
  commit: Commit | undefined,
  commitCache: Map<string, Commit>,
  pkgHistoryCache: Map<string, Commit | undefined>
): void {
  const pkgKey = `${pkg.projectName}/${pkg.name}`;
  if (!pkgHistoryCache.has(pkgKey)) {
    pkgHistoryCache.set(pkgKey, commit);
    if (commit !== undefined) {
      insertIntoCommitCache(commit, commitCache);
    }
  }
}

/**
 * Resolve the history of the provided package across links.
 *
 * This function utilizes the provided `pkgHistoryCache` and `commitCache` maps to limit
 */
async function cachedFetchHistoryAcrossLinks(
  con: Connection,
  pkg: Package,
  commitCache: Map<string, Commit>,
  pkgHistoryCache: Map<string, Commit>
): Promise<Commit | undefined> {
  const pkgKey = getPkgKey(pkg);

  if (pkgHistoryCache.has(pkgKey)) {
    return pkgHistoryCache.get(pkgKey);
  }

  const {
    headCommit,
    reversedExpandedPackageContents
  } = await fetchExpandedRevisions(con, pkg);

  // console.log(reversedExpandedPackageContents);

  insertCommitsIntoAllCaches(pkg, headCommit, commitCache, pkgHistoryCache);

  if (headCommit === undefined) {
    assert(
      reversedExpandedPackageContents.length === 0,
      `HEAD is undefined, no history must exist but got ${reversedExpandedPackageContents.length} revisions`
    );
    return undefined;
  }

  const head = headCommit;
  let cur = head;

  for (let i = 0; i < reversedExpandedPackageContents.length; i++) {
    const dentry = reversedExpandedPackageContents[i];

    const validLink = validLinkFromDir(dentry);
    if (validLink === undefined) {
      continue;
    }

    const linkedPkg: Package = {
      apiUrl: con.url.href,
      name: validLink.package,
      projectName: validLink.project
    };

    let useBaseRev: boolean = true;

    // in case we have a link to a specific revision -> use that one to link the history directly
    // or
    // we have no baserev, so the package is directly linked to HEAD of the linked package
    // or
    // we managed to get to the last commit, so let's just attach the history here
    if (
      validLink.revision !== undefined ||
      validLink.baserev === undefined ||
      i === reversedExpandedPackageContents.length - 1
    ) {
      useBaseRev = false;

      let linkedHistory = await cachedFetchHistoryAcrossLinks(
        con,
        linkedPkg,
        commitCache,
        pkgHistoryCache
      );

      if (linkedHistory !== undefined) {
        if (validLink.revision !== undefined) {
          linkedHistory = commitCache.get(
            getCommitKey({
              revisionHash: validLink.revision,
              projectName: validLink.project,
              packageName: validLink.package
            })
          );
        }

        // if the commit cannot be found then that means that there was an
        // expansion conflict and we should fallback to using the baserev
        if (linkedHistory === undefined) {
          useBaseRev = true;
        } else {
          // console.log("linkedHistory:");
          // console.log(linkedHistory);
          // console.log("------------");
          // console.log(validLink);

          // at this point the linkedHistory must be one of the two:
          // 1. we have a validLink.revision and obtained the commit from the
          //    commitCache => the revisions must now match, otherwise our hash
          //    table is broken
          // 2. we have no validLink.revision (and in this branch also no
          //    baserev) so we are just "attaching" HEAD of the linked
          //    package. The link must then have a srcmd5 and that matches the
          //    revisionHash of linkedHistory
          assert(
            linkedHistory.revisionHash === validLink.revision ||
              linkedHistory.revisionHash === validLink.srcmd5,
            `Got an invalid history back, expected HEAD of linked package (${
              linkedPkg.projectName
            }/${linkedPkg.name}) to be at ${
              validLink.revision ?? "undefined"
            } or ${validLink.srcmd5 ?? "undefined"} but got ${
              linkedHistory.revisionHash
            }`
          );
          cur.parentCommits === undefined
            ? (cur.parentCommits = [linkedHistory])
            : cur.parentCommits.push(linkedHistory);
        }
      }
    }

    if (
      validLink.baserev !== undefined &&
      i < reversedExpandedPackageContents.length - 1 &&
      useBaseRev
    ) {
      // we got a baserev, so now we need to check if the previous commit
      // changed it
      //   yes => we make this a "branch off" point
      //   no => defer the branch off point
      // also, we must check if the link appeared with this commit (if it did
      // then this is also a branch off point)
      assert(cur.parentCommits !== undefined && cur.parentCommits.length === 1);

      assert(i < reversedExpandedPackageContents.length - 1);
      const nextLink = validLinkFromDir(reversedExpandedPackageContents[i + 1]);
      if (
        nextLink === undefined ||
        (nextLink.baserev !== undefined &&
          nextLink.baserev !== validLink.baserev)
      ) {
        const commitsOfLink = await cachedFetchHistoryAcrossLinks(
          con,
          linkedPkg,
          commitCache,
          pkgHistoryCache
        );

        if (commitsOfLink !== undefined) {
          const linkedCommit = commitCache.get(
            getCommitKey({
              revisionHash: validLink.baserev,
              projectName: validLink.project,
              packageName: validLink.package
            })
          );
          assert(
            linkedCommit !== undefined,
            `Must find a commit with the revision ${validLink.baserev} in the package ${linkedPkg.projectName}/${linkedPkg.name}, but found none`
          );
          cur.parentCommits.push(linkedCommit);
        }
      }
    }

    if (cur.parentCommits === undefined) {
      assert(
        i === reversedExpandedPackageContents.length - 1,
        `Last commit appears to be ${cur.revisionHash}, but there are still revisions left to process (processed ${i}, ${reversedExpandedPackageContents.length} in total)`
      );
    } else {
      cur = cur.parentCommits[0];
    }
  }

  return head;
}

/**
 * Retrieve the history from OBS for the given package while trying to resolve
 * the history across links as much as possible.
 *
 * @param con  Connection for all API calls.
 * @param pkg  The package whose history should be retrieved.
 *
 * @return The head commit of the specified package with all ancestors linked
 *     via the [[Commit.parentCommits]] field. If the package has no history at
 *     all, then `undefined` is returned.
 */
export async function fetchHistoryAcrossLinks(
  con: Connection,
  pkg: Package
): Promise<Commit | undefined> {
  const commitCache = new Map();
  const pkgHistoryCache = new Map();

  return cachedFetchHistoryAcrossLinks(con, pkg, commitCache, pkgHistoryCache);
}

async function fetchHead(
  con: Connection,
  pkg: Package,
  expandLinks: boolean = true
): Promise<Commit> {
  const [unexpandedHistory, { files, md5Hash }] = await Promise.all([
    fetchHistory(con, pkg),
    fetchFileList(con, pkg, { expandLinks, retrieveFileContents: false })
  ]);
  const { revisionHash: _unused, ...head } = unexpandedHistory[-1];
  return {
    ...head,
    files,
    revisionHash: md5Hash,
    parentCommits: []
  };
}

/**
 *
 */
export async function fetchFileContentsAtCommit(
  con: Connection,
  pkg: Package,
  commit?: Commit
): Promise<Commit> {
  const { files: _unused, ...rest } =
    commit === undefined ? await fetchHead(con, pkg) : commit;

  const { files } = await fetchFileList(con, pkg, {
    retrieveFileContents: true,
    expandLinks: rest.expanded,
    revision: commit?.revisionHash
  });

  return { files, ...rest };
}

/**
 * Create a graph of the history from a HEAD commit that can be drawn using the
 * `dot` tool from [graphviz](https://graphviz.org/).
 *
 * This function creates a graph using the dot language, visualizing the history
 * starting at `commit`. Each commit is inserted as a single node with the
 * following entries:
 * - md5 revision hash
 * - commit time (as UTC)
 * - revision number if known/available, otherwise the md5 revision hash is used
 * - first line of the commit message
 *
 * Each commit is connected to its parent commits via single arrows pointing
 * from the current commit to its parents.
 *
 * It is ensured that each commit (uniquely identified by the
 * project+package+md5 Hash) is inserted only once to prevent multiple arrows
 * connecting two commits.
 *
 * @return The resulting graph description in the `dot` language as a string.
 */
export function historyToGraphviz(commit: Commit): string {
  const visited = new Map<string, boolean>();

  const formatTime = (time: Date): string => {
    const options = {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
      timeZone: "UTC"
    };
    return new Intl.DateTimeFormat("en-US", options).format(time);
  };

  const addNodes = (cmt: Commit): string => {
    const commitKey = getCommitKey(cmt);
    if (visited.get(commitKey)) {
      return "";
    }
    visited.set(commitKey, true);
    const myNode = `  "${commitKey}" [
    label = "<f0> ${cmt.revisionHash} | ${formatTime(cmt.commitTime)} | ${
      cmt.projectName
    }/${cmt.packageName} | revision: ${cmt.revision} | ${
      cmt.commitMessage?.split(/\r?\n/)[0] ?? "no commit message"
    } "
    shape = "record"
  ];
`;
    return myNode.concat(
      cmt.parentCommits !== undefined
        ? cmt.parentCommits
            .map((parent) =>
              addNodes(parent).concat(`  "${getCommitKey(
                cmt
              )}":f0 -> "${getCommitKey(parent)}":f0;
`)
            )
            .join("")
        : ""
    );
  };
  return `digraph G {
  graph [
    rankdir = "LR"
  ];
${addNodes(commit)}
}
`;
}

/**
 * Draws the history starting at `HEAD` with `dot` and returns the resulting svg
 * as a string.
 */
export async function drawHistoryToSvg(HEAD: Commit): Promise<string> {
  return runProcess("dot", { args: ["-Tsvg"], stdin: historyToGraphviz(HEAD) });
}
