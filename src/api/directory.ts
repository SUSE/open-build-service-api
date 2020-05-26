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

import { SupportedHashfunction } from "../checksum";
import { Connection } from "../connection";
import {
  dateFromUnixTimeStamp,
  deleteUndefinedAndEmptyMembers,
  extractElementAsArrayIfPresent,
  unixTimeStampFromDate
} from "../util";

/**
 * Functions and objects to interact with an API route using the
 * [directory](https://build.opensuse.org/apidocs/directory.xsd) schema.
 */

/** A checksum of a directory entry (usually that is a file) */
export interface Checksum {
  /** The hash function that is used to calculate the checksum */
  hashFunction: SupportedHashfunction;
  /** The actual checksum value as a hex digest */
  hash: string;
}

function checksumFromString(str?: string): Checksum | undefined {
  if (str === undefined) {
    return undefined;
  }
  const splitByColon = str.split(":");
  if (splitByColon.length !== 2) {
    return undefined;
  }
  const [hashFunction, hash] = splitByColon;
  if (hashFunction !== "md5" && hashFunction !== "sha256") {
    return undefined;
  }
  return { hashFunction, hash };
}

function checksumToString(c?: Checksum): string | undefined {
  return c === undefined ? undefined : `${c.hashFunction}:${c.hash}`;
}

/** One entry in the directory. It's identified by its name. */
export interface DirectoryEntry {
  name?: string;
  size?: number;
  md5?: string;
  /** A checksum for file verification during uploads */
  hash?: Checksum;
  modifiedTime?: Date;
  originProject?: string;
  available?: boolean;
  recommended?: boolean;
}

/** Information about the source link. */
export interface LinkInfo {
  project?: string;
  package?: string;
  srcmd5?: string;
  rev?: string;
  baserev?: string;
  xsrcmd5?: string;
  lsrcmd5?: string;
  error?: string;
}

/** Information about source service run of last commit. */
export interface ServiceInfo {
  code?: string;
  error?: string;
  xsrcmd5?: string;
  lsrcmd5?: string;
}

interface DirectoryEntryApiReply {
  $?: {
    name?: string;
    size?: string;
    md5?: string;
    mtime?: string;
    originproject?: string;
    available?: boolean;
    recommended?: boolean;
    hash?: string;
  };
}

function directoryEntryFromApi(dentry: DirectoryEntryApiReply): DirectoryEntry {
  const { hash, size, mtime, originproject, ...rest } = dentry.$ ?? {
    hash: undefined,
    size: undefined,
    mtime: undefined,
    originproject: undefined
  };
  return {
    ...rest,
    originProject: originproject,
    modifiedTime:
      mtime !== undefined ? dateFromUnixTimeStamp(mtime) : undefined,
    size: size === undefined ? undefined : parseInt(size, 10),
    hash: checksumFromString(hash)
  };
}

function directoryEntryToApi(dentry: DirectoryEntry): DirectoryEntryApiReply {
  // explicitly destructure most of the elements here to get the "correct" order
  // of the attributes ("correct" here = the same order that osc uses by default)
  const {
    name,
    hash,
    md5,
    size,
    modifiedTime,
    originProject,
    ...rest
  } = dentry;

  return {
    $: {
      name,
      size: size?.toString(),
      md5,
      mtime:
        modifiedTime !== undefined
          ? unixTimeStampFromDate(modifiedTime).toString()
          : undefined,
      hash: checksumToString(hash),
      originproject: originProject,
      ...rest
    }
  };
}

interface LinkInfoApiReply {
  $?: LinkInfo;
}

function linkInfoFromApi(linkInfo: LinkInfoApiReply): LinkInfo {
  return linkInfo.$ ?? {};
}

interface ServiceInfoApiReply {
  $?: ServiceInfo;
}

function serviceInfoFromApi(serviceInfo: ServiceInfoApiReply): ServiceInfo {
  return serviceInfo.$ ?? {};
}

interface DirectoryApiReply {
  /**  Directory listing */
  directory: {
    $?: {
      name?: string;
      rev?: string;
      vrev?: string;
      srcmd5?: string;
      count?: number;
    };
    entry?: DirectoryEntryApiReply[];
    linkinfo?: LinkInfoApiReply[];
    serviceinfo?: ServiceInfoApiReply[];
  };
}

export interface Directory {
  readonly name?: string;
  readonly revision?: string;
  readonly versionRevision?: string;
  readonly sourceMd5?: string;
  readonly count?: number;

  readonly directoryEntries?: DirectoryEntry[];
  readonly linkInfos?: LinkInfo[];
  readonly serviceInfos?: ServiceInfo[];
}

export function directoryFromApi(
  directoryApiReply: DirectoryApiReply
): Directory {
  const dir: Directory = {
    name: directoryApiReply.directory.$?.name,
    revision: directoryApiReply.directory.$?.rev,
    versionRevision: directoryApiReply.directory.$?.vrev,
    sourceMd5: directoryApiReply.directory.$?.srcmd5,
    count: directoryApiReply.directory.$?.count,
    directoryEntries: extractElementAsArrayIfPresent(
      directoryApiReply.directory,
      "entry",
      { construct: directoryEntryFromApi }
    ),
    linkInfos: extractElementAsArrayIfPresent(
      directoryApiReply.directory,
      "linkinfo",
      {
        construct: linkInfoFromApi
      }
    ),
    serviceInfos: extractElementAsArrayIfPresent(
      directoryApiReply.directory,
      "serviceinfo",
      { construct: serviceInfoFromApi }
    )
  };

  return deleteUndefinedAndEmptyMembers(dir);
}

export function directoryToApi(directory: Directory): DirectoryApiReply {
  return {
    directory: deleteUndefinedAndEmptyMembers({
      $: {
        name: directory.name,
        rev: directory.revision,
        vrev: directory.versionRevision,
        srcmd5: directory.sourceMd5,
        count: directory.count
      },
      entry: directory.directoryEntries?.map((dentry) =>
        directoryEntryToApi(dentry)
      ),
      linkinfo: directory.linkInfos?.map((link) => ({ $: link })),
      serviceinfo: directory.serviceInfos?.map((service) => ({ $: service }))
    })
  };
}

/**
 * Fetch a [[Directory]] from one of the routes that return a [directory
 * listing](https://build.opensuse.org/apidocs/directory.xsd).
 *
 * @param con  The Connection via which the API call will be performed
 * @param route  A route that returns a directory listing
 */
export async function fetchDirectory(
  con: Connection,
  route: string
): Promise<Directory> {
  return directoryFromApi(await con.makeApiCall(route));
}
