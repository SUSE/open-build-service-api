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

import mockFs = require("mock-fs");

import { promises as fsPromises } from "fs";
import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import {
  createProject,
  deleteProject,
  fetchProject,
  fetchProjectList,
  Project,
  checkOutProject,
  readInCheckedOutProject
} from "../../src/project";
import { LocalRole } from "../../src/user";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection,
  miniObsUsername,
  skipIfNoMiniObsHook,
  skipIfNoMiniObs
} from "./../test-setup";
import { createPackage, readInCheckedOutPackage } from "../../src/package";
import { newXmlParser } from "../../src/xml";
import { pathExists, PathType } from "../../src/util";
import { dirname, join } from "path";
import { normalizeUrl } from "../../src/connection";

describe("#fetchProject", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  it("fetches the Project of Virtualization:vagrant", async () => {
    const projectName = "Virtualization:vagrant";
    const virtualizationVagrant = await fetchProject(con, projectName, {
      getPackageList: false
    });

    expect(virtualizationVagrant).to.have.property("apiUrl", con.url);
    expect(virtualizationVagrant).to.have.property("name", projectName);
    expect(virtualizationVagrant).to.have.property("meta");
    expect(virtualizationVagrant).to.not.have.property("packages");

    expect(virtualizationVagrant.meta).to.deep.include({
      name: projectName,
      title: "Devel project for Vagrant"
    });
  });

  it("fetches the package list of Virtualization:Appliances:Images:openSUSE-Tumbleweed", async () => {
    const projectName = "Virtualization:Appliances:Images:openSUSE-Tumbleweed";
    const TW = await fetchProject(con, projectName);

    expect(TW).to.have.property("apiUrl", con.url);
    expect(TW).to.have.property("name", projectName);
    expect(TW).to.have.property("meta");
    expect(TW)
      .to.have.property("packages")
      .that.deep.equals(
        [
          "kiwi-images-vagrant",
          "kiwi-templates-JeOS",
          "live-kiwi-hook",
          "livecd-openSUSE",
          "livecd-tumbleweed-gnome",
          "livecd-tumbleweed-kde",
          "livecd-tumbleweed-x11",
          "livecd-tumbleweed-xfce"
        ].map((name) => ({ name, apiUrl: con.url, projectName }))
      );

    expect(TW.meta).to.deep.include({
      name: projectName,
      title: "openSUSE Tumbleweed Images",
      description:
        "Contains the Live CD, JeOS, Vagrant boxes and possibly more.",
      person: ["dancermak", "dcassany", "favogt", "gmoro"].map((userId) => ({
        userId,
        role: LocalRole.Maintainer
      }))
    });
  });
});

