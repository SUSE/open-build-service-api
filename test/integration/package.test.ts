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

import { afterEach, beforeEach, describe, it } from "mocha";
import { fetchPackage, Package } from "../../src/package";
import { LocalRole } from "../../src/user";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection
} from "./../test-setup";
import { vagrantSshfsDotChanges, vagrantSshfsDotChangesContents } from "./data";
import { expect } from "chai";

const vagrantSshfsDotChangesWithExtraFields = {
  ...vagrantSshfsDotChanges,
  md5Hash: "37ba2436aa6e16238d4bd2cc9ad75a67",
  size: 2406,
  modifiedTime: new Date("Mon, 16 Mar 2020 13:03:27 +0100")
};

describe("Package", function() {
  this.timeout(5000);

  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  const baseFile = {
    projectName: "Virtualization:vagrant",
    packageName: "vagrant-sshfs"
  };

  const vagrantSshfsFileList = [
    {
      ...baseFile,
      name: "_link",
      md5Hash: "f49e52e83811420a95466683a18afc97",
      size: 124,
      modifiedTime: new Date("Fri, 14 Feb 2020 16:35:58 +0100")
    },
    {
      ...baseFile,
      name: "testsuite.sh",
      md5Hash: "d84584f65b02b4eb8990fce467bfe240",
      size: 1508,
      modifiedTime: new Date("Wed, 09 Oct 2019 12:12:57 +0200")
    },
    {
      ...baseFile,
      name: "vagrant-sshfs-1.3.4.tar.gz",
      md5Hash: "9de559bf9dcf0b9af4f2d0dd96663a34",
      size: 27579,
      modifiedTime: new Date("Mon, 16 Mar 2020 13:03:27 +0100")
    },
    {
      ...baseFile,
      name: "vagrant-sshfs-1.3.4.tar.gz.asc",
      md5Hash: "55600e43b3c7ab4286e3d94d8b4e4b90",
      size: 833,
      modifiedTime: new Date("Mon, 16 Mar 2020 13:03:27 +0100")
    },
    vagrantSshfsDotChangesWithExtraFields,
    {
      ...baseFile,
      name: "vagrant-sshfs.keyring",
      md5Hash: "f868df2487146cd0b2a716014e62f4a0",
      size: 32547,
      modifiedTime: new Date("Wed, 29 Jan 2020 11:07:33 +0100")
    },
    {
      ...baseFile,
      name: "vagrant-sshfs.spec",
      md5Hash: "9d7de1b6c79f736c4f59f1eeaa59dbba",
      size: 3832,
      modifiedTime: new Date("Mon, 16 Mar 2020 13:03:28 +0100")
    }
  ];

  describe("#fetchPackage", () => {
    it("fetches the file list and sets the file properties of vagrant-sshfs", async function() {
      await fetchPackage(con, "Virtualization:vagrant", "vagrant-sshfs", {
        retrieveFileContents: false,
        expandLinks: false
      }).should.be.fulfilled.and.eventually.deep.equal({
        name: "vagrant-sshfs",
        projectName: "Virtualization:vagrant",
        files: vagrantSshfsFileList,
        md5Hash: "f09465fd156e74d3e6673dbb60b9409c",
        meta: {
          description: "",
          name: "vagrant-sshfs",
          person: [
            {
              role: LocalRole.Bugowner,
              userId: "dancermak"
            },
            {
              role: LocalRole.Maintainer,
              userId: "dancermak"
            }
          ],
          project: "Virtualization:vagrant",
          title: ""
        }
      });
    });

    it("expands the file sources by default", async () => {
      const pkg: Package = await fetchPackage(
        con,
        "Virtualization:vagrant",
        "ruby2.6",
        {
          retrieveFileContents: false
        }
      ).should.be.fulfilled;

      expect(pkg.files).to.deep.equal(
        [
          {
            name: "CVE-2020-8130.patch",
            md5Hash: "fece8cafc259ced5ffd56ab85d936113",
            size: 498,
            modifiedTime: new Date("Fri, 06 Mar 2020 16:49:03 +0100")
          },
          {
            name: "rake-12.3.2.gem",
            md5Hash: "b97fd18f57ab31788face9b4d26b41de",
            size: 87040,
            modifiedTime: new Date("Fri, 06 Mar 2020 16:49:04 +0100")
          },
          {
            name: "ruby-2.6.5.tar.xz",
            md5Hash: "b8a4e2bdbb76485c3d6690e57be67750",
            size: 11553580,
            modifiedTime: new Date("Tue, 08 Oct 2019 11:57:55 +0200")
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
            md5Hash: "38aa6af34c205fca7c283b1e9f69226a",
            size: 6412,
            modifiedTime: new Date("Fri, 06 Mar 2020 16:49:04 +0100")
          },
          {
            name: "ruby2.6.macros",
            md5Hash: "d9ea685eb891c4105b28038ac237b2c0",
            size: 585,
            modifiedTime: new Date("Fri, 29 Jun 2018 14:59:11 +0200")
          },
          {
            name: "ruby2.6.spec",
            md5Hash: "a2e7118a84f7ec7f03336eda93abb841",
            size: 13745,
            modifiedTime: new Date("Fri, 06 Mar 2020 16:49:05 +0100")
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
        ].map(f => ({
          packageName: "ruby2.6",
          projectName: "Virtualization:vagrant",
          ...f
        }))
      );

      pkg.should.have.property("md5Hash", "13b55f9f232992fb7aea136112eeb5c6");
      pkg.projectName.should.equal("Virtualization:vagrant");
      pkg.name.should.equal("ruby2.6");
    });

    it("fetches the file contents if pkgContents is set to true or not specified", async () => {
      const pkg: Package = await fetchPackage(
        con,
        "Virtualization:vagrant",
        "vagrant-sshfs"
      ).should.be.fulfilled;

      pkg.should.have
        .property("files")
        .that.includes.a.thing.that.deep.equals(
          vagrantSshfsDotChangesWithExtraFields
        );

      const pkgWithFiles: Package = await fetchPackage(
        con,
        "Virtualization:vagrant",
        "vagrant-sshfs",
        {
          retrieveFileContents: true
        }
      ).should.be.fulfilled;

      pkgWithFiles.should.have
        .property("files")
        .that.includes.a.thing.that.deep.equals({
          ...vagrantSshfsDotChangesWithExtraFields,
          contents: vagrantSshfsDotChangesContents
        });
    });
  });
});
