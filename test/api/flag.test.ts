import { expect } from "chai";
import { describe, it } from "mocha";

import {
  booleanToSimpleFlag,
  projectSettingFromFlag,
  simpleFlagToBoolean,
  flagFromApi,
  DefaultValue,
  Flag,
  FlagApiReply,
  flagToApi
} from "../../src/api/flag";
import { Arch } from "../../src/project";

const arches = [Arch.Aarch64, Arch.X86_64];

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
