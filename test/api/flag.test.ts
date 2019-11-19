import { expect } from "chai";
import { describe, it } from "mocha";
import {
  booleanToSimpleFlag,
  DefaultValue,
  Flag,
  FlagApiReply,
  flagFromApi,
  flagToApi,
  repositorySettingFromFlag,
  repositorySettingToFlag,
  simpleFlagToBoolean
} from "../../src/api/flag";
import { Arch } from "../../src/project-meta";

describe("SimpleFlag", () => {
  describe("#simpleFlagToBoolean", () => {
    it("gets converted to a boolean", () => {
      expect(simpleFlagToBoolean({ enable: {} })).to.eql(true);
      expect(simpleFlagToBoolean({ disable: {} })).to.eql(false);
    });

    it("throws an exception when enable and disable are both set", () => {
      expect(() => simpleFlagToBoolean({ enable: {}, disable: {} })).to.throw(
        Error,
        /invalid simple-flag-element/i
      );
    });

    it("throws an exception when enable and disable are both unset", () => {
      expect(() => simpleFlagToBoolean({})).to.throw(
        Error,
        /invalid simple-flag-element/i
      );
    });
  });

  describe("#booleanToSimpleFlag", () => {
    it("returns undefined when val is undefined", () => {
      // tslint:disable-next-line:no-unused-expression
      expect(booleanToSimpleFlag(undefined)).to.be.undefined;
    });

    it("returns an object with enable set when passed true", () => {
      expect(booleanToSimpleFlag(true)).to.eql({ enable: {} });
    });

    it("returns an object with disable set when passed false", () => {
      expect(booleanToSimpleFlag(false)).to.eql({ disable: {} });
    });
  });
});

describe("Flag", () => {
  const flagPairs: Array<[Flag, FlagApiReply]> = [
    // a single enable
    [
      {
        defaultValue: DefaultValue.Unspecified,
        disable: [],
        enable: [{ repository: "foo", arch: undefined }]
      },
      { enable: { $: { repository: "foo" } } }
    ],
    // default values
    [
      {
        defaultValue: DefaultValue.Enable,
        disable: [],
        enable: []
      },
      { enable: "" }
    ],
    [
      {
        defaultValue: DefaultValue.Disable,
        disable: [],
        enable: []
      },
      { disable: "" }
    ],
    // a complex example
    [
      {
        defaultValue: DefaultValue.Enable,
        disable: [
          { repository: undefined, arch: Arch.Ppc64 },
          { repository: "bar", arch: undefined },
          { repository: "baz", arch: Arch.Aarch64 }
        ],
        enable: [{ repository: "foo", arch: Arch.X86_64 }]
      },
      {
        disable: [
          { $: { arch: Arch.Ppc64 } },
          { $: { repository: "bar" } },
          { $: { repository: "baz", arch: Arch.Aarch64 } }
        ],
        enable: ["", { $: { repository: "foo", arch: Arch.X86_64 } }]
      }
    ]
  ];

  describe("#flagFromApi", () => {
    it("correctly parses a single enable", () => {
      expect(flagFromApi(flagPairs[0][1])).to.deep.equal(flagPairs[0][0]);
    });

    it("correctly parses a default enable", () => {
      expect(flagFromApi(flagPairs[1][1])).to.deep.equal(flagPairs[1][0]);
    });

    it("correctly parses a default disable", () => {
      expect(flagFromApi(flagPairs[2][1])).to.deep.equal(flagPairs[2][0]);
    });

    it("retrieves a default alongside additional settings", () => {
      expect(flagFromApi(flagPairs[3][1])).to.deep.equal(flagPairs[3][0]);
    });

    it("throws an exception when the API reply contains two default values", () => {
      expect(() => flagFromApi({ enable: "", disable: "" })).to.throw(
        Error,
        /invalid flag/i
      );
    });
  });

  describe("#flagToApi", () => {
    it("correctly converts a single enable", () => {
      expect(flagToApi(flagPairs[0][0])).to.deep.equal(flagPairs[0][1]);
    });

    it("correctly converts a default enable", () => {
      expect(flagToApi(flagPairs[1][0])).to.deep.equal(flagPairs[1][1]);
    });

    it("correctly converts a default disable", () => {
      expect(flagToApi(flagPairs[2][0])).to.deep.equal(flagPairs[2][1]);
    });

    it("converts a default alongside additional settings", () => {
      expect(flagToApi(flagPairs[3][0])).to.deep.equal(flagPairs[3][1]);
    });
  });
});

