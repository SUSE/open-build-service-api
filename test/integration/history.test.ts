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

import { expect } from "chai";
import { promises as fsPromises } from "fs";
import { beforeEach, describe, it, xit } from "mocha";
import { PackageFile } from "../../src/file";
import {
  Commit,
  drawHistoryToSvg,
  fetchFileContentsAtCommit,
  fetchHistory,
  fetchHistoryAcrossLinks
} from "../../src/history";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection
} from "../test-setup";
import { dotChangesRev1, vagrantSshfsHistory } from "./data";

const vagrantSshfsRevision1 = {
  revisionHash: "c4458905a38f029e0572e848e8083eb5",
  revision: 1,
  commitTime: new Date("Sun, 22 Sep 2019 13:22:55 +0200"),
  userId: "ojkastl_buildservice",
  commitMessage: "Create a RPM package of the vagrant-sshfs plugin",
  requestId: 731596,
  projectName: "Virtualization:vagrant",
  packageName: "vagrant-sshfs",
  parentCommits: undefined
};

const apiUrl = "https://api.opensuse.org/";

describe("Commit", function () {
  this.timeout(50000);

  beforeEach(async function () {
    this.beforeEachRecord = beforeEachRecord;
    await this.beforeEachRecord();
    this.con = getTestConnection(ApiType.Production);
  });

  afterEach(afterEachRecord);

  describe("#fetchHistoryAcrossLinks", () => {
    it("fetches the history of a package without a link", async function () {
      const head: Commit = await fetchHistoryAcrossLinks(this.con, {
        apiUrl,
        name: "vagrant-scp",
        projectName: "Virtualization:vagrant"
      }).should.be.fulfilled;

      head.should.deep.include({
        revisionHash: "3e0e3566753dca94980d3acd23b82efd",
        commitMessage: "Bump patched dependency on bundler to 2.1",
        requestId: 788130,
        userId: "dirkmueller",
        commitTime: new Date("Wed, 25 Mar 2020 11:45:20 +0100")
      });

      const common = {
        packageName: "vagrant-scp",
        projectName: "Virtualization:vagrant"
      };

      const addCommon = (
        pkgs: Omit<PackageFile, "packageName" | "projectName">[]
      ) => pkgs.map((f) => ({ ...f, ...common }));

      const filesAtHead: PackageFile[] = addCommon([
        {
          name: "0001-change-dependency-on-bundler-to-2.1.patch",
          md5Hash: "8d191aba887b640115e1f133e57d856d",
          size: 855,
          modifiedTime: new Date("Wed, 25 Mar 2020 11:29:28 +0100")
        },
        {
          name: "0002-change-dependency-on-net-scp-to-2.0.patch",
          md5Hash: "59567f9e2785cd89678a580b9a05f510",
          size: 756,
          modifiedTime: new Date("Wed, 25 Mar 2020 11:29:28 +0100")
        },
        {
          name: "vagrant-scp-0.5.7.gem",
          md5Hash: "5f5783c9015a346dc703f6b3a0a360bb",
          size: 7680,
          modifiedTime: new Date("Thu, 06 Jun 2019 09:17:56 +0200")
        },
        {
          name: "vagrant-scp.changes",
          md5Hash: "f1bde4de093da6d0a7d363c8ab386d97",
          size: 917,
          modifiedTime: new Date("Wed, 25 Mar 2020 11:29:29 +0100")
        },
        {
          name: "vagrant-scp.spec",
          md5Hash: "6401a0459cc9b66146002989b55c96d0",
          size: 2834,
          modifiedTime: new Date("Wed, 25 Mar 2020 11:29:30 +0100")
        }
      ]);

      expect(head.files).to.have.length(filesAtHead.length);

      filesAtHead.forEach((file) =>
        head.files.should.include.a.thing.that.deep.equals(file)
      );

      expect(head.parentCommits).to.have.length(1);
      const headMinus1 = head.parentCommits![0];
      headMinus1.should.deep.include({
        revisionHash: "7303deb8640d5adce5b8f09c9638fbaf",
        commitMessage:
          "add runtime dependencies as BuildRequires, to easier notice missing dependencies; add patches to use newer versions of bundler and net-scp",
        requestId: 712282,
        userId: "dancermak",
        commitTime: new Date("Fri, 23 Aug 2019 14:16:39 +0200")
      });

      const filesAtHeadMinus1: PackageFile[] = addCommon([
        {
          name: "0001-change-dependency-on-bundler-to-2.0.patch",
          md5Hash: "a451409b3ee0893ba41d34927d2674c4",
          size: 969,
          modifiedTime: new Date("Thu, 27 Jun 2019 22:08:00 +0200")
        },
        {
          name: "0002-change-dependency-on-net-scp-to-2.0.patch",
          md5Hash: "bf26d9e9ee2e07a7146aac3bc727b1db",
          size: 870,
          modifiedTime: new Date("Thu, 27 Jun 2019 22:08:00 +0200")
        },
        {
          name: "vagrant-scp-0.5.7.gem",
          md5Hash: "5f5783c9015a346dc703f6b3a0a360bb",
          size: 7680,
          modifiedTime: new Date("Thu, 06 Jun 2019 09:17:56 +0200")
        },
        {
          name: "vagrant-scp.changes",
          md5Hash: "5ff2b463dadc41cb5b8ec836aeb021c0",
          size: 567,
          modifiedTime: new Date("Thu, 27 Jun 2019 22:08:00 +0200")
        },
        {
          name: "vagrant-scp.spec",
          md5Hash: "9955049dd2e692520720de9dfe6b4514",
          size: 2847,
          modifiedTime: new Date("Thu, 27 Jun 2019 22:08:01 +0200")
        }
      ]);

      expect(headMinus1.files).to.have.length(filesAtHeadMinus1.length);

      filesAtHeadMinus1.forEach((file) =>
        headMinus1.files.should.include.a.thing.that.deep.equals(file)
      );

      expect(headMinus1.parentCommits).to.have.length(1);
      const headMinus2 = headMinus1.parentCommits![0];

      headMinus2.should.deep.include({
        revisionHash: "eb31bb09da66845da76334c0554d062f",
        commitTime: new Date("Sun, 09 Jun 2019 21:42:54 +0200"),
        userId: "ojkastl_buildservice",
        commitMessage: "Install README.md & LICENSE.txt",
        requestId: 708417
      });

      const filesAtHeadMinus2: PackageFile[] = addCommon([
        {
          name: "vagrant-scp-0.5.7.gem",
          md5Hash: "5f5783c9015a346dc703f6b3a0a360bb",
          size: 7680,
          modifiedTime: new Date("Thu, 06 Jun 2019 09:17:56 +0200")
        },
        {
          name: "vagrant-scp.changes",
          md5Hash: "1b58a226c28184b72c2b00c1f422e42f",
          size: 189,
          modifiedTime: new Date("Thu, 06 Jun 2019 09:17:56 +0200")
        },
        {
          name: "vagrant-scp.spec",
          md5Hash: "901e6fc783baab282051a5c2d33c8bfc",
          size: 2481,
          modifiedTime: new Date("Fri, 07 Jun 2019 18:42:45 +0200")
        }
      ]);

      expect(headMinus2.files).to.have.length(filesAtHeadMinus2.length);

      filesAtHeadMinus2.forEach((file) =>
        headMinus2.files.should.include.a.thing.that.deep.equals(file)
      );

      expect(headMinus2.parentCommits).to.have.length(1);
      const headMinus3 = headMinus2.parentCommits![0];

      headMinus3.should.deep.include({
        revisionHash: "5bc0dc1d511915859525852bc11eee1d",
        commitTime: new Date("Thu, 06 Jun 2019 09:17:57 +0200"),
        userId: "ojkastl_buildservice",
        commitMessage: "first version, based on spec from vagrant-vbguest"
      });

      expect(headMinus3.parentCommits).to.equal(undefined);

      const filesAtHeadMinus3: PackageFile[] = [
        filesAtHeadMinus2[0],
        filesAtHeadMinus2[1],
        {
          ...common,
          name: "vagrant-scp.spec",
          md5Hash: "a5f3bab21510dfc40b04dd13e7fd369b",
          size: 2317,
          modifiedTime: new Date("Thu, 06 Jun 2019 09:17:56 +0200")
        }
      ];

      filesAtHeadMinus3.forEach((file) =>
        headMinus3.files.should.include.a.thing.that.deep.equals(file)
      );
    });

    it("fetches the history of a package with a link to Factory", async function () {
      const head: Commit = await fetchHistoryAcrossLinks(this.con, {
        apiUrl,
        name: "vagrant-sshfs",
        projectName: "Virtualization:vagrant"
      }).should.be.fulfilled;

      const obsAutocommitCommon = {
        commitMessage: "baserev update by copy to link target",
        userId: "buildservice-autocommit",
        projectName: "Virtualization:vagrant",
        packageName: "vagrant-sshfs"
      };

      expect(head).to.deep.include({
        revisionHash: "0c762c8491d7fc1d1d2f36801379c4c9",
        revision: 16,
        versionRevision: 18,
        ...obsAutocommitCommon,
        commitTime: new Date(">Wed, 01 Apr 2020 22:56:42 +0200"),
        requestId: 790711,
        expanded: true
      });

      expect(head.parentCommits).to.be.an("array").and.to.have.length(2);
      const headMinus1 = head.parentCommits;

      const request790711Commit = headMinus1![0];

      expect(request790711Commit).to.deep.include({
        revisionHash: "e0835a1ad5ca9332da77d1acb79b0d67",
        userId: "dancermak",
        revision: 15,
        versionRevision: 17,
        commitMessage: "Fix test suite failures (boo#1168371)",
        commitTime: new Date("Wed, 01 Apr 2020 22:49:28 +0200"),
        projectName: "Virtualization:vagrant",
        packageName: "vagrant-sshfs",
        expanded: true,
        requestId: undefined
      });

      expect(headMinus1![1]).to.deep.include({
        revisionHash: "0685aed734468d6df2debbf19435b2c9",
        userId: "dimstar_suse",
        revision: 8,
        versionRevision: 3,
        commitMessage: "Fix test suite failures (boo#1168371)",
        commitTime: new Date("Wed, 01 Apr 2020 22:56:42 +0200"),
        projectName: "openSUSE:Factory",
        packageName: "vagrant-sshfs",
        expanded: true,
        requestId: 790711
      });

      expect(request790711Commit.parentCommits).to.have.length(1);

      expect(request790711Commit.parentCommits![0]).to.deep.include({
        revisionHash: "6b0dcd2e2e084e6787b812137dcf398f",
        commitTime: new Date("Tue, 31 Mar 2020 17:16:05 +0200"),
        requestId: 789974,
        revision: 14,
        versionRevision: 16,
        ...obsAutocommitCommon
      });

      expect(request790711Commit.parentCommits![0].parentCommits)
        .to.be.an("array")
        .and.have.length(2);

      const request789968Commit = request790711Commit.parentCommits![0]
        .parentCommits![0];

      expect(request789968Commit).to.deep.include({
        revisionHash: "480dd2446e028ca573b49aae533bdf2b",
        version: undefined,
        commitTime: new Date("Tue, 31 Mar 2020 09:13:10 +0200"),
        userId: "dancermak",
        // don't check the commit message as it contains stupid line endings
        revision: 13,
        versionRevision: 15,
        projectName: "Virtualization:vagrant",
        packageName: "vagrant-sshfs",
        expanded: true,
        requestId: 789968
      });

      const expectedRequest789744Commit = {
        revisionHash: "53920fb19011774b2beb2ff13b6c420d",
        version: "1.3.4",
        userId: "dimstar_suse",
        commitTime: new Date("Tue, 31 Mar 2020 17:16:05 +0200"),
        projectName: "openSUSE:Factory",
        packageName: "vagrant-sshfs",
        expanded: true,
        requestId: 789974
      };
      const factoryRequest789744Commit = request790711Commit.parentCommits![0]
        .parentCommits![1];
      expect(factoryRequest789744Commit).to.deep.include(
        expectedRequest789744Commit
      );
      expect(headMinus1![1].parentCommits).to.be.an("array").and.have.length(1);
      expect(headMinus1![1].parentCommits![0]).to.deep.include(
        expectedRequest789744Commit
      );

      expect(request789968Commit.parentCommits)
        .to.be.an("array")
        .and.have.length(1);
      expect(request789968Commit.parentCommits![0]).to.deep.include({
        revisionHash: "6105ecf1d6bf9c9c852baebfef9e23d8",
        commitTime: new Date("Tue, 17 Mar 2020 13:09:22 +0100"),
        requestId: 785609,
        revision: 12,
        ...obsAutocommitCommon
      });

      expect(request789968Commit.parentCommits![0].parentCommits)
        .to.be.an("array")
        .and.have.length(2);

      const rel134Commit = request789968Commit.parentCommits![0]
        .parentCommits![0];
      expect(rel134Commit).to.deep.include({
        revisionHash: "f3673ea3a638aad7afb7fda1880bfd4d",
        userId: "dancermak",
        revision: 11,
        versionRevision: 13,
        commitMessage: "New upstream release 1.3.4",
        commitTime: new Date("Mon, 16 Mar 2020 13:10:53 +0100"),
        requestId: 785606,
        projectName: "Virtualization:vagrant",
        packageName: "vagrant-sshfs",
        expanded: true
      });

      const expectedUpstreamReleaseCommitFactory = {
        revisionHash: "5422cfee80b19eb2ca07167ea997407d",
        userId: "dimstar_suse",
        revision: 6,
        versionRevision: 1,
        commitMessage: "",
        commitTime: new Date("Tue, 17 Mar 2020 13:09:22 +0100"),
        requestId: 785609,
        projectName: "openSUSE:Factory",
        packageName: "vagrant-sshfs",
        expanded: true
      };

      expect(
        request789968Commit.parentCommits![0].parentCommits![1]
      ).to.deep.include(expectedUpstreamReleaseCommitFactory);
      expect(headMinus1![1].parentCommits![0].parentCommits)
        .to.be.an("array")
        .and.to.have.length(1);
      expect(
        headMinus1![1].parentCommits![0].parentCommits![0]
      ).to.deep.include(expectedUpstreamReleaseCommitFactory);

      expect(rel134Commit.parentCommits![0]).to.deep.include({
        revisionHash: "7c97eca85d86ac79c379b77810ac401b",
        commitTime: new Date("Fri, 14 Feb 2020 16:35:58 +0100"),
        requestId: 769042,
        revision: 10,
        ...obsAutocommitCommon
      });

      expect(rel134Commit.parentCommits![0].parentCommits)
        .to.be.an("array")
        .and.to.have.length(2);
      const rel133Commits = rel134Commit.parentCommits![0].parentCommits!;

      expect(rel133Commits[0]).to.deep.include({
        revisionHash: "f7a73aad4c605b0b987b1df69497da67",
        revision: 9,
        commitTime: new Date("Fri, 31 Jan 2020 12:52:18 +0100"),
        userId: "dancermak",
        commitMessage: "New upstream release 1.3.3",
        requestId: 768265,
        projectName: "Virtualization:vagrant",
        packageName: "vagrant-sshfs"
      });

      expect(rel133Commits[1]).to.deep.include({
        revisionHash: "58b8ed775afe7e9c9222fde3b1ea6eba",
        revision: 5,
        commitTime: new Date("Fri, 14 Feb 2020 16:35:58 +0100"),
        userId: "okurz-factory",
        commitMessage: "",
        requestId: 769042,
        projectName: "openSUSE:Factory",
        packageName: "vagrant-sshfs"
      });

      // check the Virtualization:vagrant branch first:
      // - baserev update by copy to link target
      expect(rel133Commits[0].parentCommits)
        .to.be.an("array")
        .and.have.length(1);
      const secondBaseRevUpdate = rel133Commits[0].parentCommits!;
      expect(secondBaseRevUpdate[0]).to.deep.include({
        revisionHash: "108d7335326450355547f8bb9c2bbfa0",
        revision: 8,
        commitTime: new Date("Fri, 08 Nov 2019 15:26:53 +0100"),
        ...obsAutocommitCommon,
        requestId: 746427
      });

      const request746427Commit = {
        revisionHash: "a2264bc001f5e808a26f38d12d40e09c",
        revision: 4,
        commitTime: new Date("Fri, 08 Nov 2019 15:26:52 +0100"),
        userId: "dimstar_suse",
        commitMessage: "",
        requestId: 746427,
        projectName: "openSUSE:Factory",
        packageName: "vagrant-sshfs"
      };

      const revision7 = {
        revisionHash: "cc139ba2b1718cc62d93722229e16a5a",
        revision: 7,
        commitTime: new Date("Thu, 07 Nov 2019 22:12:32 +0100"),
        userId: "dancermak",
        commitMessage: "Add missing sshfs dependency",
        requestId: 746422,
        projectName: "Virtualization:vagrant",
        packageName: "vagrant-sshfs"
      };

      expect(secondBaseRevUpdate[0].parentCommits).to.have.length(2);
      expect(secondBaseRevUpdate[0].parentCommits![0]).to.deep.include(
        revision7
      );
      expect(secondBaseRevUpdate[0].parentCommits![1]).to.deep.include(
        request746427Commit
      );

      expect(rel133Commits[1].parentCommits).to.have.length(1);
      expect(rel133Commits[1].parentCommits![0]).to.deep.include(
        request746427Commit
      );

      const factoryHeadMinus2 = rel133Commits[1].parentCommits![0];

      const request737442Commit = {
        revisionHash: "59b91ad3a6bbaf0bff26cfbc0deab234",
        revision: 3,
        commitTime: new Date("Fri, 11 Oct 2019 15:22:37 +0200"),
        userId: "dimstar_suse",
        commitMessage: "",
        requestId: 737442,
        projectName: "openSUSE:Factory",
        packageName: "vagrant-sshfs"
      };
      expect(factoryHeadMinus2.parentCommits).to.have.length(1);
      expect(factoryHeadMinus2.parentCommits![0]).to.deep.include(
        request737442Commit
      );

      expect(
        secondBaseRevUpdate[0].parentCommits![0].parentCommits
      ).to.have.length(1);
      const thirdBaseRevUpdate = secondBaseRevUpdate[0].parentCommits![0]
        .parentCommits![0];

      expect(thirdBaseRevUpdate).to.deep.include({
        revisionHash: "4fd9f144db09bfaa246fd0ad57c0d1bb",
        revision: 6,
        commitTime: new Date("Fri, 11 Oct 2019 15:22:37 +0200"),
        ...obsAutocommitCommon,
        requestId: 737442
      });

      expect(thirdBaseRevUpdate.parentCommits).to.have.length(2);
      expect(thirdBaseRevUpdate.parentCommits![0]).to.deep.include({
        revisionHash: "794c97b70ea21bd289f7775e4843e667",
        revision: 5,
        commitTime: new Date("Fri, 11 Oct 2019 12:22:03 +0200"),
        userId: "dancermak",
        commitMessage: "Fix vagrant box name in testsuite.sh",
        requestId: 736437,
        projectName: "Virtualization:vagrant",
        packageName: "vagrant-sshfs"
      });
      expect(thirdBaseRevUpdate.parentCommits![1]).to.deep.include(
        request737442Commit
      );

      expect(thirdBaseRevUpdate.parentCommits![0].parentCommits).to.have.length(
        1
      );
      const fourthBaseRevUpdate = thirdBaseRevUpdate.parentCommits![0]
        .parentCommits![0];

      expect(fourthBaseRevUpdate).to.deep.include({
        revisionHash: "eb7f3ba5b53e222d736fe9f872fc0728",
        revision: 4,
        commitTime: new Date("Wed, 02 Oct 2019 12:00:08 +0200"),
        requestId: 734337,
        ...obsAutocommitCommon
      });
      expect(fourthBaseRevUpdate.parentCommits).to.have.length(2);

      const request734337Commit = {
        revisionHash: "195b63bcfcd9f6d5e19a5249faee9602",
        revision: 2,
        commitTime: new Date("Wed, 02 Oct 2019 12:00:08 +0200"),
        userId: "dimstar_suse",
        commitMessage:
          "- Fix in testsuite.sh:\r\n  Ignore the return value of vagrant destroy -f in the cleanup function, so that\r\n  all cleanup tasks run even if vagrant destroy fails\r\n",
        requestId: 734337,
        projectName: "openSUSE:Factory",
        packageName: "vagrant-sshfs"
      };

      expect(fourthBaseRevUpdate.parentCommits![1]).to.deep.include(
        request734337Commit
      );

      // check the remainder of the history from Factory
      const factoryHeadMinus3 = factoryHeadMinus2.parentCommits![0];
      expect(factoryHeadMinus3.parentCommits).to.have.length(1);
      expect(factoryHeadMinus3.parentCommits![0]).to.deep.include(
        request734337Commit
      );

      const factoryHeadMinus4 = factoryHeadMinus3.parentCommits![0];
      expect(factoryHeadMinus4.parentCommits).to.have.length(1);
      const firstFactoryCommit = {
        revisionHash: "c4458905a38f029e0572e848e8083eb5",
        revision: 1,
        commitTime: new Date("Wed, 25 Sep 2019 08:22:59 +0200"),
        userId: "dimstar_suse",
        commitMessage:
          "I'd like to submit the vagrant-sshfs package to Factory.",
        requestId: 732747,
        projectName: "openSUSE:Factory",
        packageName: "vagrant-sshfs",
        parentCommits: undefined
      };
      expect(factoryHeadMinus4.parentCommits![0]).to.deep.include(
        firstFactoryCommit
      );

      // and now check the remaining commits in Virtualization:vagrant
      const revision3 = fourthBaseRevUpdate.parentCommits![0];
      expect(revision3).to.deep.include({
        revisionHash: "6ea8bfc4ffe5950c72b2a6853b78a7da",
        revision: 3,
        commitTime: new Date("Tue, 01 Oct 2019 15:23:11 +0200"),
        userId: "dancermak",
        commitMessage:
          "Fix for testsuite.sh's cleanup function: don't fail when vagrant destroy fails",
        requestId: 733761,
        projectName: "Virtualization:vagrant",
        packageName: "vagrant-sshfs"
      });

      expect(revision3.parentCommits).to.have.length(1);

      const revision2 = revision3.parentCommits![0];
      expect(revision2).to.deep.include({
        revisionHash: "1686a71fb2a3d98c8aaa17696d874a60",
        revision: 2,
        commitTime: new Date("Wed, 25 Sep 2019 08:22:59 +0200"),
        userId: "dimstar_suse",
        commitMessage: "initialized devel package after accepting 732747",
        requestId: 732747,
        projectName: "Virtualization:vagrant",
        packageName: "vagrant-sshfs"
      });

      expect(revision2.parentCommits).to.have.length(2);

      expect(revision2.parentCommits![1]).to.deep.include(firstFactoryCommit);
      const revision1 = revision2.parentCommits![0];
      expect(revision1).to.deep.include(vagrantSshfsRevision1);
    });

    xit("fetches the history of a package with a double link", async function () {
      const head = await fetchHistoryAcrossLinks(this.con, {
        apiUrl,
        name: "ruby2.6",
        projectName: "Virtualization:vagrant"
      });

      expect(head).to.not.equal(undefined);

      await fsPromises.writeFile(
        "./ruby2.6.svg",
        await drawHistoryToSvg(head!)
      );
    });

    xit("fetches the history of a package with an insane number of links", async function () {
      const head = await fetchHistoryAcrossLinks(this.con, {
        apiUrl,
        projectName: "OBS:Server:Unstable",
        name: "rubygem-rack"
      });
      expect(head).to.not.equal(undefined);

      await fsPromises.writeFile(
        "./rubygem-rack.svg",
        await drawHistoryToSvg(head!)
      );
    });

    xit("fetches the history of a package that was branched", async function () {
      const head = await fetchHistoryAcrossLinks(this.con, {
        apiUrl,
        name: "rubygem-nokogiri",
        projectName: "Virtualization:vagrant"
      });
      await fsPromises.writeFile(
        "./rubygem-nokogiri.svg",
        await drawHistoryToSvg(head!)
      );
    });
  });

  describe("#fetchFileContentsAtCommit", () => {
    it("retrieves the contents at revision 1", async function () {
      const commit: Commit = await fetchFileContentsAtCommit(
        this.con,
        {
          apiUrl,
          projectName: "Virtualization:vagrant",
          name: "vagrant-sshfs"
        },
        {
          ...vagrantSshfsRevision1,
          files: [
            "0001-Bump-testing-Vagrant-box-version.patch",
            "0001-remove-win32-dep.patch",
            "testsuite.sh",
            "vagrant-sshfs-1.3.1.gem",
            "vagrant-sshfs.changes",
            "vagrant-sshfs.spec"
          ].map((fname) => ({
            name: fname,
            projectName: "Virtualization:vagrant",
            packageName: "vagrant-sshfs"
          })),
          expanded: true
        }
      );

      expect(commit.files).to.contain.a.thing.that.deep.equal({
        name: "vagrant-sshfs.changes",
        modifiedTime: new Date("Tue, 17 Sep 2019 23:35:28 +0200"),
        md5Hash: "25675cbfd132797b73b7c87dc46f4a9b",
        projectName: "Virtualization:vagrant",
        packageName: "vagrant-sshfs",
        size: 326,
        contents: Buffer.from(dotChangesRev1)
      });
    });
  });
});

