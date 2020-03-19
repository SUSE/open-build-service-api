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

import { Connection } from "../connection";
import {
  deleteUndefinedAndEmptyMembers,
  extractElementAsArrayIfPresent
} from "../util";

/**
 * Functions and objects to interact with an API route using the
 * [directory](https://build.opensuse.org/apidocs/directory.xsd) schema.
 */

/** One entry in the directory. It's identified by its name. */
export interface DirectoryEntry {
  name?: string;
  size?: string;
  md5?: string;
  mtime?: string;
  originproject?: string;
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
  $: DirectoryEntry;
}

function directoryEntryFromApi(dentry: DirectoryEntryApiReply): DirectoryEntry {
  return dentry.$;
}

interface LinkInfoApiReply {
  $: LinkInfo;
}

function linkInfoFromApi(linkInfo: LinkInfoApiReply): LinkInfo {
  return linkInfo.$;
}

interface ServiceInfoApiReply {
  $: ServiceInfo;
}

function serviceInfoFromApi(serviceInfo: ServiceInfoApiReply): ServiceInfo {
  return serviceInfo.$;
}

interface DirectoryApiReply {
  /**  Directory listing */
  directory: {
    $: {
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
    name: directoryApiReply.directory.$.name,
    revision: directoryApiReply.directory.$.rev,
    versionRevision: directoryApiReply.directory.$.vrev,
    sourceMd5: directoryApiReply.directory.$.srcmd5,
    count: directoryApiReply.directory.$.count,
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
      entry: directory.directoryEntries?.map(dentry => ({ $: dentry })),
      linkinfo: directory.linkInfos?.map(link => ({ $: link })),
      serviceinfo: directory.serviceInfos?.map(service => ({ $: service }))
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