describe("#repositorySettingFromFlag", () => {
  const arches = [Arch.Aarch64, Arch.X86_64];

  it("should return undefined when the flag is undefined", () => {
    expect(repositorySettingFromFlag("foo", [])).to.equal(undefined);
  });

  it("should return true when the repository is enabled", () => {
    expect(
      repositorySettingFromFlag("foo", arches, {
        defaultValue: DefaultValue.Unspecified,
        disable: [],
        enable: [{ repository: "foo" }, { repository: "bar" }]
      })
    ).to.equal(true);
  });

  it("should return false when the repository is disabled", () => {
    expect(
      repositorySettingFromFlag("foo", arches, {
        defaultValue: DefaultValue.Unspecified,
        disable: [{ repository: "foo" }, { repository: "baz" }],
        enable: [{ repository: "bar" }]
      })
    ).to.equal(false);
  });

  it("should return a Map when certain arches are enabled", () => {
    let res = repositorySettingFromFlag("foo", [...arches, ...[Arch.I686]], {
      defaultValue: DefaultValue.Unspecified,
      disable: [{ repository: "bar" }, { repository: "foo", arch: Arch.I686 }],
      enable: [
        { repository: "foo", arch: Arch.X86_64 },
        { repository: "foo", arch: Arch.Aarch64 }
      ]
    });
    expect(res)
      .to.be.a("Map")
      .and.to.have.property("size", 3);

    res = res as Map<Arch, boolean | undefined>;

    expect(res.get(Arch.X86_64)).to.be.true;
    expect(res.get(Arch.Aarch64)).to.be.true;
    expect(res.get(Arch.I686)).to.be.false;
  });

  it("should correctly set the default", () => {
    let res = repositorySettingFromFlag(
      "foo",
      [...arches, ...[Arch.I686, Arch.Ppc64]],
      {
        defaultValue: DefaultValue.Enable,
        disable: [
          { repository: "bar" },
          { repository: "foo", arch: Arch.I686 },
          { repository: "foo", arch: Arch.Aarch64 }
        ],
        enable: [{ repository: "foo", arch: Arch.X86_64 }]
      }
    );
    expect(res)
      .to.be.a("Map")
      .and.to.have.property("size", 4);

    res = res as Map<Arch, boolean | undefined>;

    expect(res.get(Arch.X86_64)).to.be.true;
    expect(res.get(Arch.Aarch64)).to.be.false;
    expect(res.get(Arch.I686)).to.be.false;
    expect(res.get(Arch.Ppc64)).to.be.true;
  });

  it("should correctly set the default for simple cases", () => {
    const res = repositorySettingFromFlag("foo", [Arch.X86_64, Arch.Aarch64], {
      defaultValue: DefaultValue.Enable,
      disable: [],
      enable: []
    });
    expect(res).to.be.a("boolean").and.to.be.true;
  });

  it("should respect globally disabled architectures", () => {
    let res = repositorySettingFromFlag("foo", arches, {
      defaultValue: DefaultValue.Unspecified,
      disable: [{ arch: Arch.X86_64 }],
      enable: []
    });

    expect(res).to.be.a("Map");

    res = res as Map<Arch, boolean | undefined>;
    expect(res.get(Arch.X86_64)).to.be.false;
    expect(res.get(Arch.Aarch64)).to.be.undefined;
  });

  it("should not include globally disabled architectures not in the arch list", () => {
    let res = repositorySettingFromFlag("foo", arches, {
      defaultValue: DefaultValue.Unspecified,
      disable: [{ arch: Arch.Riscv64 }],
      enable: []
    });

    expect(res)
      .to.be.a("Map")
      .and.to.not.have.any.keys(Arch.Riscv64);
  });
});

describe("#repositorySettingToFlag", () => {
  it("returns undefined when passed empty settings", () => {
    expect(repositorySettingToFlag([])).to.be.undefined;
  });

  it("doesn't include repositories with RepoSetting being undefined", () => {
    expect(
      repositorySettingToFlag([["foo", undefined], ["bar", true]])
    ).to.deep.equal({
      defaultValue: DefaultValue.Unspecified,
      disable: [],
      enable: [{ repository: "bar" }]
    });
  });

  it("creates a enable for a single repository", () => {
    expect(repositorySettingToFlag([["foo", true]])).to.deep.equal({
      defaultValue: DefaultValue.Unspecified,
      disable: [],
      enable: [{ repository: "foo" }]
    });
  });

  it("creates a disable for a single repository", () => {
    expect(repositorySettingToFlag([["foo", false]])).to.deep.equal({
      defaultValue: DefaultValue.Unspecified,
      disable: [{ repository: "foo" }],
      enable: []
    });
  });

  it("creates per arch enable/disable fields", () => {
    expect(
      repositorySettingToFlag([
        ["foo", new Map([[Arch.X86_64, true], [Arch.Aarch64, false]])],
        ["bar", new Map([[Arch.X86_64, false], [Arch.I686, false]])]
      ])
    ).to.deep.equal({
      defaultValue: DefaultValue.Unspecified,
      disable: [
        { repository: "foo", arch: Arch.Aarch64 },
        { repository: "bar", arch: Arch.X86_64 },
        { repository: "bar", arch: Arch.I686 }
      ],
      enable: [{ repository: "foo", arch: Arch.X86_64 }]
    });
  });

  it("omits enable/disable fields when they match the default", () => {
    // with a disable
    expect(
      repositorySettingToFlag(
        [
          ["foo", new Map([[Arch.X86_64, true], [Arch.Aarch64, false]])],
          ["bar", new Map([[Arch.X86_64, false], [Arch.I686, false]])]
        ],
        false
      )
    ).to.deep.equal({
      defaultValue: DefaultValue.Disable,
      disable: [],
      enable: [{ repository: "foo", arch: Arch.X86_64 }]
    });

    // and with an enable
    expect(
      repositorySettingToFlag(
        [
          ["foo", new Map([[Arch.X86_64, true], [Arch.Aarch64, false]])],
          ["bar", new Map([[Arch.X86_64, false], [Arch.Ppc64, true]])]
        ],
        true
      )
    ).to.deep.equal({
      defaultValue: DefaultValue.Enable,
      disable: [
        { repository: "foo", arch: Arch.Aarch64 },
        { repository: "bar", arch: Arch.X86_64 }
      ],
      enable: []
    });
  });
});
