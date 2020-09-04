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
import {
  Arch,
  BlockMode,
  LinkedBuildMode,
  RebuildMode,
  ReleaseTrigger,
  VrevMode
} from "../../src/api/base-types";
import { DefaultValue } from "../../src/api/flag";
import {
  fetchProjectMeta,
  Kind,
  modifyProjectMeta,
  ProjectMeta
} from "../../src/api/project-meta";
import { ApiError } from "../../src/error";
import { deleteProject } from "../../src/project";
import { LocalRole } from "../../src/user";
import {
  afterEachRecordHook,
  ApiType,
  beforeEachRecordHook,
  getTestConnection,
  miniObsUsername,
  skipIfNoMiniObsHook,
  miniObsOnlyHook,
  swallowException
} from "./../test-setup";

const findRepoByNameBuilder = (proj: ProjectMeta) => (repoName: string) =>
  proj.repository?.find((elem) => elem.name === repoName);

describe("#fetchProjectMeta", () => {
  const prodCon = getTestConnection(ApiType.Production);

  beforeEach(beforeEachRecordHook);

  afterEach(afterEachRecordHook);

  it("should correctly parse openSUSE:Factory", async () => {
    const proj = await fetchProjectMeta(prodCon.clone(), "openSUSE:Factory");

    expect(proj.name).to.equal("openSUSE:Factory");

    // users
    expect(proj.person).to.deep.include({
      role: "maintainer",
      id: "dimstar_suse"
    });
    expect(proj.person).to.deep.include({
      role: "reviewer",
      id: "factory-auto"
    });

    // groups
    expect(proj.group).to.deep.include({
      id: "factory-maintainers",
      role: "maintainer"
    });
    expect(proj.group).to.deep.include({
      id: "factory-staging",
      role: "reviewer"
    });

    // lock defaults to false
    expect(proj.lock).to.equal(false);

    // these two are not set and should be undefined
    expect(proj.access).to.equal(undefined);
    expect(proj.sourceAccess).to.equal(undefined);

    // repositories
    const defaultArch = ["x86_64", "i586"];

    const findRepoByName = findRepoByNameBuilder(proj);

    expect(proj.repository).to.be.a("array").and.have.length(4);

    // check all repositories manually...
    expect(findRepoByName("standard")).to.deep.equal({
      arch: defaultArch,
      name: "standard",
      rebuild: "local"
    });
    expect(findRepoByName("ports")).to.deep.equal({
      arch: ["ppc64le", "ppc64", "ppc", "armv6l", "armv7l", "aarch64"],
      name: "ports"
    });
    expect(findRepoByName("snapshot")).to.deep.equal({
      arch: defaultArch,
      path: [{ project: "openSUSE:Tumbleweed", repository: "standard" }],
      name: "snapshot"
    });
    expect(findRepoByName("images")).to.deep.include({
      arch: ["local", "i586", "x86_64"],
      name: "images",
      path: [{ project: "openSUSE:Factory", repository: "standard" }],
      releaseTarget: [
        {
          project: "openSUSE:Factory:ToTest",
          repository: "images",
          trigger: "manual"
        }
      ]
    });
  });

  it("should correctly parse Virtualization:vagrant", async () => {
    const proj = await fetchProjectMeta(
      prodCon.clone(),
      "Virtualization:vagrant"
    );

    expect(proj.name).to.equal("Virtualization:vagrant");

    // users
    ["dancermak", "ojkastl_buildservice"].forEach((user) => {
      expect(proj.person).to.deep.include({
        role: "maintainer",
        id: user
      });
      expect(proj.person).to.deep.include({
        role: "bugowner",
        id: user
      });
    });

    expect(proj.person).to.deep.include({
      role: "maintainer",
      id: "dirkmueller"
    });

    // no groups defined
    expect(proj.group).to.equal(undefined);

    // title & description
    expect(proj.title).to.equal("Devel project for Vagrant");
    expect(proj.description).to.equal(
      "This is the factory development project for Vagrant"
    );

    // repositories...
    expect(proj.repository).to.be.a("array").and.have.length(10);

    const findRepoByName = findRepoByNameBuilder(proj);
    expect(findRepoByName("openSUSE_Tumbleweed")).to.deep.equal({
      arch: ["i586", "x86_64"],
      name: "openSUSE_Tumbleweed",
      path: [{ project: "openSUSE:Factory", repository: "snapshot" }]
    });
    expect(findRepoByName("openSUSE_Tumbleweed_default_ruby")).to.deep.equal({
      arch: ["x86_64"],
      name: "openSUSE_Tumbleweed_default_ruby",
      path: [{ project: "openSUSE:Factory", repository: "snapshot" }]
    });
    expect(findRepoByName("openSUSE_Tumbleweed_and_d_l_r_e")).to.deep.equal({
      arch: ["x86_64"],
      name: "openSUSE_Tumbleweed_and_d_l_r_e",
      path: [
        {
          project: "devel:languages:ruby:extensions",
          repository: "openSUSE_Tumbleweed"
        },
        { project: "openSUSE:Factory", repository: "snapshot" }
      ]
    });
    expect(findRepoByName("openSUSE_Leap_15.1_ARM")).to.deep.equal({
      name: "openSUSE_Leap_15.1_ARM",
      arch: ["aarch64", "armv7l"],
      path: [{ project: "openSUSE:Leap:15.1:ARM", repository: "ports" }]
    });
    expect(findRepoByName("openSUSE_Leap_15.1")).to.deep.equal({
      name: "openSUSE_Leap_15.1",
      arch: ["x86_64"],
      path: [{ project: "openSUSE:Leap:15.1", repository: "standard" }]
    });
    expect(findRepoByName("openSUSE_Leap_15.2")).to.deep.equal({
      name: "openSUSE_Leap_15.2",
      arch: ["x86_64"],
      path: [{ project: "openSUSE:Leap:15.2", repository: "standard" }]
    });
    expect(findRepoByName("openSUSE_Leap_15.0")).to.deep.equal({
      name: "openSUSE_Leap_15.0",
      arch: ["x86_64"],
      path: [{ project: "openSUSE:Leap:15.0", repository: "standard" }]
    });
    expect(findRepoByName("openSUSE_Factory_ARM")).to.deep.equal({
      name: "openSUSE_Factory_ARM",
      arch: ["armv7l", "aarch64"],
      path: [{ project: "openSUSE:Factory:ARM", repository: "standard" }]
    });
    expect(findRepoByName("SLE_15-SP1")).to.deep.equal({
      name: "SLE_15-SP1",
      arch: ["x86_64", "aarch64"],
      path: [{ project: "SUSE:SLE-15-SP1:GA", repository: "standard" }]
    });
    expect(findRepoByName("SLE_15")).to.deep.equal({
      name: "SLE_15",
      arch: ["x86_64", "aarch64"],
      path: [{ project: "SUSE:SLE-15:GA", repository: "standard" }]
    });
  });

  it("should correctly parse the Virtualization repositories", async () => {
    const proj = await fetchProjectMeta(prodCon.clone(), "Virtualization");
    const findRepoByName = findRepoByNameBuilder(proj);

    expect(proj.name).to.equal("Virtualization");

    // see if we identify the downloader role correctly
    expect(proj.person).to.deep.include({
      role: "downloader",
      id: "christopolise"
    });

    // PowerPC repository includes a block mode setting!
    const ppcRepo = findRepoByName("openSUSE_Factory_PowerPC");
    expect(ppcRepo).to.have.property("block", BlockMode.Local);

    expect(proj)
      .to.have.property("build")
      .that.deep.equals({
        defaultValue: DefaultValue.Unspecified,
        disable: [
          { repository: "Kernel_HEAD_standard" },
          { repository: "Kernel_stable_standard" },
          { arch: "ppc", repository: "openSUSE_Factory_PowerPC" },
          { arch: "x86_64", repository: "openSUSE_Factory_PowerPC" },
          { arch: "x86_64", repository: "openSUSE_Factory_ARM" },
          { arch: "x86_64", repository: "openSUSE_Factory_zSystems" },
          { arch: "riscv64" }
        ],
        enable: []
      });

    expect(proj).to.have.property("debugInfo").that.deep.equals({
      defaultValue: DefaultValue.Enable,
      disable: [],
      enable: []
    });

    expect(proj)
      .to.have.property("publish")
      .that.deep.equals({
        defaultValue: DefaultValue.Unspecified,
        disable: [
          { repository: "Kernel_HEAD_standard" },
          { repository: "Kernel_stable_standard" }
        ],
        enable: []
      });

    // the RISCV repo should have a disabled build for risv64, as that is
    // globally turned off
    const riscvRepo = findRepoByName("openSUSE_Factory_RISV");
    expect(riscvRepo).to.deep.equal({
      name: "openSUSE_Factory_RISV",
      path: [{ project: "openSUSE:Factory:RISCV", repository: "standard" }],
      arch: ["x86_64", "riscv64"]
    });

    // the Kernel_stable_standard repo has globally disabled builds and
    // publishing
    const kernelStableRepo = findRepoByName("Kernel_stable_standard");
    expect(kernelStableRepo).to.deep.equal({
      name: "Kernel_stable_standard",
      path: [{ project: "Kernel:stable", repository: "standard" }],
      arch: ["i586", "x86_64"]
    });
  });
});

