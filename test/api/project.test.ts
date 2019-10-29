import { expect } from "chai";
import { describe, it } from "mocha";

import * as api from "../../src/api/project";
import { Project } from "../../src/obs";

const arches = [Project.Arch.Aarch64, Project.Arch.X86_64];

describe("ApiProject", () => {
  describe("#projectSettingFromFlag", () => {
    it("should return undefined when the flag is undefined", () => {
      expect(api.projectSettingFromFlag("foo", [])).to.equal(undefined);
    });

    it("should return true when the repository is enabled", () => {
      expect(
        api.projectSettingFromFlag("foo", arches, {
          defaultValue: 2,
          disable: [],
          enable: [{ repository: "foo" }, { repository: "bar" }]
        })
      ).to.equal(true);
    });

    it("should return false when the repository is disabled", () => {
      expect(
        api.projectSettingFromFlag("foo", arches, {
          defaultValue: 2,
          disable: [{ repository: "foo" }, { repository: "baz" }],
          enable: [{ repository: "bar" }]
        })
      ).to.equal(false);
    });

    it("should return a Map when certain arches are enabled", () => {
      const res = api.projectSettingFromFlag(
        "foo",
        [...arches, ...[Project.Arch.I686]],
        {
          defaultValue: 2,
          disable: [
            { repository: "bar" },
            { repository: "foo", arch: Project.Arch.I686 }
          ],
          enable: [
            { repository: "foo", arch: Project.Arch.X86_64 },
            { repository: "foo", arch: Project.Arch.Aarch64 }
          ]
        }
      );
      expect(res).to.be.a("Map");

      expect(
        (res as Map<Project.Arch, boolean>).get(Project.Arch.X86_64)
      ).to.equal(true);
      expect(
        (res as Map<Project.Arch, boolean>).get(Project.Arch.Aarch64)
      ).to.equal(true);
      expect(
        (res as Map<Project.Arch, boolean>).get(Project.Arch.I686)
      ).to.equal(false);
    });

    it("should correctly set the default", () => {
      const res = api.projectSettingFromFlag(
        "foo",
        [...arches, ...[Project.Arch.I686, Project.Arch.Ppc64]],
        {
          defaultValue: 0,
          disable: [
            { repository: "bar" },
            { repository: "foo", arch: Project.Arch.I686 },
            { repository: "foo", arch: Project.Arch.Aarch64 }
          ],
          enable: [{ repository: "foo", arch: Project.Arch.X86_64 }]
        }
      );
      expect(res).to.be.a("Map");

      expect(
        (res as Map<Project.Arch, boolean>).get(Project.Arch.X86_64)
      ).to.equal(true);
      expect(
        (res as Map<Project.Arch, boolean>).get(Project.Arch.Aarch64)
      ).to.equal(false);
      expect(
        (res as Map<Project.Arch, boolean>).get(Project.Arch.I686)
      ).to.equal(false);
      expect(
        (res as Map<Project.Arch, boolean>).get(Project.Arch.Ppc64)
      ).to.equal(true);
    });

    it("should correctly set the default for simple cases", () => {
      const res = api.projectSettingFromFlag(
        "foo",
        [Project.Arch.X86_64, Project.Arch.Aarch64],
        {
          defaultValue: 0,
          disable: [],
          enable: []
        }
      );
      expect(res)
        .to.be.a("boolean")
        .and.to.equal(true);
    });
  });
});