describe("Revision", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  describe("#fetchHistory", () => {
    it("fetches the revisions of Virtualization:vagrant/vagrant-sshfs correctly", async () => {
      await fetchHistory(con, {
        apiUrl,
        projectName: "Virtualization:vagrant",
        name: "vagrant-sshfs"
      }).should.eventually.deep.equal(vagrantSshfsHistory);
    });

    it("fetches the revisions of Virtualization:vagrant/vagrant-sshfs when invoked via Project and Package objects", async () => {
      await fetchHistory(con, {
        apiUrl,
        projectName: "Virtualization:vagrant",
        name: "vagrant-sshfs"
      }).should.eventually.deep.equal(vagrantSshfsHistory);
    });

    it("omits requestId when a commit was made directly", async () => {
      const hist = await fetchHistory(con, {
        apiUrl,
        projectName: "devel:tools",
        name: "ccls"
      });

      hist.should.include.a.thing.that.deep.equals({
        packageName: "ccls",
        projectName: "devel:tools",
        revision: 2,
        versionRevision: 2,
        revisionHash: "94baa213ad0f95c6d3893c3a5e929771",
        version: "0.20190314",
        commitTime: new Date("Wed, 10 Apr 2019 22:42:27 +0200"),
        userId: "dancermak",
        commitMessage: "run format_spec_file"
      });
    });

    it("omits the userId when the user is not known", async () => {
      const hist = await fetchHistory(con, {
        apiUrl,
        projectName: "openSUSE:Factory",
        name: "make"
      });

      hist.should.contain.a.thing.that.deep.equals({
        packageName: "make",
        projectName: "openSUSE:Factory",
        revision: 1,
        versionRevision: 16,
        revisionHash: "74349037c1f2d2d21a09f17d419d8906",
        version: "3.81",
        commitTime: new Date("Tue, 19 Dec 2006 00:17:05 +0100")
      });
      hist[0].should.not.have.property("userId");
    });
  });
});