describe("#modifyOrCreateProject", function () {
  const con = getTestConnection(ApiType.MiniObs);

  before(skipIfNoMiniObsHook);
  after(
    miniObsOnlyHook(() =>
      Promise.all(
        projNames.map((name) => swallowException(deleteProject, con, name))
      )
    )
  );

  const projNames = [
    `home:${miniObsUsername}:obs_ts_test`,
    `home:${miniObsUsername}:set_as_many_properties_as_we_can`
  ];

  this.timeout(10000);

  it("creates a new project", async function () {
    const name = projNames[0];
    const newProj: ProjectMeta = {
      description: `This is a project that has been created to test obs.ts
It should be gone soon.`,
      name,
      title: "Testproject created by obs.ts"
    };
    const statusOk = {
      code: "ok",
      summary: "Ok"
    };

    await modifyProjectMeta(con, newProj).should.eventually.deep.equal(
      statusOk
    );

    // OBS automatically adds the owner of the home project as the maintainer
    newProj.person = [{ id: miniObsUsername, role: LocalRole.Maintainer }];

    await fetchProjectMeta(con, name).should.eventually.deep.equal(newProj);

    await deleteProject(con, name).should.eventually.deep.equal(statusOk);

    await fetchProjectMeta(con, name).should.be.rejectedWith(
      ApiError,
      "unknown_project"
    );
  });

  it("creates a new complicated project", async function () {
    this.timeout(10000);
    const name = projNames[1];

    const newProj: ProjectMeta = {
      description: `This is a project that has been created to test obs.ts
It should be gone soon.

Here we just try to set as many different options as possible, to check that the XML payload is correct`,
      name,
      title: "Testproject created by obs.ts ;-)",
      person: [
        { id: miniObsUsername, role: LocalRole.Bugowner },
        { id: "Admin", role: LocalRole.Reader }
      ],
      link: [{ vrevmode: VrevMode.Unextend, project: "openSUSE:Factory" }],
      group: [
        { id: "admins", role: LocalRole.Downloader },
        { id: "everyone", role: LocalRole.Reviewer }
      ],
      access: true,
      sourceAccess: false,
      lock: false,
      kind: Kind.Maintenance,
      url: "https://github.com/SUSE/open-build-service-api",
      build: { defaultValue: DefaultValue.Enable, enable: [], disable: [] },
      useForBuild: {
        defaultValue: DefaultValue.Disable,
        enable: [],
        disable: []
      },
      debugInfo: {
        defaultValue: DefaultValue.Unspecified,
        enable: [
          { arch: Arch.X86_64, repository: "test" },
          { arch: Arch.Riscv64, repository: "test" }
        ],
        disable: [{ arch: Arch.Aarch64, repository: "test" }]
      },
      publish: {
        defaultValue: DefaultValue.Unspecified,
        enable: [{ repository: "test" }],
        disable: []
      },
      repository: [
        {
          name: "test",
          arch: [
            Arch.X86_64,
            Arch.Aarch64,
            Arch.Ppc64,
            Arch.S390x,
            Arch.Riscv64
          ],
          rebuild: RebuildMode.Direct,
          block: BlockMode.Local,
          linkedBuild: LinkedBuildMode.LocalDep,
          releaseTarget: [
            {
              project: "openSUSE:Factory",
              repository: "standard",
              trigger: ReleaseTrigger.Manual
            }
          ],
          path: [
            { project: "openSUSE:Factory", repository: "standard" },
            { project: "openSUSE:Factory", repository: "ports" }
          ]
        },
        { name: "anotherTest" }
      ]
    };
    const statusOk = {
      code: "ok",
      summary: "Ok"
    };

    await modifyProjectMeta(con, newProj).should.eventually.deep.equal(
      statusOk
    );

    // OBS adds the home project owner automatically as a maintainer
    // ...unfortunately at another position
    newProj.person!.splice(1, 0, {
      id: miniObsUsername,
      role: LocalRole.Maintainer
    });

    await fetchProjectMeta(con, name).should.eventually.deep.equal(newProj);

    await deleteProject(con, name).should.eventually.deep.equal(statusOk);

    await fetchProjectMeta(con, name).should.be.rejectedWith(
      ApiError,
      "unknown_project"
    );
  });
});
