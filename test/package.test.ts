/**
 * Copyright (c) 2022 SUSE LLC
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

import mockFs = require("mock-fs");

import { expect } from "chai";
import { promises as fsPromises } from "fs";
import { join } from "path";
import { Arch } from "../src/api/base-types";
import {
  checkOutPackage,
  fetchUnifiedPackage,
  readInCheckedOutPackage
} from "../src/package";
import { RepositoryWithFlags } from "../src/repository";
import { LocalRole } from "../src/user";
import { pathExists, PathType, rmRf } from "../src/util";
import { FileState } from "../src/vcs";
import { vagrantSshfs, virtualizationVagrant } from "./data";
import {
  afterEachRecordHook,
  ApiType,
  beforeEachRecordHook,
  createTemporaryDirectory,
  getTestConnection,
  unixToDos
} from "./test-setup";
import { calculateHash } from "../src/checksum";

describe("Package", () => {
  beforeEach(async function () {
    this.tmpDir = await createTemporaryDirectory();
    const rootDir = join(this.tmpDir, "empty");
    this.path = join(rootDir, "vagrant-sshfs");
    this.dotOscPath = join(this.path, ".osc");
    await fsPromises.mkdir(rootDir, { recursive: true });
  });

  afterEach(function () {
    return rmRf(this.tmpDir);
  });

  describe("#checkOutPackage", () => {
    it("checks out vagrant-sshfs", async function () {
      const modPkg = await checkOutPackage(
        Object.freeze(vagrantSshfs),
        this.path
      );
      const { files, ...restOfVagrantSshfs } = vagrantSshfs;
      modPkg.should.deep.equal({
        ...restOfVagrantSshfs,
        path: this.path,
        files,
        filesInWorkdir: files.map((f) => ({
          ...f,
          state: FileState.Unmodified
        }))
      });

      await pathExists(
        join(this.dotOscPath),
        PathType.Directory
      ).should.eventually.not.equal(undefined);

      (await fsPromises.readFile(join(this.dotOscPath, "_apiurl")))
        .toString()
        .should.deep.equal(virtualizationVagrant.apiUrl);
      (await fsPromises.readFile(join(this.dotOscPath, "_files"))).toString()
        .should.deep
        .equal(`<directory name="vagrant-sshfs" srcmd5="67206eaa7b5ce4691d09fafb0d849142">
  <entry name="0001-Use-var-run-run-symlink-for-tests.patch" size="1774" md5="aa67a02848aa376bcfe4b592e68fcfa7" mtime="1585774158"/>
  <entry name="0002-Use-opensuse-Tumbleweed.-uname-m-box-instead-of-Fedo.patch" size="836" md5="cb8759e4f95d2e9976b3cc45439d75ab" mtime="1585774160"/>
  <entry name="testsuite.sh" size="1503" md5="49f6bfd714eb157c56a6cf78c22e6ff3" mtime="1585774160"/>
  <entry name="vagrant-sshfs-1.3.4.tar.gz" size="27579" md5="9de559bf9dcf0b9af4f2d0dd96663a34" mtime="1584360207"/>
  <entry name="vagrant-sshfs-1.3.4.tar.gz.asc" size="833" md5="55600e43b3c7ab4286e3d94d8b4e4b90" mtime="1584360207"/>
  <entry name="vagrant-sshfs.changes" size="3534" md5="2f8fce37f601e56d459ad30787ab9532" mtime="1589297496"/>
  <entry name="vagrant-sshfs.keyring" size="32547" md5="f868df2487146cd0b2a716014e62f4a0" mtime="1580292453"/>
  <entry name="vagrant-sshfs.spec" size="4329" md5="b0eb5911e23c6c99baf22f1e85f7a620" mtime="1589297496"/>
  <linkinfo project="openSUSE:Factory" package="vagrant-sshfs" srcmd5="eeb0cd1461e64b5d6df871d11f406aed" baserev="eeb0cd1461e64b5d6df871d11f406aed" lsrcmd5="9ab168efd2fc2b2bc946ab0e4296453c"/>
</directory>`);
      (await fsPromises.readFile(join(this.dotOscPath, "_project")))
        .toString()
        .should.equal(vagrantSshfs.projectName);
      (await fsPromises.readFile(join(this.dotOscPath, "_package")))
        .toString()
        .should.equal(vagrantSshfs.name);
      (await fsPromises.readFile(join(this.dotOscPath, "_osclib_version")))
        .toString()
        .should.equal("1.0");
      (await fsPromises.readFile(join(this.dotOscPath, "_meta"))).toString()
        .should
        .equal(`<package name="vagrant-sshfs" project="Virtualization:vagrant">
  <title>SSHFS synced folder implementation for Vagrant</title>
  <description>This Vagrant plugin adds synced folder support for mounting folders from the
Vagrant host into the Vagrant guest via SSHFS. In the default mode it does this
by executing the SSHFS client software within the guest, which creates an SSH
connection from the Vagrant guest back to the Vagrant host.

</description>
  <url>https://github.com/dustymabe/vagrant-sshfs</url>
  <person userid="dancermak" role="bugowner"/>
  <person userid="dancermak" role="maintainer"/>
</package>`);

      await Promise.all(
        vagrantSshfs.files.map(async (f) => {
          (await fsPromises.readFile(join(this.dotOscPath, f.name)))
            .toString()
            .should.equal(f.name);
          (await fsPromises.readFile(join(this.path, f.name)))
            .toString()
            .should.equal(f.name);
        })
      );
    });

    it("does not write a _meta file if the project's meta has not been fetched yet", async function () {
      const { apiUrl, name, projectName, files, md5Hash } = vagrantSshfs;
      await checkOutPackage(
        Object.freeze({
          apiUrl,
          name,
          projectName,
          md5Hash,
          files
        }),
        this.path
      );
      await pathExists(join(this.dotOscPath, "_meta")).should.eventually.equal(
        undefined
      );
    });
  });

  describe("#readInCheckedOutPackage", () => {
    const apiUrl = "https://api.foo.org";
    const projectName = "testProject";
    const packageName = "testPackage";

    beforeEach(() =>
      mockFs({
        ".osc/_apiurl": apiUrl,
        ".osc/_project": projectName,
        ".osc/_files": "<directory />",
        ".osc/_osclib_version": "1.0",
        ".osc/_package": packageName,
        foo: "foo"
      })
    );

    afterEach(() => mockFs.restore());

    it("accepts completely new packages without any files", async () => {
      await readInCheckedOutPackage(".").should.eventually.deep.equal({
        apiUrl,
        name: packageName,
        projectName,
        files: [],
        md5Hash: calculateHash("", "md5")
      });
    });
  });
});

describe("UnifiedPackage", () => {
  const con = getTestConnection(ApiType.Production);
  beforeEach(beforeEachRecordHook);
  afterEach(afterEachRecordHook);

  describe("#fetchUnifiedPackage", () => {
    it("fetches the Rstudio package and automatically applies the repositories", async () => {
      const projName = "devel:languages:R:released";
      const pkgName = "rstudio";
      const pkg = await fetchUnifiedPackage(con, projName, pkgName);

      pkg.name.should.deep.equal(pkgName);
      pkg.projectName.should.deep.equal(projName);
      expect(pkg.url).to.deep.equal("https://github.com/rstudio/rstudio");

      expect(pkg.users).to.have.length(2);
      expect(pkg.groups).to.have.length(0);

      expect(pkg.users).to.include.a.thing.that.deep.equals({
        id: "dancermak",
        roles: [LocalRole.Bugowner, LocalRole.Maintainer]
      });
      expect(pkg.users).to.include.a.thing.that.deep.equals({
        id: "mvarlese",
        roles: [LocalRole.Maintainer]
      });

      expect(pkg.projectUsers).to.have.length(5);
      expect(pkg.projectGroups).to.deep.equal([
        { id: "factory-maintainers", roles: [LocalRole.Maintainer] }
      ]);

      ["Mailaender", "TheBlackCat", "deadpoint", "dsteuer", "mvarlese"].forEach(
        (id) =>
          expect(pkg.projectUsers).to.include.a.thing.that.deep.equals({
            id,
            roles: [LocalRole.Maintainer]
          })
      );

      expect(pkg.title).to.deep.equal("RStudio");
      expect(pkg.description).to.deep.equal(
        unixToDos(`RStudio is a set of integrated tools designed to help you be more productive
with R.

It includes a console, syntax-highlighting editor that supports direct code
execution, and a variety of robust tools for plotting, viewing history,
debugging and managing your workspace.`)
      );
      expect(pkg.repositories).to.be.an("array").and.have.length(16);

      const getRepoByName = (name: string): RepositoryWithFlags | undefined =>
        pkg.repositories.find((repo) => repo.name === name);

      expect(getRepoByName("openSUSE_Tumbleweed")).to.deep.equal({
        name: "openSUSE_Tumbleweed",
        arch: [Arch.I586, Arch.X86_64],
        path: [{ project: "openSUSE:Tumbleweed", repository: "standard" }],
        useForBuild: true,
        debugInfo: false,
        build: new Map([
          [Arch.X86_64, true],
          [Arch.I586, false]
        ]),
        publish: true
      });
    });
  });
});
