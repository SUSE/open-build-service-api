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

import { describe, it } from "mocha";
import { Arch } from "../src/api/base-types";
import {
  BuildResult,
  BuildStatusView,
  fetchBuildResults,
  PackageStatusCode,
  RepositoryCode
} from "../src/build-result";
import {
  afterEachRecordHook,
  ApiType,
  beforeEachRecordHook,
  getTestConnection
} from "./test-setup";

describe("BuildResult", function () {
  this.timeout(10000);
  const con = getTestConnection(ApiType.Production);

  beforeEach(beforeEachRecordHook);
  afterEach(afterEachRecordHook);

  describe("#fetchBuildStatus", () => {
    it("fetches the build result of a single package", async () => {
      const project = "devel:tools";
      const packageStatusUnresolvable = new Map([
        [
          "ccls",
          {
            code: PackageStatusCode.Unresolvable,
            details: "nothing provides rapidjson-devel"
          }
        ]
      ]);
      const packageStatusSucceeded = new Map([
        ["ccls", { code: PackageStatusCode.Succeeded }]
      ]);
      const packageStatusDisabled = new Map([
        ["ccls", { code: PackageStatusCode.Disabled }]
      ]);
      const expected: BuildResult[] = [
        {
          repository: "openSUSE_Tumbleweed",
          arch: Arch.I586,
          code: RepositoryCode.Published,
          packageStatus: packageStatusSucceeded
        },
        {
          repository: "openSUSE_Tumbleweed",
          arch: Arch.X86_64,
          code: RepositoryCode.Building,
          dirty: true,
          packageStatus: packageStatusSucceeded
        },
        {
          repository: "openSUSE_Leap_15.2",
          arch: Arch.X86_64,
          code: RepositoryCode.Published,
          dirty: true,
          packageStatus: packageStatusSucceeded
        },
        {
          repository: "openSUSE_Leap_15.1",
          arch: Arch.X86_64,
          code: RepositoryCode.Published,
          dirty: true,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "openSUSE_Factory_zSystems",
          arch: Arch.S390x,
          code: RepositoryCode.Blocked,
          packageStatus: packageStatusSucceeded
        },
        {
          repository: "openSUSE_Factory_PowerPC",
          arch: Arch.Ppc64le,
          code: RepositoryCode.Building,
          packageStatus: packageStatusSucceeded
        },
        {
          repository: "openSUSE_Factory_PowerPC",
          arch: Arch.Ppc64,
          code: RepositoryCode.Building,
          packageStatus: packageStatusSucceeded
        },
        {
          repository: "openSUSE_Factory_ARM",
          arch: Arch.Armv7l,
          code: RepositoryCode.Building,
          packageStatus: packageStatusSucceeded
        },
        {
          repository: "openSUSE_Factory_ARM",
          arch: Arch.Aarch64,
          code: RepositoryCode.Blocked,
          packageStatus: packageStatusSucceeded
        },
        {
          repository: "SLE_15_SP2",
          arch: Arch.Aarch64,
          code: RepositoryCode.Published,
          packageStatus: packageStatusUnresolvable
        },
        {
          repository: "SLE_15_SP2",
          arch: Arch.Ppc64le,
          code: RepositoryCode.Published,
          packageStatus: packageStatusUnresolvable
        },
        {
          repository: "SLE_15_SP2",
          arch: Arch.S390x,
          code: RepositoryCode.Published,
          packageStatus: packageStatusUnresolvable
        },
        {
          repository: "SLE_15_SP2",
          arch: Arch.X86_64,
          code: RepositoryCode.Published,
          dirty: true,
          packageStatus: packageStatusUnresolvable
        },
        {
          repository: "SLE_15_SP1",
          arch: Arch.Aarch64,
          code: RepositoryCode.Published,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "SLE_15_SP1",
          arch: Arch.Ppc64le,
          code: RepositoryCode.Published,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "SLE_15_SP1",
          arch: Arch.S390x,
          code: RepositoryCode.Published,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "SLE_15_SP1",
          arch: Arch.X86_64,
          code: RepositoryCode.Published,
          dirty: true,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "SLE_15",
          arch: Arch.Aarch64,
          code: RepositoryCode.Published,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "SLE_15",
          arch: Arch.Ppc64le,
          code: RepositoryCode.Published,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "SLE_15",
          arch: Arch.S390x,
          code: RepositoryCode.Published,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "SLE_15",
          arch: Arch.X86_64,
          code: RepositoryCode.Published,
          dirty: true,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "SLE_12_SP5",
          arch: Arch.S390x,
          code: RepositoryCode.Published,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "SLE_12_SP5",
          arch: Arch.Aarch64,
          code: RepositoryCode.Published,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "SLE_12_SP5",
          arch: Arch.Ppc64le,
          code: RepositoryCode.Published,
          packageStatus: packageStatusDisabled
        },
        {
          repository: "SLE_12_SP5",
          arch: Arch.X86_64,
          code: RepositoryCode.Published,
          dirty: true,
          packageStatus: packageStatusDisabled
        }
      ].map((args) => {
        const { dirty, ...rest } = args;
        return { ...rest, project, dirty: dirty ?? false };
      });

      await fetchBuildResults(con, project, {
        packages: ["ccls"]
      }).should.eventually.deep.equal(expected);
    });

    it("fetches the summary of the whole repository", async () => {
      const project = "openSUSE:Factory";
      const allDisabledSummary = new Map([[PackageStatusCode.Disabled, 14644]]);
      const expected: BuildResult[] = [
        {
          repository: "standard",
          arch: Arch.X86_64,
          code: RepositoryCode.Published,
          summary: new Map([
            [PackageStatusCode.Succeeded, 14099],
            [PackageStatusCode.Failed, 135],
            [PackageStatusCode.Unresolvable, 36],
            [PackageStatusCode.Disabled, 4],
            [PackageStatusCode.Excluded, 370]
          ])
        },
        {
          repository: "standard",
          arch: Arch.I586,
          code: RepositoryCode.Building,
          summary: new Map([
            [PackageStatusCode.Succeeded, 13753],
            [PackageStatusCode.Failed, 136],
            [PackageStatusCode.Unresolvable, 74],
            [PackageStatusCode.Building, 1],
            [PackageStatusCode.Disabled, 5],
            [PackageStatusCode.Excluded, 675]
          ])
        },
        {
          repository: "snapshot",
          arch: Arch.X86_64,
          code: RepositoryCode.Unpublished,
          summary: allDisabledSummary
        },
        {
          repository: "snapshot",
          arch: Arch.I586,
          code: RepositoryCode.Unpublished,
          summary: allDisabledSummary
        },
        {
          repository: "ports",
          arch: Arch.Ppc64le,
          code: RepositoryCode.Unpublished,
          summary: allDisabledSummary
        },
        {
          repository: "ports",
          arch: Arch.Ppc64,
          code: RepositoryCode.Unpublished,
          summary: allDisabledSummary
        },
        {
          project,
          repository: "ports",
          arch: Arch.Ppc,
          code: RepositoryCode.Unpublished,
          summary: allDisabledSummary
        },
        {
          project,
          repository: "ports",
          arch: Arch.Armv6l,
          code: RepositoryCode.Unpublished,
          summary: allDisabledSummary
        },
        {
          project,
          repository: "ports",
          arch: Arch.Armv7l,
          code: RepositoryCode.Unpublished,
          summary: allDisabledSummary
        },
        {
          repository: "ports",
          arch: Arch.Aarch64,
          code: RepositoryCode.Unpublished,
          summary: allDisabledSummary
        },
        {
          project,
          repository: "images",
          arch: Arch.Local,
          code: RepositoryCode.Blocked,
          summary: new Map([
            [PackageStatusCode.Succeeded, 4],
            [PackageStatusCode.Failed, 3],
            [PackageStatusCode.Blocked, 1],
            [PackageStatusCode.Disabled, 5],
            [PackageStatusCode.Excluded, 14631]
          ])
        },
        {
          repository: "images",
          arch: Arch.I586,
          code: RepositoryCode.Blocked,
          summary: new Map([
            [PackageStatusCode.Succeeded, 12],
            [PackageStatusCode.Blocked, 1],
            [PackageStatusCode.Disabled, 6],
            [PackageStatusCode.Excluded, 14625]
          ])
        },
        {
          repository: "images",
          arch: Arch.X86_64,
          code: RepositoryCode.Unpublished,
          summary: new Map([
            [PackageStatusCode.Succeeded, 84],
            [PackageStatusCode.Unresolvable, 1],
            [PackageStatusCode.Disabled, 5],
            [PackageStatusCode.Excluded, 14554]
          ])
        }
      ].map((args) => ({ project, dirty: false, ...args }));

      await fetchBuildResults(con, "openSUSE:Factory", {
        views: [BuildStatusView.Summary]
      }).should.eventually.deep.equal(expected);
    });

    it("fetches the binaries of a few packages for a subset of the repositories", async () => {
      const project = "utilities";
      const expected: BuildResult[] = [
        {
          repository: "openSUSE_Leap_15.2",
          arch: Arch.X86_64,
          code: RepositoryCode.Published,
          dirty: true,
          binaries: new Map([
            [
              "jq",
              [
                {
                  filename: "_buildenv",
                  size: 15818,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:23 +0200")
                },
                {
                  filename: "_statistics",
                  size: 949,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:23 +0200")
                },
                {
                  filename: "jq-1.6-lp152.29.1.src.rpm",
                  size: 1204345,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:23 +0200")
                },
                {
                  filename: "jq-1.6-lp152.29.1.x86_64.rpm",
                  size: 66160,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:23 +0200")
                },
                {
                  filename: "jq-debuginfo-1.6-lp152.29.1.x86_64.rpm",
                  size: 24888,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:24 +0200")
                },
                {
                  filename: "jq-debugsource-1.6-lp152.29.1.x86_64.rpm",
                  size: 141972,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:24 +0200")
                },
                {
                  filename: "libjq-devel-1.6-lp152.29.1.x86_64.rpm",
                  size: 12980,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:24 +0200")
                },
                {
                  filename: "libjq1-1.6-lp152.29.1.x86_64.rpm",
                  size: 120048,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:24 +0200")
                },
                {
                  filename: "libjq1-debuginfo-1.6-lp152.29.1.x86_64.rpm",
                  size: 195400,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:24 +0200")
                },
                {
                  filename: "rpmlint.log",
                  size: 734,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:23 +0200")
                }
              ]
            ],
            [
              "jtc",
              [
                {
                  filename: "_buildenv",
                  size: 15120,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:04 +0200")
                },
                {
                  filename: "_statistics",
                  size: 892,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:04 +0200")
                },
                {
                  filename: "jtc-1.76d-lp152.10.1.src.rpm",
                  size: 236817,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:04 +0200")
                },
                {
                  filename: "jtc-1.76d-lp152.10.1.x86_64.rpm",
                  size: 302960,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:05 +0200")
                },
                {
                  filename: "jtc-debuginfo-1.76d-lp152.10.1.x86_64.rpm",
                  size: 1486640,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:05 +0200")
                },
                {
                  filename: "jtc-debugsource-1.76d-lp152.10.1.x86_64.rpm",
                  size: 136680,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:05 +0200")
                },
                {
                  filename: "rpmlint.log",
                  size: 8205,
                  modifiedTime: new Date("Fri, 03 Jul 2020 16:09:04 +0200")
                }
              ]
            ]
          ])
        },
        {
          repository: "SLE_12_SP5",
          arch: Arch.X86_64,
          code: RepositoryCode.Published,
          dirty: true,
          binaries: new Map([
            [
              "jq",
              [
                {
                  filename: "_buildenv",
                  size: 17598,
                  modifiedTime: new Date("Wed, 11 Nov 2020 04:52:08 +0100")
                },
                {
                  filename: "_statistics",
                  size: 955,
                  modifiedTime: new Date("Wed, 11 Nov 2020 04:52:08 +0100")
                },
                {
                  filename: "jq-1.6-29.19.src.rpm",
                  size: 1199808,
                  modifiedTime: new Date("Wed, 11 Nov 2020 04:52:16 +0100")
                },
                {
                  filename: "jq-1.6-29.19.x86_64.rpm",
                  size: 61134,
                  modifiedTime: new Date("Wed, 11 Nov 2020 04:52:16 +0100")
                },
                {
                  filename: "jq-debuginfo-1.6-29.19.x86_64.rpm",
                  size: 18487,
                  modifiedTime: new Date("Wed, 11 Nov 2020 04:52:16 +0100")
                },
                {
                  filename: "jq-debugsource-1.6-29.19.x86_64.rpm",
                  size: 135828,
                  modifiedTime: new Date("Wed, 11 Nov 2020 04:52:16 +0100")
                },
                {
                  filename: "libjq-devel-1.6-29.19.x86_64.rpm",
                  size: 8512,
                  modifiedTime: new Date("Wed, 11 Nov 2020 04:52:16 +0100")
                },
                {
                  filename: "libjq1-1.6-29.19.x86_64.rpm",
                  size: 114852,
                  modifiedTime: new Date("Wed, 11 Nov 2020 04:52:16 +0100")
                },
                {
                  filename: "libjq1-debuginfo-1.6-29.19.x86_64.rpm",
                  size: 195189,
                  modifiedTime: new Date("Wed, 11 Nov 2020 04:52:16 +0100")
                },
                {
                  filename: "rpmlint.log",
                  size: 1355,
                  modifiedTime: new Date("Wed, 11 Nov 2020 04:52:08 +0100")
                }
              ]
            ],
            ["jtc", []]
          ])
        }
      ].map((args) => ({ project, ...args }));

      await fetchBuildResults(con, "utilities", {
        packages: ["jtc", "jq"],
        views: [BuildStatusView.BinaryList],
        repositories: ["SLE_12_SP5", "openSUSE_Leap_15.2"]
      }).should.eventually.deep.equal(expected);
    });

    it("includes results from multibuilds when requested", async () => {
      const project = "Virtualization:Appliances:Images:openSUSE-Tumbleweed";
      const code = PackageStatusCode.Excluded;
      const expectedWithMultibuild: BuildResult[] = [
        {
          repository: "rpm",
          arch: Arch.X86_64,
          code: RepositoryCode.Published,
          packageStatus: new Map([
            ["kiwi-images-vagrant", { code }],
            ["kiwi-images-vagrant:libvirt", { code }],
            ["kiwi-images-vagrant:libvirt_aarch64", { code }],
            ["kiwi-images-vagrant:virtualbox", { code }]
          ])
        },
        {
          repository: "openSUSE_Tumbleweed",
          arch: Arch.X86_64,
          code: RepositoryCode.Published,
          packageStatus: new Map([
            ["kiwi-images-vagrant", { code }],
            [
              "kiwi-images-vagrant:libvirt",
              { code: PackageStatusCode.Succeeded }
            ],
            ["kiwi-images-vagrant:libvirt_aarch64", { code }],
            [
              "kiwi-images-vagrant:virtualbox",
              { code: PackageStatusCode.Succeeded }
            ]
          ])
        }
      ].map((res) => ({ project, dirty: false, ...res }));
      const expectedWithoutMultibuild: BuildResult[] = [
        "rpm",
        "openSUSE_Tumbleweed"
      ].map((repository) => ({
        project,
        repository,
        arch: Arch.X86_64,
        code: RepositoryCode.Published,
        packageStatus: new Map([["kiwi-images-vagrant", { code }]]),
        dirty: false
      }));

      const packages = [{ name: "kiwi-images-vagrant", projectName: project }];
      const proj = { name: project, apiUrl: con.url.href };
      const architectures = [Arch.X86_64];
      await fetchBuildResults(con, proj, {
        architectures,
        packages,
        multiBuild: true
      }).should.eventually.deep.equal(expectedWithMultibuild);
      await fetchBuildResults(con, proj, {
        architectures,
        packages,
        multiBuild: false
      }).should.eventually.deep.equal(expectedWithoutMultibuild);
    });
  });
});
