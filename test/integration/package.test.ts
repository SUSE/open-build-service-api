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
import { after, afterEach, before, beforeEach, describe, it } from "mocha";
import { calculateHash } from "../../src/checksum";
import { setFileContentsAndCommit } from "../../src/file";
import { branchPackage, createPackage, fetchPackage } from "../../src/package";
import { createProject, deleteProject } from "../../src/project";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection,
  miniObsOnlyHook,
  skipIfNoMiniObs,
  swallowException
} from "./../test-setup";
import {
  vagrantSshfs,
  vagrantSshfsDotChangesContents,
  vagrantSshfsDotChangesWithExtraFields
} from "./data";

describe("Package", function () {
  this.timeout(5000);

  beforeEach(async function () {
    this.beforeEachRecord = beforeEachRecord;
    await this.beforeEachRecord();
    this.con = getTestConnection(ApiType.Production);
  });
  afterEach(afterEachRecord);

  describe("#fetchPackage", () => {
    it("fetches the file list and sets the file properties of vagrant-sshfs", async function () {
      const { files, ...rest } = vagrantSshfs;
      const vagrantSshfsWithoutContents = {
        ...rest,
        files: files.map((f) => {
          const { contents, ...restOfFile } = f;
          return restOfFile;
        })
      };
      await fetchPackage(this.con, "Virtualization:vagrant", "vagrant-sshfs", {
        retrieveFileContents: false
      }).should.eventually.deep.equal(vagrantSshfsWithoutContents);
    });

    it("doesn't expand links when told so", async function () {
      const pkg = await fetchPackage(
        this.con,
        "Virtualization:vagrant",
        "ruby2.6",
        {
          retrieveFileContents: false,
          expandLinks: false
        }
      );

      expect(pkg.files).to.deep.equal([
        {
          packageName: "ruby2.6",
          projectName: "Virtualization:vagrant",
          name: "_link",
          md5Hash: "fc0145177935b00fba3049952abaa962",
          size: 454,
          modifiedTime: new Date("Sun, 01 Jul 2018 19:15:19 +0200")
        }
      ]);
    });

    it("expands the file sources by default", async function () {
      const pkg = await fetchPackage(
        this.con,
        "Virtualization:vagrant",
        "ruby2.6",
        {
          retrieveFileContents: false
        }
      );

      expect(pkg.files).to.deep.equal(
        [
          {
            name: "ruby-2.6.6.tar.xz",
            md5Hash: "1aa8bd34dcaf5c4b58d563546de16919",
            size: 11567284,
            modifiedTime: new Date("Wed, 08 Apr 2020 01:41:12 +0200")
          },
          {
            name: "ruby2.6-default.macros",
            md5Hash: "0cb12b4f7f5bb2c6c09462717bc9d6d8",
            size: 186,
            modifiedTime: new Date("Fri, 29 Jun 2018 14:59:10 +0200")
          },
          {
            name: "ruby2.6-rpmlintrc",
            md5Hash: "41ac278955542049457b30562282ef43",
            size: 93,
            modifiedTime: new Date("Fri, 29 Jun 2018 14:59:10 +0200")
          },
          {
            name: "ruby2.6.changes",
            md5Hash: "7ed3d5d7e308249f68f613aa35427e0a",
            size: 7325,
            modifiedTime: new Date("Tue, 28 Apr 2020 19:59:06 +0200")
          },
          {
            name: "ruby2.6.macros",
            md5Hash: "d9ea685eb891c4105b28038ac237b2c0",
            size: 585,
            modifiedTime: new Date("Fri, 29 Jun 2018 14:59:11 +0200")
          },
          {
            name: "ruby2.6.spec",
            md5Hash: "06924500c59c3121c0a20ffe19fd540a",
            size: 13780,
            modifiedTime: new Date("Tue, 28 Apr 2020 19:59:06 +0200")
          },
          {
            name: "series",
            md5Hash: "d0b1b5813b722adf168ad5e694dcf246",
            size: 14,
            modifiedTime: new Date("Wed, 27 Mar 2019 18:18:01 +0100")
          },
          {
            name: "use-pie.patch",
            md5Hash: "991c0d4f9626b2c12a20647a15b3aff1",
            size: 610,
            modifiedTime: new Date("Wed, 27 Mar 2019 18:18:01 +0100")
          }
        ].map((f) => ({
          packageName: "ruby2.6",
          projectName: "Virtualization:vagrant",
          ...f
        }))
      );

      pkg.should.have.property("md5Hash", "8d34e047f7b4f1abfcc2d20f74e67bf5");
      pkg.projectName.should.equal("Virtualization:vagrant");
      pkg.name.should.equal("ruby2.6");
    });

    it("fetches the file contents if pkgContents is set to true (but not otherwise)", async function () {
      const pkg = await fetchPackage(
        this.con,
        "Virtualization:vagrant",
        "vagrant-sshfs"
      );

      pkg.should.have
        .property("files")
        .that.includes.a.thing.that.deep.equals(
          vagrantSshfsDotChangesWithExtraFields
        );

      const pkgWithFiles = await fetchPackage(
        this.con,
        "Virtualization:vagrant",
        "vagrant-sshfs",
        {
          retrieveFileContents: true
        }
      );

      pkgWithFiles.should.have
        .property("files")
        .that.includes.a.thing.that.deep.equals({
          ...vagrantSshfsDotChangesWithExtraFields,
          contents: vagrantSshfsDotChangesContents
        });
    });

    it("fetches the file contents of a package that has been branched", async function () {
      this.timeout(10000);

      const pkg = await fetchPackage(
        this.con,
        "Virtualization:vagrant",
        "rubygem-nokogiri",
        { retrieveFileContents: true }
      );

      expect(
        pkg.files.find((f) => f.name === "nokogiri-1.10.9.gem")
      ).to.deep.include({
        name: "nokogiri-1.10.9.gem",
        md5Hash: "2f8f00ede55dccec0cddd340d7100735",
        size: 9251328,
        modifiedTime: new Date("Tue, 03 Mar 2020 11:41:55 +0100")
      });
    });

    it("fetches the file contents of a package that has been branched with linkrev=base", async function () {
      this.timeout(10000);

      const pkg = await fetchPackage(
        this.con,
        "Virtualization:vagrant",
        "rubygem-nokogiri",
        { retrieveFileContents: true, linkedRevisionIsBase: true }
      );

      expect(
        pkg.files.find((f) => f.name === "nokogiri-1.10.4.gem")
      ).to.deep.include({
        name: "nokogiri-1.10.4.gem",
        md5Hash: "be51f9f1c51148871fa02876a7919685",
        size: 8983040,
        modifiedTime: new Date("Mon, 12 Aug 2019 08:56:30 +0200")
      });
    });
  });
});

