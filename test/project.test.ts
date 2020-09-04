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

import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import { Arch } from "../src/api/base-types";
import {
  Project,
  readInCheckedOutProject,
  updateCheckedOutProject
} from "../src/project";
import { LocalRole } from "../src/user";
import { pathExists, PathType } from "../src/util";
import { setupProjectFsMocks } from "./data";

const VirtApplImgOpenSUSETW =
  "Virtualization:Appliances:Images:openSUSE-Tumbleweed";

const VirtApplImgOpenSUSETWProj: Project = {
  apiUrl: "https://api.opensuse.org/",
  name: VirtApplImgOpenSUSETW,
  packages: [
    {
      name: "live-kiwi-hook",
      projectName: VirtApplImgOpenSUSETW
    },
    {
      name: "livecd-openSUSE",
      projectName: VirtApplImgOpenSUSETW
    },
    {
      name: "kiwi-images-vagrant",
      projectName: VirtApplImgOpenSUSETW
    },
    {
      name: "kiwi-templates-JeOS",
      projectName: VirtApplImgOpenSUSETW
    }
  ].map((pkg) => ({ ...pkg, apiUrl: "https://api.opensuse.org/" }))
};

const VirtApplImgOpenSUSETWProjMeta = {
  name: VirtApplImgOpenSUSETW,
  title: "openSUSE Tumbleweed Images",
  description: "Contains the Live CD, JeOS, Vagrant boxes and possibly more.",
  person: [
    { id: "dancermak", role: LocalRole.Maintainer },
    { id: "dcassany", role: LocalRole.Maintainer },
    { id: "favogt", role: LocalRole.Maintainer },
    { id: "gmoro", role: LocalRole.Maintainer }
  ],
  repository: [
    {
      name: "rpm",
      path: [{ project: "openSUSE:Factory", repository: "snapshot" }],
      arch: [Arch.X86_64, Arch.I586]
    },
    {
      name: "openSUSE_Tumbleweed_vanilla",
      path: [{ project: "openSUSE:Factory", repository: "snapshot" }],
      arch: [Arch.X86_64]
    },
    {
      name: "openSUSE_Tumbleweed_ARM",
      path: [{ project: "openSUSE:Factory:ARM", repository: "standard" }],
      arch: [Arch.Aarch64]
    },
    {
      name: "openSUSE_Tumbleweed",
      path: [
        {
          project: "Virtualization:Appliances:Images:openSUSE-Tumbleweed",
          repository: "rpm"
        },
        { project: "openSUSE:Factory", repository: "snapshot" }
      ],
      arch: [Arch.X86_64, Arch.I586]
    }
  ]
};

const targetDir = "Virtualization:Appliances:Images:openSUSE-Tumbleweed";

describe("Project", () => {
  describe("#readInCheckedOutProject", () => {
    beforeEach(() => setupProjectFsMocks(targetDir));
    afterEach(mockFs.restore);

    it("correctly reads in a test project", async () => {
      const testProj = await readInCheckedOutProject("test");

      expect(testProj).to.deep.equal({
        apiUrl: "https://api.example.org/",
        name: "test"
      });
    });

    it("correctly reads in an Virtualization:Appliances:Images:openSUSE-Tumbleweed", async () => {
      const VirtAppImgTw = await readInCheckedOutProject(targetDir);

      expect(VirtAppImgTw).to.deep.equal(VirtApplImgOpenSUSETWProj);
      // no _project_meta.json file => no meta property
      expect(VirtAppImgTw).to.not.have.property("meta");
    });

    it("correctly reads in an Virtualization:Appliances:Images:openSUSE-Tumbleweed with a _project_meta.json", async () => {
      const projDir = `${targetDir}_with_meta`;
      const VirtAppImgTw = await readInCheckedOutProject(projDir);

      expect(VirtAppImgTw).to.deep.equal({
        meta: VirtApplImgOpenSUSETWProjMeta,
        ...VirtApplImgOpenSUSETWProj
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
      await readInCheckedOutProject(
        "noUnderscorePackage"
      ).should.be.rejectedWith(
        /no such file or directory.*noUnderscorePackage\/.osc\/_package/
      );
    });

    it("does correctly read in a project with one package", async () => {
      await readInCheckedOutProject("onePackage")
        .should.eventually.have.property("packages")
        .that.deep.equals([
          {
            apiUrl: "https://api.example.org/",
            projectName: "justOnePackageInThisProject",
            name: "jtc"
          }
        ]);
    });
  });

  describe("#updateCheckedOutProject", () => {
    beforeEach(() => setupProjectFsMocks(targetDir));
    afterEach(mockFs.restore);

    it("throws an exception when the target project does not exist", async () => {
      expect(await pathExists("fooDir")).to.equal(undefined);

      await updateCheckedOutProject(
        VirtApplImgOpenSUSETWProj,
        "fooDir"
      ).should.be.rejectedWith(/no such file/i);
    });

    it("throws an exception when the project's name does not match the checked out one", async () => {
      const { name, ...rest } = VirtApplImgOpenSUSETWProj;
      await updateCheckedOutProject(
        {
          name: "not Virtualization:Appliances:Images:openSUSE-Tumbleweed",
          ...rest
        },
        targetDir
      ).should.be.rejectedWith(/cannot update the project/i);
    });

    it("throws an exception when the project's apiUrl does not match the checked out one", async () => {
      const { apiUrl, ...rest } = VirtApplImgOpenSUSETWProj;
      await updateCheckedOutProject(
        {
          apiUrl: "https://api.baz.org/",
          ...rest
        },
        targetDir
      ).should.be.rejectedWith(/cannot update the project/i);
    });

    it("creates the .osc_obs_ts subdir for 'vanilla' osc projects", async () => {
      const fullVirtApplImgOTWProj = {
        ...VirtApplImgOpenSUSETWProj,
        meta: VirtApplImgOpenSUSETWProjMeta
      };

      expect(await pathExists(`${targetDir}/.osc_obs_ts`)).to.equal(undefined);

      await updateCheckedOutProject(fullVirtApplImgOTWProj, targetDir);

      expect(
        await pathExists(`${targetDir}/.osc_obs_ts`, PathType.Directory)
      ).to.not.equal(undefined);

      await readInCheckedOutProject(targetDir).should.eventually.deep.equal(
        fullVirtApplImgOTWProj
      );
    });

    it("updates the project", async () => {
      const { packages, ...rest } = VirtApplImgOpenSUSETWProj;
      const { repository, person, ...metaRest } = VirtApplImgOpenSUSETWProjMeta;

      const newProj: Project = {
        ...rest,
        packages: packages!.slice(1, 3),
        meta: {
          ...metaRest,
          person: [{ id: "fooUser", role: LocalRole.Downloader }].concat(
            person.slice(1, 3)
          ),
          repository: repository.slice(0, 2).concat([
            {
              name: "barRepo",
              path: [
                { project: "devel:languages:elixir", repository: "unstable" }
              ],
              arch: [Arch.Riscv64]
            }
          ])
        }
      };

      expect(newProj).to.not.deep.equal({
        ...VirtApplImgOpenSUSETWProj,
        meta: VirtApplImgOpenSUSETWProjMeta
      });

      await updateCheckedOutProject(newProj, `${targetDir}_with_meta`);

      await readInCheckedOutProject(
        `${targetDir}_with_meta`
      ).should.eventually.deep.equal(newProj);
    });
  });
});
