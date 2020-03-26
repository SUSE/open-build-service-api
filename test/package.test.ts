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
import { vagrantSshfs, virtualizationVagrant } from "./integration/data";

describe("Package", () => {
  const path = join("empty", "vagrant-sshfs");
  const dotOscPath = join(path, ".osc");

  beforeEach(() => mock({ empty: mock.directory({ items: {} }) }));

  afterEach(() => mock.restore());

  describe("#checkOutPackage", () => {
    it("checks out vagrant-sshfs", async () => {
      await checkOutPackage(vagrantSshfs, virtualizationVagrant, path).should.be
        .fulfilled;

      existsSync(join(dotOscPath)).should.equal(true);

      readFileSync(join(dotOscPath, "_apiurl"))
        .toString()
        .should.deep.equal(virtualizationVagrant.apiUrl);
      readFileSync(join(dotOscPath, "_files")).toString().should.deep
        .equal(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<directory name="vagrant-sshfs" srcmd5="6105ecf1d6bf9c9c852baebfef9e23d8">
  <entry name="testsuite.sh" size="1508" md5="d84584f65b02b4eb8990fce467bfe240" mtime="1570615977"/>
  <entry name="vagrant-sshfs-1.3.4.tar.gz" size="27579" md5="9de559bf9dcf0b9af4f2d0dd96663a34" mtime="1584360207"/>
  <entry name="vagrant-sshfs-1.3.4.tar.gz.asc" size="833" md5="55600e43b3c7ab4286e3d94d8b4e4b90" mtime="1584360207"/>
  <entry name="vagrant-sshfs.changes" size="2406" md5="37ba2436aa6e16238d4bd2cc9ad75a67" mtime="1584360207"/>
  <entry name="vagrant-sshfs.keyring" size="32547" md5="f868df2487146cd0b2a716014e62f4a0" mtime="1580292453"/>
  <entry name="vagrant-sshfs.spec" size="3832" md5="9d7de1b6c79f736c4f59f1eeaa59dbba" mtime="1584360208"/>
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
        .equal(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<package name="vagrant-sshfs" project="Virtualization:vagrant">
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
        readFileSync(join(dotOscPath, f.name)).toString().should.equal("");
        readFileSync(join(path, f.name)).toString().should.equal("");
      });
    });

    it("throws an error if the package list has not been fetched yet", async () => {
      const { apiUrl, name, projectName } = vagrantSshfs;
      await checkOutPackage(
        { apiUrl, name, projectName },
        join("empty", "vagrant-sshfs")
      ).should.be.rejectedWith(Error, /file list has not been retrieved/i);
    });

    it("does not write a _meta file if the project's meta has not been fetched yet", async () => {
      const { apiUrl, name, projectName, files } = vagrantSshfs;
      await checkOutPackage({ apiUrl, name, projectName, files }, path).should
        .be.fulfilled;

      existsSync(join(dotOscPath, "_meta")).should.be.false;
    });
  });
});