describe("Package mutable tests", function () {
  this.timeout(10000);
  const con = getTestConnection(ApiType.MiniObs);

  const packageName = "ccls";
  const projectName = `home:${con.username}:testForBranch`;
  const ccls = {
    apiUrl: con.url,
    name: packageName,
    projectName
  };
  const contents = Buffer.from("contents or stuff");

  before(async function () {
    skipIfNoMiniObs(this);
    await createProject(con, {
      name: projectName,
      description: "Test project for branches",
      title: "Test for Branching"
    });
    await createPackage(con, projectName, packageName, "ccls");
    await setFileContentsAndCommit(con, {
      packageName,
      projectName,
      name: "ccls.spec",
      contents,
      modifiedTime: new Date(),
      md5Hash: calculateHash(contents, "md5"),
      size: contents.length
    });
  });

  const branchInHome = `home:${con.username}:branches:${projectName}`;
  const otherBranchInHome = `home:${con.username}:cclsBranch`;

  afterEach(
    miniObsOnlyHook(async () => {
      await Promise.all([
        swallowException(deleteProject, con, branchInHome),
        swallowException(deleteProject, con, otherBranchInHome)
      ]);
    })
  );

  after(() => swallowException(deleteProject, con, projectName));

  describe("#branchPackage", () => {
    it("branches ccls into the home project", async () => {
      const branchedPackage = await branchPackage(con, ccls);

      branchedPackage.should.deep.include({
        name: packageName,
        projectName: branchInHome,
        apiUrl: con.url
      });
      expect(branchedPackage.md5Hash).to.be.a("string");
      expect(branchedPackage.files).to.be.an("array").and.have.length(1);

      await fetchPackage(
        con,
        branchInHome,
        packageName
      ).should.eventually.deep.equal(branchedPackage);
    });

    it("branches ccls as cclz into the home project", async () => {
      const branchedPackage = await branchPackage(con, ccls, {
        targetPackage: "cclz"
      });

      branchedPackage.name.should.equals("cclz");

      await fetchPackage(
        con,
        branchInHome,
        "cclz"
      ).should.eventually.deep.equal(branchedPackage);
    });

    it(`branches ccls into the project ${otherBranchInHome}`, async () => {
      const branchedPackage = await branchPackage(con, ccls, {
        targetProject: otherBranchInHome
      });

      branchedPackage.name.should.equals(ccls.name);
      branchedPackage.projectName.should.equals(otherBranchInHome);

      await fetchPackage(
        con,
        otherBranchInHome,
        ccls.name
      ).should.eventually.deep.equal(branchedPackage);
    });

    it(`branches ccls as ccl into the project ${otherBranchInHome}`, async () => {
      const branchedPackage = await branchPackage(con, ccls, {
        targetProject: otherBranchInHome,
        targetPackage: "ccl"
      });

      branchedPackage.name.should.equals("ccl");
      branchedPackage.projectName.should.equals(otherBranchInHome);

      await fetchPackage(
        con,
        otherBranchInHome,
        "ccl"
      ).should.eventually.deep.equal(branchedPackage);
    });
  });
});
