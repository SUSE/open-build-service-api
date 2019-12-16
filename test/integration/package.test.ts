/**
 * Copyright (c) 2019 SUSE LLC
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
import { fetchPackage, HistoryFetchType } from "../../src/package";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection
} from "./../test-setup";
import {
  vagrantSshfsDotChanges,
  vagrantSshfsDotChangesContents,
  vagrantSshfsHistory
} from "./data";

const vagrantSshfsDotChangesWithExtraFields = {
  ...vagrantSshfsDotChanges,
  md5Hash: "66d7770ac94e23f9064e28d30ca4857b",
  size: 953,
  modifiedTime: new Date("Thu, 07 Nov 2019 22:08:28 +0100")
};

describe("Package", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  const vagrantSshfsHistoryWithoutContents = vagrantSshfsHistory.map(rev => [
    rev,
    undefined
  ]);

  const baseFile = {
    projectName: "Virtualization:vagrant",
    packageName: "vagrant-sshfs"
  };

  const vagrantSshfsFileList = [
    {
      ...baseFile,
      name: "0001-Bump-testing-Vagrant-box-version.patch",
      md5Hash: "31ace9af07a8881d71f2acedf61d5a67",
      size: 781,
      modifiedTime: new Date("Tue, 17 Sep 2019 23:35:27 +0200")
    },
    {
      ...baseFile,
      name: "0001-remove-win32-dep.patch",
      md5Hash: "9542619a3fd52a88b7ed41afe2c50e57",
      size: 1279,
      modifiedTime: new Date("Thu, 14 Mar 2019 17:47:55 +0100")
    },
    {
      ...baseFile,
      name: "_link",
      md5Hash: "4a76f9f25487e87f320de3880ada3ca4",
      size: 124,
      modifiedTime: new Date("Fri, 08 Nov 2019 15:26:53 +0100")
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
      name: "vagrant-sshfs-1.3.1.gem",
      md5Hash: "ef1cae288d48a0b669d93f50f3b9b4ff",
      size: 33280,
      modifiedTime: new Date("Thu, 14 Mar 2019 15:52:19 +0100")
    },
    vagrantSshfsDotChangesWithExtraFields,
    {
      ...baseFile,
      name: "vagrant-sshfs.spec",
      md5Hash: "e4dffe2231fa49effbb713c11ecbb8dd",
      size: 4151,
      modifiedTime: new Date("Thu, 07 Nov 2019 22:08:29 +0100")
    }
  ];

  const vagrantSshfsFileListAtRev1 = [
    {
      ...baseFile,
      name: "0001-Bump-testing-Vagrant-box-version.patch",
      md5Hash: "31ace9af07a8881d71f2acedf61d5a67",
      size: 781,
      modifiedTime: new Date("Tue, 17 Sep 2019 23:35:27 +0200")
    },
    {
      ...baseFile,
      name: "0001-remove-win32-dep.patch",
      md5Hash: "9542619a3fd52a88b7ed41afe2c50e57",
      size: 1279,
      modifiedTime: new Date("Thu, 14 Mar 2019 17:47:55 +0100")
    },
    {
      ...baseFile,
      name: "testsuite.sh",
      md5Hash: "871eaad3ac9bc31a35eebfad6878a329",
      size: 1502,
      modifiedTime: new Date("Tue, 17 Sep 2019 23:35:27 +0200")
    },
    {
      ...baseFile,
      name: "vagrant-sshfs-1.3.1.gem",
      md5Hash: "ef1cae288d48a0b669d93f50f3b9b4ff",
      size: 33280,
      modifiedTime: new Date("Thu, 14 Mar 2019 15:52:19 +0100")
    },
    {
      ...baseFile,
      name: "vagrant-sshfs.changes",
      md5Hash: "25675cbfd132797b73b7c87dc46f4a9b",
      size: 326,
      modifiedTime: new Date("Tue, 17 Sep 2019 23:35:28 +0200")
    },
    {
      ...baseFile,
      name: "vagrant-sshfs.spec",
      md5Hash: "696ef7cef623a11a15345d2f5f1d1fe1",
      size: 4149,
      modifiedTime: new Date("Tue, 17 Sep 2019 23:35:28 +0200")
    }
  ];

  describe("#getPackage", () => {
    it("fetches the file list and sets the file properties of vagrant-sshfs", async function() {
      this.timeout(5000);

      await fetchPackage(con, "Virtualization:vagrant", "vagrant-sshfs", {
        pkgContents: false
      }).should.be.fulfilled.and.eventually.deep.equal({
        name: "vagrant-sshfs",
        project: "Virtualization:vagrant",
        history: vagrantSshfsHistoryWithoutContents,
        files: vagrantSshfsFileList
      });
    });

    it("doesn't fetch the history of vagrant-sshfs if disabled", async function() {
      this.timeout(5000);
      await fetchPackage(con, "Virtualization:vagrant", "vagrant-sshfs", {
        historyFetchType: HistoryFetchType.NoHistory,
        pkgContents: false
      }).should.be.fulfilled.and.eventually.not.have.property("history");
    });

    it("fetches the file contents if pkgContents is set to true or not specified", async function() {
      this.timeout(5000);

      const pkg = await fetchPackage(
        con,
        "Virtualization:vagrant",
        "vagrant-sshfs"
      ).should.be.fulfilled;

      pkg.should.have.property("files").that.includes.a.thing.that.deep.equals({
        ...vagrantSshfsDotChangesWithExtraFields,
        contents: vagrantSshfsDotChangesContents
      });

      await fetchPackage(con, "Virtualization:vagrant", "vagrant-sshfs", {
        pkgContents: true
      }).should.be.fulfilled.and.eventually.deep.equal(pkg);
    });

    it("fetches the files of the package at each revision", async function() {
      this.timeout(5000);

      const pkg = await fetchPackage(
        con,
        "Virtualization:vagrant",
        "vagrant-sshfs",
        {
          pkgContents: false,
          historyFetchType: HistoryFetchType.RevisionsAndFiles
        }
      ).should.be.fulfilled;

      pkg.should.have
        .property("history")
        .that.is.an("array")
        .and.has.length(vagrantSshfsHistory.length);

      pkg.history[vagrantSshfsHistory.length - 1].should.deep.equal([
        vagrantSshfsHistory[vagrantSshfsHistory.length - 1],
        vagrantSshfsFileList
      ]);

      pkg.history[0].should.deep.equal([
        vagrantSshfsHistory[0],
        vagrantSshfsFileListAtRev1
      ]);
    });
  });
});
