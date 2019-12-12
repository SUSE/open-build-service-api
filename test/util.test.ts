import { expect } from "chai";
import { describe, it } from "mocha";
import * as util from "../src/util";

class TestClass {
  constructor(readonly value: string) {}
}

const obj = { foo: "Foo" };

describe("#dateFromUnixTimeStamp", () => {
  it("converts the time from a string", () => {
    expect(util.dateFromUnixTimeStamp("1573160909")).to.deep.equal(
      new Date("Thu, 07 Nov 2019 22:08:29 +0100")
    );
  });

  it("converts the time from a number", () => {
    expect(util.dateFromUnixTimeStamp(1552575139)).to.deep.equal(
      new Date("Thu, 14 Mar 2019 15:52:19 +0100")
    );
  });
});

describe("#extractElementIfPresent", () => {
  it("should return undefined if the property is not present", () => {
    expect(util.extractElementIfPresent<string>(obj, "bar")).to.be.undefined;
  });

  it("should return the element if the property is present", () => {
    expect(util.extractElementIfPresent<string>(obj, "foo")).to.equal("Foo");
  });

  it("should create a new TestClass when passed the construct option", () => {
    const res = util.extractElementIfPresent<TestClass>(obj, "foo", {
      construct: data => new TestClass(data)
    });
    expect(res).to.not.be.undefined;
    expect(res)
      .to.haveOwnProperty("value")
      .and.to.equal("Foo");
  });

  it("should create a new TestClass when passed TestClass as the type option", () => {
    const res = util.extractElementIfPresent<TestClass>(obj, "foo", {
      type: TestClass
    });
    expect(res).to.not.be.undefined;
    expect(res)
      .to.haveOwnProperty("value")
      .and.to.equal("Foo");
  });
});

describe("#extractElementOrDefault", () => {
  it("should return the default if the property is not present", () => {
    expect(util.extractElementOrDefault<string>(obj, "bar", "baz")).to.equal(
      "baz"
    );
  });
});

describe("#deleteUndefinedMembers", () => {
  it("should drop undefined members", () => {
    const someObj = { foo: 1, bar: 2, baz: undefined };
    util.deleteUndefinedMembers(someObj);

    expect(someObj).to.deep.equal({ foo: 1, bar: 2 });
  });

  it("should return the modified object", () => {
    expect(
      util.deleteUndefinedMembers({ Foo: "a", bar: ["foo"], Baz: undefined })
    ).to.deep.equal({ Foo: "a", bar: ["foo"] });
  });
});

describe("#deleteUndefinedAndEmptyMembers", () => {
  it("should remove undefined members", () => {
    expect(
      util.deleteUndefinedAndEmptyMembers({
        Foo: "a",
        bar: ["foo"],
        Baz: undefined
      })
    ).to.deep.equal({ Foo: "a", bar: ["foo"] });
  });

  it("should remove zero length arrays", () => {
    expect(
      util.deleteUndefinedAndEmptyMembers({
        Foo: [],
        bar: ["foo"],
        Baz: "baz"
      })
    ).to.deep.equal({ bar: ["foo"], Baz: "baz" });
  });
});
