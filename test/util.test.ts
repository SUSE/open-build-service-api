import { describe, it } from "mocha";
import { expect } from "chai";

import * as util from "../src/util";

class TestClass {
  constructor(readonly value: string) {}
}

const obj = { foo: "Foo" };

describe("extractElementIfPresent", () => {
  it("should return undefined if the property is not present", () => {
    expect(util.extractElementIfPresent<string>(obj, "bar")).to.be.undefined;
  });

  it("should return the element if the property is present", () => {
    expect(util.extractElementIfPresent<string>(obj, "foo")).to.equal("Foo");
  });

  it("should create a new TestClass when passed the construct option", () => {
    let res = util.extractElementIfPresent<TestClass>(obj, "foo", {
      construct: data => new TestClass(data)
    });
    expect(res).to.not.be.undefined;
    expect(res)
      .to.haveOwnProperty("value")
      .and.to.equal("Foo");
  });

  it("should create a new TestClass when passed TestClass as the type option", () => {
    let res = util.extractElementIfPresent<TestClass>(obj, "foo", {
      type: TestClass
    });
    expect(res).to.not.be.undefined;
    expect(res)
      .to.haveOwnProperty("value")
      .and.to.equal("Foo");
  });
});

describe("extractElementOrDefault", () => {
  it("should return the default if the property is not present", () => {
    expect(util.extractElementOrDefault<string>(obj, "bar", "baz")).to.equal(
      "baz"
    );
  });
});
