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
import { fetchPackage, Package } from "../../src/package";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection
} from "./../test-setup";
import {
  vagrantSshfs,
  vagrantSshfsDotChangesContents,
  vagrantSshfsDotChangesWithExtraFields
} from "./data";

describe("Package", function () {
  this.timeout(5000);

  beforeEach(function () {
    this.beforeEachRecord = beforeEachRecord;
    this.beforeEachRecord();
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
      }).should.be.fulfilled.and.eventually.deep.equal(
        vagrantSshfsWithoutContents
      );
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
      const pkg: Package = await fetchPackage(
        this.con,
        "Virtualization:vagrant",
        "ruby2.6",
        {
          retrieveFileContents: false
        }
      ).should.be.fulfilled;

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
            md5Hash: "54cb152363061b0afd93546f52929462",
            size: 6873,
            modifiedTime: new Date("Wed, 08 Apr 2020 16:42:56 +0200")
          },
          {
            name: "ruby2.6.macros",
            md5Hash: "d9ea685eb891c4105b28038ac237b2c0",
            size: 585,
            modifiedTime: new Date("Fri, 29 Jun 2018 14:59:11 +0200")
          },
          {
            name: "ruby2.6.spec",
            md5Hash: "c45d3c1ee83a51c3bf08c98693a50975",
            size: 13644,
            modifiedTime: new Date("Wed, 08 Apr 2020 01:41:15 +0200")
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

      pkg.should.have.property("md5Hash", "655cb52f5301b85d5707730c383df2d0");
      pkg.projectName.should.equal("Virtualization:vagrant");
      pkg.name.should.equal("ruby2.6");
    });

    it("fetches the file contents if pkgContents is set to true (but not otherwise)", async function () {
      const pkg: Package = await fetchPackage(
        this.con,
        "Virtualization:vagrant",
        "vagrant-sshfs"
      ).should.be.fulfilled;

      pkg.should.have
        .property("files")
        .that.includes.a.thing.that.deep.equals(
          vagrantSshfsDotChangesWithExtraFields
        );

      const pkgWithFiles: Package = await fetchPackage(
        this.con,
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
