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

import * as nock from "nock";
import { Configuration } from "../src/configuration";
import { URL } from "url";
import { ApiError } from "../src/error";
import {
  fetchDownloadUrls,
  fetchPublishedProjects,
  fetchPublishedRepositories,
  fetchPublishedRepositoryContents,
  fetchProjectsRpmRepositoryConfigFile
} from "../src/published-binaries";
import {
  afterEachRecordHook,
  ApiType,
  beforeEachRecordHook,
  getTestConnection,
  skipIfNoMiniObs
} from "./test-setup";
import { Arch } from "../src/api/base-types";

describe("Published Binaries", function () {
  this.timeout(10000);

  beforeEach(beforeEachRecordHook);
  afterEach(afterEachRecordHook);

  const con = getTestConnection(ApiType.Production);
  const miniObsCon = getTestConnection(ApiType.MiniObs);

  describe("#fetchPublishedProjects", () => {
    it("fetches all published repositories", async function () {
      // actually only necessary when creating the fixtures, but having it in
      // here won't kill anyone
      skipIfNoMiniObs(this);

      await fetchPublishedProjects(miniObsCon).should.eventually.deep.equal([
        "deleted",
        "home:obsTestUser",
        "home:obsTestUser:branches:home:obsTestUser:devel:tools",
        "home:obsTestUser:vscode_obs_test",
        "openSUSE.org",
        "openSUSE:Factory",
        "openSUSE:Tumbleweed"
      ]);
    });
  });

  describe("#fetchPublishedRepositories", () => {
    it("retrieves the published repositories of Virtualization:vagrant", async () => {
      await fetchPublishedRepositories(
        con,
        "Virtualization:vagrant"
      ).should.eventually.deep.equal([
        "SLE_15",
        "SLE_15-SP1",
        "SLE_15_SP2",
        "openSUSE_Factory_ARM",
        "openSUSE_Leap_15.0",
        "openSUSE_Leap_15.1",
        "openSUSE_Leap_15.1_ARM",
        "openSUSE_Leap_15.2",
        "openSUSE_Tumbleweed",
        "openSUSE_Tumbleweed_and_d_l_r_e",
        "openSUSE_Tumbleweed_default_ruby"
      ]);
    });

    it("retrieves an empty array for repositories with publishing turned off", async () => {
      await fetchPublishedRepositories(
        con,
        "home:dancermak:branches:devel:languages:ruby:extensions"
      ).should.eventually.deep.equal([]);
    });

    it("rejects the promise for non existent repositories", async () => {
      await fetchPublishedRepositories(con, {
        name: "home:dancermak:blablbabababababa"
      }).should.be.rejectedWith(ApiError, /got a 404/);
    });
  });

  describe("#fetchPublishedRepositoryContents", () => {
    it("fetches the present files and directories in Virtualization:vagrant for the Tumbleweed repository", async () => {
      await fetchPublishedRepositoryContents(
        con,
        "Virtualization:vagrant",
        "openSUSE_Tumbleweed"
      ).should.eventually.deep.equal([
        "Virtualization:vagrant.repo",
        "i586",
        "noarch",
        "repocache",
        "repodata",
        "src",
        "x86_64"
      ]);
    });

    it("fetches the binary names in a repository", async () => {
      await fetchPublishedRepositoryContents(
        con,
        "Virtualization:vagrant",
        "openSUSE_Tumbleweed",
        { arch: Arch.Noarch }
      ).should.eventually.deep.equal([
        "vagrant-bash-completion-2.2.14-3.1.noarch.rpm",
        "vagrant-doc-2.2.14-3.1.noarch.rpm",
        "vagrant-emacs-2.2.14-3.1.noarch.rpm",
        "vagrant-sshfs-doc-1.3.5-31.2.noarch.rpm",
        "vagrant-vim-2.2.14-3.1.noarch.rpm"
      ]);
    });

    it("does not die if the user asks for a file by accident", async () => {
      await fetchPublishedRepositoryContents(
        con,
        "Virtualization:vagrant",
        "openSUSE_Tumbleweed",
        { subdir: "Virtualization:vagrant.repo" }
      ).should.eventually.equal(undefined);
    });

    it("does not swallow real errors", async () => {
      await fetchPublishedRepositoryContents(
        con,
        "invalid_project_name",
        "openSUSE_Tumbleweed",
        { subdir: "foo" }
      ).should.rejectedWith(ApiError, /404/);
    });
  });

  describe("#fetchDownloadUrls", () => {
    const url = "https://download.bar.baz/";
    const conf: Configuration = {
      disableBranchPublishing: false,
      schedulers: [],
      title: "fake instance",
      description: "fake description",
      repositoryUrl: new URL(url)
    };

    it("fetches the download urls of binaries", async () => {
      await fetchDownloadUrls(
        con,
        "Virtualization:vagrant",
        "openSUSE_Tumbleweed"
      ).should.eventually.deep.equal([
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/Virtualization:vagrant.repo",
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/i586",
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/noarch",
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/repocache",
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/repodata",
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/src",
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/x86_64"
      ]);
    });

    it("reuses a Configuration if supplied", async () => {
      await fetchDownloadUrls(
        con,
        "Virtualization:vagrant",
        "openSUSE_Tumbleweed",
        { conf }
      ).should.eventually.deep.equal(
        [
          "/Virtualization:vagrant/openSUSE_Tumbleweed/Virtualization:vagrant.repo",
          "/Virtualization:vagrant/openSUSE_Tumbleweed/i586",
          "/Virtualization:vagrant/openSUSE_Tumbleweed/noarch",
          "/Virtualization:vagrant/openSUSE_Tumbleweed/repocache",
          "/Virtualization:vagrant/openSUSE_Tumbleweed/repodata",
          "/Virtualization:vagrant/openSUSE_Tumbleweed/src",
          "/Virtualization:vagrant/openSUSE_Tumbleweed/x86_64"
        ].map((r) => `${url}${r}`)
      );
    });

    it("only supplies urls for the binaries supplied to the function", async () => {
      await fetchDownloadUrls(
        con,
        "Virtualization:vagrant",
        "openSUSE_Tumbleweed",
        { conf, binaries: ["src"] }
      ).should.eventually.deep.equal([
        `${url}/Virtualization:vagrant/openSUSE_Tumbleweed/src`
      ]);
    });

    it("correctly creates urls for arch-subdirectories", async () => {
      await fetchDownloadUrls(
        con,
        "Virtualization:vagrant",
        "openSUSE_Tumbleweed",
        { arch: Arch.Noarch }
      ).should.eventually.deep.equal([
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/noarch/vagrant-bash-completion-2.2.14-3.1.noarch.rpm",
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/noarch/vagrant-doc-2.2.14-3.1.noarch.rpm",
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/noarch/vagrant-emacs-2.2.14-3.1.noarch.rpm",
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/noarch/vagrant-sshfs-doc-1.3.5-31.2.noarch.rpm",
        "https://download.opensuse.org/repositories/Virtualization:vagrant/openSUSE_Tumbleweed/noarch/vagrant-vim-2.2.14-3.1.noarch.rpm"
      ]);
    });

    it("correctly creates urls for subdirectories", async () => {
      await fetchDownloadUrls(
        con,
        "Virtualization:Appliances:Images:Testing_x86:fedora",
        "images",
        {
          subdir: "iso",
          binaries: [
            "kiwi-test-image-live-disk.x86_64-Live.iso",
            "kiwi-test-image-live-disk.x86_64-Disk.iso"
          ]
        }
      ).should.eventually.deep.equal([
        "https://download.opensuse.org/repositories/Virtualization:Appliances:Images:Testing_x86:fedora/images/iso/kiwi-test-image-live-disk.x86_64-Live.iso",
        "https://download.opensuse.org/repositories/Virtualization:Appliances:Images:Testing_x86:fedora/images/iso/kiwi-test-image-live-disk.x86_64-Disk.iso"
      ]);
    });

    it("tries to re-fetch the config if no repository url is set", async () => {
      const { repositoryUrl: _ignore, ...restOfConf } = conf;
      await fetchDownloadUrls(
        con,
        "Virtualization:Appliances:Images:Testing_x86:fedora",
        "images",
        {
          conf: restOfConf,
          subdir: "iso",
          binaries: ["kiwi-test-image-live-disk.x86_64-Disk.iso"]
        }
      ).should.eventually.deep.equal([
        "https://download.opensuse.org/repositories/Virtualization:Appliances:Images:Testing_x86:fedora/images/iso/kiwi-test-image-live-disk.x86_64-Disk.iso"
      ]);
    });

    it("rejects fetching the urls if no repository url is available", async function () {
      // actually only necessary when creating the fixtures, but having it in
      // here won't kill anyone
      skipIfNoMiniObs(this);

      await fetchDownloadUrls(miniObsCon, "foo", "bar").should.be.rejectedWith(
        Error,
        /cannot construct download urls/
      );
    });

    it("does not connect to the network if the binaries and conf parameter are present", async () => {
      nock.disableNetConnect();

      const binaries = ["first", "second"];
      await fetchDownloadUrls(con, "foo", "bar", {
        binaries,
        conf
      }).should.eventually.deep.equal(
        binaries.map((b) => `${url}/foo/bar/${b}`)
      );
    });
  });

  describe("#fetchRepositoryConfig", () => {
    it("fetches the repository config file of devel:tools", async () => {
      await fetchProjectsRpmRepositoryConfigFile(
        con,
        "devel:tools",
        "openSUSE_Tumbleweed"
      ).should.eventually.deep.equal(
        `[devel_tools]
name=Generic Development Tools (openSUSE_Tumbleweed)
type=rpm-md
baseurl=https://download.opensuse.org/repositories/devel:/tools/openSUSE_Tumbleweed/
gpgcheck=1
gpgkey=https://download.opensuse.org/repositories/devel:/tools/openSUSE_Tumbleweed/repodata/repomd.xml.key
enabled=1
`
      );
    });

    it("returns nothing if this repository does not exist", async () => {
      await fetchProjectsRpmRepositoryConfigFile(
        con,
        "devel:tools",
        "I_don_t_exist"
      ).should.eventually.equal(undefined);
    });

    it("returns nothing if there's not .repo file present and the repository has no dod entry", async () => {
      await fetchProjectsRpmRepositoryConfigFile(
        con,
        "Virtualization:Appliances:Images:Testing_x86:fedora",
        "images"
      ).should.eventually.equal(undefined);
    });

    it("creates a valid entry for openSUSE_Tumbleweed from the dod entry", async () => {
      await fetchProjectsRpmRepositoryConfigFile(
        con,
        "openSUSE:Tumbleweed",
        "dod"
      ).should.eventually.deep.equal(`[openSUSE:Tumbleweed]
enabled=1
name=openSUSE:Tumbleweed
baseurl=https://download.opensuse.org/tumbleweed/repo/oss
type=rpm-md
autorefresh=1
gpgcheck=1

[openSUSE:Tumbleweed]
enabled=1
name=openSUSE:Tumbleweed
baseurl=https://download.opensuse.org/tumbleweed/repo/oss
type=rpm-md
autorefresh=1
gpgcheck=1

[openSUSE:Tumbleweed]
enabled=1
name=openSUSE:Tumbleweed
baseurl=https://download.opensuse.org/ports/armv6hl/tumbleweed/repo/oss
type=rpm-md
autorefresh=1
gpgcheck=1

[openSUSE:Tumbleweed]
enabled=1
name=openSUSE:Tumbleweed
baseurl=https://download.opensuse.org/ports/armv7hl/tumbleweed/repo/oss
type=rpm-md
autorefresh=1
gpgcheck=1

[openSUSE:Tumbleweed]
enabled=1
name=openSUSE:Tumbleweed
baseurl=https://download.opensuse.org/ports/aarch64/tumbleweed/repo/oss
type=rpm-md
autorefresh=1
gpgcheck=1

[openSUSE:Tumbleweed]
enabled=1
name=openSUSE:Tumbleweed
baseurl=https://download.opensuse.org/ports/riscv/tumbleweed/repo/oss
type=rpm-md
autorefresh=1
gpgcheck=1
`);
    });
  });
});
