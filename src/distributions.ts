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

import { URL } from "url";
import { Arch } from "./api/base-types";
import { Connection } from "./connection";
import {
  deleteUndefinedAndEmptyMembers,
  extractElementAsArrayIfPresent
} from "./util";

/** The icon of a [[Distribution]] */
export interface Icon {
  /** url to the actual icon */
  readonly url: URL;
  /** width of the icon in pixels */
  readonly width?: number;
  /** height of the icon in pixels */
  readonly height?: number;
}

/** An object containing the information about a distribution hosted on OBS */
export interface Distribution {
  /**
   * Id of this distribution (used for searching and modifying it).
   *
   * This value is undefined for distributions included from remote OBS servers.
   */
  readonly id?: string;

  /** The vendor of this distribution */
  readonly vendor: string;

  /** The version of this distribution */
  readonly version: string;

  /** The full name of this distribution (e.g. `"openSUSE Tumbleweed"`) */
  readonly name: string;

  /**
   * Name of the project where the repositories of this distribution are
   * available.
   */
  readonly project: string;

  /**
   * Name of the default repository of this distribution in its [[project]].
   *
   * As distributions don't have a standard naming scheme of their
   * repositories, so one cannot know which repository should be added to get
   * all packages. The name of the "main" repository is saved in this field and
   * can be used to add repositories to your project.
   */
  readonly repository: string;

  /**
   * The canonical name of the distribution's main repository.
   *
   * Naming the repository with this name is optional, but choosing a different
   * name results in OBS no longer recognizing the repository as the main one of
   * this distribution (and it cannot be easily removed via the WebUI anymore).
   */
  readonly repositoryName: string;

  /** URL to the distribution's homepage */
  readonly link: URL;

  /** Architectures supported by this distribution */
  readonly architectures?: Arch[];

  /** Icons of the distribution logo */
  readonly icons?: Icon[];
}

/**
 * expected structure of the `<icon>` element from the `/distributions` route
 * when decoded via xml2js.
 */
interface IconApiReply {
  $: { url: string; width?: string; height?: string };
}

/**
 * Expected structure of the decoded data from the `/distributions` route when
 * decoded via xml2js according to the
 * [documentation](https://build.opensuse.org/apidocs/distributions.rng).
 */
interface DistributionApiReply {
  distributions: {
    distribution: {
      $: { vendor: string; version: string; id: string };
      name: string;
      project: string;
      repository: string;
      reponame: string;
      link: string;
      architecture?: Arch[] | Arch;
      icon?: IconApiReply[] | IconApiReply;
    }[];
  };
}

/**
 * Get the list of distributions hosted on this OBS instance and optionally
 * remote ones.
 *
 * @param con  Connection that will be used to make the request. The OBS instance
 *     to which this connection belongs will be queried.
 * @param includeRemotes OBS allows to link remote OBS instances and to have
 *     projects from remote instances available locally. These remote
 *     distributions are not included by default, but can be queried too, when
 *     setting this flag to `true`.
 *
 * @return  The list of available distributions.
 */
export async function fetchHostedDistributions(
  con: Connection,
  includeRemotes: boolean = false
): Promise<readonly Distribution[]> {
  const distros: DistributionApiReply = await con.makeApiCall(
    !includeRemotes ? "/distributions" : "distributions/include_remotes"
  );

  return Object.freeze(
    distros.distributions.distribution.map((distro) => {
      return deleteUndefinedAndEmptyMembers({
        vendor: distro.$.vendor,
        version: distro.$.version,
        id: distro.$.id === "" ? undefined : distro.$.id,
        name: distro.name,
        project: distro.project,
        repository: distro.repository,
        repositoryName: distro.reponame,
        architectures: extractElementAsArrayIfPresent(distro, "architecture"),
        link: new URL(distro.link),
        icons: extractElementAsArrayIfPresent(distro, "icon", {
          construct: (data: IconApiReply) => {
            return {
              url: new URL(data.$.url),
              width:
                data.$.width === undefined
                  ? undefined
                  : parseInt(data.$.width, 10),
              height:
                data.$.height === undefined
                  ? undefined
                  : parseInt(data.$.height, 10)
            };
          }
        })
      });
    })
  );
}
