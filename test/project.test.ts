import mock = require("mock-fs");

import { expect } from "chai";
import { promises as fsPromises } from "fs";
import { afterEach, beforeEach, describe, it } from "mocha";
import { checkOut, Project, readInCheckedOutProject } from "../src/project";

describe("#checkOut", () => {
  beforeEach(() => {
    mock({ dirExists: mock.directory({ items: {} }) });
  });

  afterEach(() => {
    mock.restore();
  });

  it("creates the project directory", async () => {
    const proj: Project = {
      apiUrl: "https://api.opensuse.org/",
      name: "testProject"
    };
    const dir = "./testDir";
    await checkOut(proj, dir).should.be.fulfilled;

    (await fsPromises.readFile(`${dir}/.osc/_apiurl`))
      .toString()
      .should.equal(proj.apiUrl);
    (await fsPromises.readFile(`${dir}/.osc/_project`))
      .toString()
      .should.equal(proj.name);
    (await fsPromises.readFile(`${dir}/.osc/_packages`))
      .toString()
      .should.include(`<project name="${proj.name}"/>`);
  });

  it("populates the .osc/_packages file", async () => {
    const projName = "testProjectWithPackages";
    const proj: Project = {
      apiUrl: "https://api.opensuse.org/",
      name: projName,
      packages: [
        { name: "foo", project: projName },
        { name: "bar", project: projName },
        { name: "baz", project: projName }
      ]
    };
    const dir = "./someDir";
    await checkOut(proj, dir).should.be.fulfilled;

    (await fsPromises.readFile(`${dir}/.osc/_packages`)).toString().should
      .equal(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<project name="${proj.name}">
  <package name="foo" state=" "/>
  <package name="bar" state=" "/>
  <package name="baz" state=" "/>
</project>`);
  });
});

describe("#readInCheckedOutProject", () => {
  const targetDir = "Virtualization:Appliances:Images:openSUSE-Tumbleweed";
  beforeEach(() => {
    const options: any = {
      "test/.osc/_apiurl": `https://api.example.org
`,
      "test/.osc/_project": `test
`,
      "test/.osc/_packages": `<project name="test" />
`,

      noDotOsc: mock.directory({ items: {} }),
      noUnderscorePackage: mock.directory({
        items: {
          ".osc": mock.directory({
            items: { _project: "foo", _apiurl: "https://api.foo.org" }
          })
        }
      })
    };

    // the following files have been taken from a checked out copy of the
    // project Virtualization:Appliances:Images:openSUSE-Tumbleweed
    options[`${targetDir}/.osc/_apiurl`] = `https://api.opensuse.org
`;
    options[
      `${targetDir}/.osc/_project`
    ] = `Virtualization:Appliances:Images:openSUSE-Tumbleweed
`;
    options[
      `${targetDir}/.osc/_packages`
    ] = `<project name="Virtualization:Appliances:Images:openSUSE-Tumbleweed">
  <package name="live-kiwi-hook" state=" " />
  <package name="livecd-openSUSE" state=" " />
  <package name="kiwi-images-vagrant" state=" " />
  <package name="kiwi-templates-JeOS" state=" " />
</project>`;

    mock(options);
  });

  afterEach(() => {
    mock.restore();
  });

  it("correctly reads in a test project", async () => {
    const testProj = await readInCheckedOutProject("test").should.be.fulfilled;

    expect(testProj).to.deep.equal({
      apiUrl: "https://api.example.org/",
      name: "test"
    });
  });

  it("correctly reads in an Virtualization:Appliances:Images:openSUSE-Tumbleweed", async () => {
    const VirtAppImgTw = await readInCheckedOutProject(targetDir).should.be
      .fulfilled;

    expect(VirtAppImgTw).to.deep.equal({
      apiUrl: "https://api.opensuse.org/",
      name: targetDir,
      packages: [
        { name: "live-kiwi-hook", project: targetDir },
        { name: "livecd-openSUSE", project: targetDir },
        { name: "kiwi-images-vagrant", project: targetDir },
        { name: "kiwi-templates-JeOS", project: targetDir }
      ]
    });
  });

  it("rejects a non existent directory", async () => {
    await readInCheckedOutProject("thisDoesNotExist").should.be.rejectedWith(
      /no such file or directory.*thisDoesNotExist/
    );
  });

  it("rejects a directory without a .osc dir", async () => {
    await readInCheckedOutProject("noDotOsc").should.be.rejectedWith(
      /no such file or directory.*noDotOsc\/.osc\//
    );
  });

  it("rejects a directory with one of the underscore files missing", async () => {
    await readInCheckedOutProject("noUnderscorePackage").should.be.rejectedWith(
      /no such file or directory.*noUnderscorePackage\/.osc\/_package/
    );
  });
});
