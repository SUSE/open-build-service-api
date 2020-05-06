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

import mock = require("mock-fs");

import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { checkOutPackage } from "../src/package";
import { FileState, ModifiedPackage } from "../src/vcs";
import { vagrantSshfs, virtualizationVagrant } from "./integration/data";

describe("Package", () => {
  const path = join("empty", "vagrant-sshfs");
  const dotOscPath = join(path, ".osc");

  beforeEach(() => mock({ empty: mock.directory({ items: {} }) }));

  afterEach(() => mock.restore());

  describe("#checkOutPackage", () => {
    it("checks out vagrant-sshfs", async () => {
      const modPkg: ModifiedPackage = await checkOutPackage(vagrantSshfs, path);
      const { files, ...restOfVagrantSshfs } = vagrantSshfs;
      modPkg.should.deep.equal({
        ...restOfVagrantSshfs,
        path,
        files,
        filesInWorkdir: files.map((f) => ({
          ...f,
          state: FileState.Unmodified
        }))
      });

      existsSync(join(dotOscPath)).should.equal(true);

      readFileSync(join(dotOscPath, "_apiurl"))
        .toString()
        .should.deep.equal(virtualizationVagrant.apiUrl);
      readFileSync(join(dotOscPath, "_files")).toString().should.deep
        .equal(`<directory name="vagrant-sshfs" srcmd5="0c762c8491d7fc1d1d2f36801379c4c9">
  <entry name="0001-Use-var-run-run-symlink-for-tests.patch" size="1774" md5="aa67a02848aa376bcfe4b592e68fcfa7" mtime="1585774158"/>
  <entry name="0002-Use-opensuse-Tumbleweed.-uname-m-box-instead-of-Fedo.patch" size="836" md5="cb8759e4f95d2e9976b3cc45439d75ab" mtime="1585774160"/>
  <entry name="testsuite.sh" size="1503" md5="49f6bfd714eb157c56a6cf78c22e6ff3" mtime="1585774160"/>
  <entry name="vagrant-sshfs-1.3.4.tar.gz" size="27579" md5="9de559bf9dcf0b9af4f2d0dd96663a34" mtime="1584360207"/>
  <entry name="vagrant-sshfs-1.3.4.tar.gz.asc" size="833" md5="55600e43b3c7ab4286e3d94d8b4e4b90" mtime="1584360207"/>
  <entry name="vagrant-sshfs.changes" size="3365" md5="5e8a27e8637502765a7aea82c81613ea" mtime="1585774161"/>
  <entry name="vagrant-sshfs.keyring" size="32547" md5="f868df2487146cd0b2a716014e62f4a0" mtime="1580292453"/>
  <entry name="vagrant-sshfs.spec" size="4097" md5="2002203fe5e5e22daea44ba86ca98ebb" mtime="1585774167"/>
</directory>`);
      readFileSync(join(dotOscPath, "_project"))
        .toString()
        .should.equal(vagrantSshfs.projectName);
      readFileSync(join(dotOscPath, "_package"))
        .toString()
        .should.equal(vagrantSshfs.name);
      readFileSync(join(dotOscPath, "_osclib_version"))
        .toString()
        .should.equal("1.0");
      readFileSync(join(dotOscPath, "_meta")).toString().should
        .equal(`<package name="vagrant-sshfs" project="Virtualization:vagrant">
  <title>SSHFS synced folder implementation for Vagrant</title>
  <description>This Vagrant plugin adds synced folder support for mounting folders from the
Vagrant host into the Vagrant guest via SSHFS. In the default mode it does this
by executing the SSHFS client software within the guest, which creates an SSH
connection from the Vagrant guest back to the Vagrant host.

</description>
  <url>https://github.com/dustymabe/%{name}</url>
  <person userid="dancermak" role="bugowner"/>
  <person userid="dancermak" role="maintainer"/>
</package>`);

      vagrantSshfs.files.forEach((f) => {
        readFileSync(join(dotOscPath, f.name)).toString().should.equal(f.name);
        readFileSync(join(path, f.name)).toString().should.equal(f.name);
      });
    });

    it("does not write a _meta file if the project's meta has not been fetched yet", async () => {
      const { apiUrl, name, projectName, files, md5Hash } = vagrantSshfs;
      await checkOutPackage(
        {
          apiUrl,
          name,
          projectName,
          md5Hash,
          files
        },
        path
      );
      existsSync(join(dotOscPath, "_meta")).should.be.false;
    });
  });
});
