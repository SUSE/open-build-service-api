import { expect } from "chai";
import { describe, it } from "mocha";

import { projectSettingFromFlag } from "../../src/api/flag";
import { Arch } from "../../src/project";

const arches = [Arch.Aarch64, Arch.X86_64];

describe("#projectSettingFromFlag", () => {
  it("should return undefined when the flag is undefined", () => {
    expect(projectSettingFromFlag("foo", [])).to.equal(undefined);
  });

  it("should return true when the repository is enabled", () => {
    expect(
      projectSettingFromFlag("foo", arches, {
        defaultValue: 2,
        disable: [],
        enable: [{ repository: "foo" }, { repository: "bar" }]
      })
    ).to.equal(true);
  });

  it("should return false when the repository is disabled", () => {
    expect(
      projectSettingFromFlag("foo", arches, {
        defaultValue: 2,
        disable: [{ repository: "foo" }, { repository: "baz" }],
        enable: [{ repository: "bar" }]
      })
    ).to.equal(false);
  });

  it("should return a Map when certain arches are enabled", () => {
    const res = projectSettingFromFlag("foo", [...arches, ...[Arch.I686]], {
      defaultValue: 2,
      disable: [{ repository: "bar" }, { repository: "foo", arch: Arch.I686 }],
      enable: [
        { repository: "foo", arch: Arch.X86_64 },
        { repository: "foo", arch: Arch.Aarch64 }
      ]
    });
    expect(res).to.be.a("Map");

    expect((res as Map<Arch, boolean>).get(Arch.X86_64)).to.equal(true);
    expect((res as Map<Arch, boolean>).get(Arch.Aarch64)).to.equal(true);
    expect((res as Map<Arch, boolean>).get(Arch.I686)).to.equal(false);
  });

  it("should correctly set the default", () => {
    const res = projectSettingFromFlag(
      "foo",
      [...arches, ...[Arch.I686, Arch.Ppc64]],
      {
        defaultValue: 0,
        disable: [
          { repository: "bar" },
          { repository: "foo", arch: Arch.I686 },
          { repository: "foo", arch: Arch.Aarch64 }
        ],
        enable: [{ repository: "foo", arch: Arch.X86_64 }]
      }
    );
    expect(res).to.be.a("Map");

    expect((res as Map<Arch, boolean>).get(Arch.X86_64)).to.equal(true);
    expect((res as Map<Arch, boolean>).get(Arch.Aarch64)).to.equal(false);
    expect((res as Map<Arch, boolean>).get(Arch.I686)).to.equal(false);
    expect((res as Map<Arch, boolean>).get(Arch.Ppc64)).to.equal(true);
  });

  it("should correctly set the default for simple cases", () => {
    const res = projectSettingFromFlag("foo", [Arch.X86_64, Arch.Aarch64], {
      defaultValue: 0,
      disable: [],
      enable: []
    });
    expect(res)
      .to.be.a("boolean")
      .and.to.equal(true);
  });
});
