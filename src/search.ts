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

import { ProjectMetaApiReply, projectMetaFromApi } from "./api/project-meta";
import { Connection } from "./connection";
import { Project } from "./project";
import { mapOrApply } from "./util";

const enum SearchEntity {
  Project = "project",
  Package = "package",
  PublishedBinary = "published/binary",
  PublishedPattern = "published/pattern",
  ChannelBinary = "channel/binary",
  ReleasedBinary = "released/binary",
  Request = "request",
  Issue = "issue",
  Owner = "owner",
  MissingOwner = "missing_owner"
}

interface SearchOptions {
  readonly idOnly?: boolean;
  readonly exactMatch?: boolean;
}

// interface BaseSearchOptions {
//   readonly exactMatch?: boolean;
// }

// type SearchApiReply = ProjectMetaApiReply | PackageMetaApiReply;

interface CollectionApiReplyBase {
  collection: { $: { matches: number } };
}

interface ProjectByIdReply {
  $: { name: string };
}

type ProjectByIdCollection = CollectionApiReplyBase & {
  collection: { project: ProjectByIdReply | ProjectByIdReply[] };
};
type ProjectCollection = CollectionApiReplyBase & {
  collection: { project: ProjectMetaApiReply | ProjectMetaApiReply[] };
};

function projectFromSearchRes(
  searchEntry: ProjectByIdReply,
  apiUrl: string
): Project {
  return { apiUrl, name: searchEntry.$.name };
}

// async function searchByName(
//   con: Connection,
//   entity: SearchEntity,
//   str: string,
//   options?: BaseSearchOptions & { idOnly: true }
// ): Promise<readonly string[]>;

async function searchByName(
  con: Connection,
  entity: SearchEntity,
  searchStr: string,
  options?: SearchOptions
): Promise<any> {
  let route = `/search/${entity}${options?.idOnly ? "/id" : ""}?match=`;
  if (options?.exactMatch) {
    route = route.concat(`@name='${searchStr}'`);
  } else {
    route = route.concat(`contains(@name,'${searchStr}')`);
  }

  const searchRes: CollectionApiReplyBase = await con.makeApiCall(route);

  return searchRes;
}

export async function searchForProjects(
  con: Connection,
  searchStr: string,
  options?: SearchOptions
): Promise<readonly Project[]> {
  const searchRes:
    | ProjectByIdCollection
    | ProjectCollection = await searchByName(
    con,
    SearchEntity.Project,
    searchStr,
    options
  );

  if (options?.idOnly) {
    return Object.freeze(
      mapOrApply(
        searchRes.collection.project as ProjectByIdReply,
        (reply: ProjectByIdReply) => projectFromSearchRes(reply, con.url)
      )
    );
  } else {
    return Object.freeze(
      mapOrApply(
        searchRes.collection.project as ProjectMetaApiReply,
        (projMeta) => {
          const meta = projectMetaFromApi(projMeta);
          return { name: meta.name, apiUrl: con.url, meta };
        }
      )
    );
  }
}