describe("#checkOut", function () {
  const con = getTestConnection(ApiType.MiniObs);

  this.timeout(15000);

  const projectName = `home:${miniObsUsername}:testProjectWithPackages`;
  const apiUrl = normalizeUrl(ApiType.MiniObs);
  const proj: Project = {
    apiUrl,
    name: projectName,
    packages: [
      { name: "foo", projectName },
      { name: "bar", projectName },
      { name: "baz", projectName }
    ].map((pkg) => ({ ...pkg, apiUrl }))
  };

  const projWithMeta: Project = {
    ...proj,
    meta: {
      description: "a test project with a _meta",
      title: proj.name.toLocaleUpperCase(),
      name: proj.name,
      person: [{ role: LocalRole.Maintainer, userId: miniObsUsername }],
      repository: [{ name: "foo" }]
    }
  };

  before(async () => {
    await createProject(con, projWithMeta.meta!);
    for (const pkg of proj.packages!) {
      await createPackage(con, proj, pkg.name, pkg.name);
    }
  });
  after(async () => deleteProject(con, proj));

  beforeEach(function () {
    skipIfNoMiniObs(this);
    mockFs({
      dirExists: mockFs.directory({ items: {} }),
      nonEmpty: { aFile: "foo" }
    });
  });
  afterEach(() => mockFs.restore());

  it("populates the _* files in the .osc/ directory", async () => {
    const dir = "./someDir";
    await checkOutProject(con, proj.name, dir);

    (await fsPromises.readFile(`${dir}/.osc/_apiurl`))
      .toString()
      .should.equal(proj.apiUrl);
    (await fsPromises.readFile(`${dir}/.osc/_project`))
      .toString()
      .should.equal(proj.name);

    // we have to parse the _packages file using the xml Parser, as the order of
    // the entries is not guaranteed
    const underscorePkg = await newXmlParser().parseStringPromise(
      (await fsPromises.readFile(`${dir}/.osc/_packages`)).toString()
    );
    underscorePkg.project.$.name.should.deep.equal(proj.name);
    proj.packages!.forEach((pkg) =>
      underscorePkg.project.package.should.include.a.thing.that.deep.equals({
        $: { name: pkg.name, state: " " }
      })
    );

    const metaLoc = `${dir}/.osc_obs_ts/_project_meta.json`;
    await pathExists(
      dirname(metaLoc),
      PathType.Directory
    ).should.eventually.not.equal(undefined);
    await pathExists(metaLoc, PathType.File).should.eventually.not.equal(
      undefined
    );

    JSON.parse(
      (await fsPromises.readFile(metaLoc)).toString()
    ).should.deep.equal(projWithMeta.meta);
  });

  it("creates the directory when it doesn't exist already", async () => {
    const dir = "./this_does_not_exist";
    await pathExists(dir).should.eventually.equal(undefined);

    await checkOutProject(con, proj, dir);
    await pathExists(dir).should.eventually.not.equal(undefined);
  });

  it("checks the project out into an empty directory", async () => {
    const dir = "./dirExists";
    await pathExists(dir).should.eventually.not.equal(undefined);

    await checkOutProject(con, proj, dir).should.be.fulfilled;

    const readInProj = await readInCheckedOutProject(dir);
    const { packages: ignore, ...rest } = readInProj;
    const { packages: ignore2, ...expectedRest } = projWithMeta;
    rest.should.deep.include(expectedRest);
  });

  it("refuses to checkout into a non-empty directory", async () => {
    const dir = "./nonEmpty";
    await pathExists(dir, PathType.Directory).should.eventually.not.equal(
      undefined
    );
    await pathExists(join(dir, "aFile")).should.eventually.not.equal(undefined);

    await checkOutProject(con, proj, dir).should.be.rejectedWith(
      /directory.*nonEmpty.*is not empty, the following file already exist.*aFile/
    );
  });

  it("refuses to checkout into a file", async () => {
    const dir = "./nonEmpty/aFile";
    await pathExists(dir, PathType.File).should.eventually.not.equal(undefined);

    await checkOutProject(con, proj, dir).should.be.rejectedWith(
      /cannot create the directory.*nonEmpty\/aFile.*already exists but is not a directory/
    );
  });

  it("it does not pollute .osc/ with files that osc doesn't expect", async () => {
    const dir = "testDirForOscCompat";
    await checkOutProject(con, proj, dir);

    await fsPromises
      .readdir(`${dir}/.osc/`)
      .should.eventually.deep.equal(["_apiurl", "_packages", "_project"]);
  });

  it("allows to checkout a subset of the packages", async () => {
    const dir = `./${proj.name}`;
    const pkgName = "foo";
    await checkOutProject(con, proj, dir, [pkgName]);

    const pkgDir = join(dir, pkgName);
    await pathExists(pkgDir, PathType.Directory).should.eventually.not.equal(
      undefined
    );

    await readInCheckedOutPackage(pkgDir).should.eventually.deep.include({
      name: pkgName,
      projectName: proj.name,
      apiUrl: proj.apiUrl
    });
  });

  it("throws an error when a non-existent package has been requested", async () => {
    await checkOutProject(con, proj, "whatever", [
      "foo",
      "invalidPackage"
    ]).should.be.rejectedWith(/invalid package list provided.*invalidPackage/);
  });
});

describe("#fetchProjectList", function () {
  this.timeout(15000);
  before(skipIfNoMiniObsHook);

  const con = getTestConnection(ApiType.MiniObs);

  it("fetches the list of all projects", async () => {
    const projectsBefore = await fetchProjectList(con);
    const name = `home:${miniObsUsername}:for_the_search`;
    expect(projectsBefore.find((proj) => proj.name === name)).to.equal(
      undefined
    );

    await createProject(con, {
      name,
      description: "to show up in the search",
      title: "For the search"
    });

    const projectsAfter = await fetchProjectList(con);
    expect(projectsAfter).to.include.a.thing.that.deep.equals({
      name,
      apiUrl: con.url
    });

    await deleteProject(con, name);
  });
});
