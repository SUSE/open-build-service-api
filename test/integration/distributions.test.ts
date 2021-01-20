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

import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import { URL } from "url";
import {
  Distribution,
  fetchHostedDistributions
} from "../../src/distributions";
import {
  afterEachRecordHook,
  ApiType,
  beforeEachRecordHook,
  getTestConnection
} from "./../test-setup";

describe("Distribution", () => {
  beforeEach(beforeEachRecordHook);
  afterEach(afterEachRecordHook);

  const con = getTestConnection(ApiType.Production);

  let obsDistros: Distribution[] | undefined;

  describe("#fetchHostedDistributions", () => {
    it("fetches the list of distros from OBS", async () => {
      obsDistros = await fetchHostedDistributions(con).should.be.fulfilled;

      // we will not check all entries, that would be nuts
      expect(obsDistros).to.be.an("array").and.have.length(61);

      obsDistros = obsDistros!;

      // just check TW
      obsDistros.should.include.a.thing.that.deep.equals({
        vendor: "openSUSE",
        version: "Tumbleweed",
        id: "12977",
        name: "openSUSE Tumbleweed",
        project: "openSUSE:Factory",
        repositoryName: "openSUSE_Tumbleweed",
        repository: "snapshot",
        link: new URL("http://www.opensuse.org/"),
        icons: [
          {
            url: new URL(
              "https://static.opensuse.org/distributions/logos/opensuse-Factory-8.png"
            ),
            width: 8,
            height: 8
          },
          {
            url: new URL(
              "https://static.opensuse.org/distributions/logos/opensuse-Factory-16.png"
            ),
            width: 16,
            height: 16
          }
        ],
        architectures: ["i586", "x86_64"]
      });

      // and Fedora
      obsDistros.should.include.a.thing.that.deep.equals({
        vendor: "Fedora",
        version: "31",
        id: "13076",
        name: "Fedora 31",
        project: "Fedora:31",
        repositoryName: "Fedora_31",
        repository: "standard",
        link: new URL("http://fedoraproject.org/"),
        icons: [
          {
            url: new URL(
              "https://static.opensuse.org/distributions/logos/fedora-12-8.png"
            ),
            width: 8,
            height: 8
          },
          {
            url: new URL(
              "https://static.opensuse.org/distributions/logos/fedora-12-16.png"
            ),
            width: 16,
            height: 16
          }
        ],
        architectures: ["x86_64", "armv7l", "aarch64", "ppc64le"]
      });

      // and AppImage, as that has no architectures associated with it
      obsDistros.should.include.a.thing.that.deep.equals({
        vendor: "Many",
        version: "42.3",
        id: "13157",
        name: "AppImage",
        project: "OBS:AppImage",
        repositoryName: "AppImage",
        repository: "AppImage",
        link: new URL("http://www.appimage.org/"),
        icons: [
          {
            url: new URL(
              "https://static.opensuse.org/distributions/logos/opensuse-13.1-8.png"
            ),
            width: 8,
            height: 8
          },
          {
            url: new URL(
              "https://static.opensuse.org/distributions/logos/opensuse-13.1-16.png"
            ),
            width: 16,
            height: 16
          }
        ]
      });
    });

    it("fetches the distributions including remotes from api-test.opensuse.org", async () => {
      const getStagingCon = () => getTestConnection(ApiType.Staging);

      const obsTestDistros = await fetchHostedDistributions(getStagingCon());

      expect(obsTestDistros).to.deep.equal([
        {
          vendor: "local_test_to_remote",
          version: "42",
          id: "9",
          name: "test",
          project: "openSUSE.org:openSUSE:Tools",
          repositoryName: "openSUSE_Tools",
          repository: "openSUSE_12.3",
          link: new URL("http://asd"),
          architectures: ["x86_64"]
        },
        {
          vendor: "local_test",
          version: "42",
          id: "10",
          name: "test2",
          project: "OBS:Server:Unstable",
          repositoryName: "OSU_SLE_12",
          repository: "SLE_12",
          link: new URL("http://bcd"),
          architectures: ["m68k", "x86_64"]
        }
      ]);

      const obsTestIncludingRemotes = await fetchHostedDistributions(
        getStagingCon(),
        true
      );

      obsTestDistros.forEach((distro) =>
        obsTestIncludingRemotes.should.include.a.thing.that.deep.equals(distro)
      );

      expect(obsDistros).to.not.equal(undefined);
      obsDistros = obsDistros!;

      // Check that all distros (except arch community, which is missing) from
      // OBS are correctly linked into OBS-TEST.
      // The difference to the data obtained from OBS is that the project is
      // prefixed with 'openSUSE.org:' and that the id is missing
      expect(obsTestIncludingRemotes).to.include.deep.members(
        obsDistros
          .filter((distro) => distro.name !== "Arch Community")
          .map((obsDistro) => {
            // construct how the linked distro looks like: drop the id and
            // prefix the project name
            const { id, project, ...rest } = obsDistro;
            return {
              project: `openSUSE.org:${project}`,
              ...rest
            };
          })
      );
    });

    it("fetches the empty distributions from mini-obs", async () => {
      await fetchHostedDistributions(
        // this test does not support remote obs instances properly as this
        // fixture has been modified manually
        getTestConnection(ApiType.MiniObs).clone({ url: ApiType.MiniObs })
      ).should.eventually.deep.equal([]);
    });
  });
});
