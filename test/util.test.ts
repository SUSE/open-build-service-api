/**
 * Copyright (c) 2019 SUSE LLC
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
import { describe, it } from "mocha";
import * as util from "../src/util";

class TestClass {
  constructor(readonly value: string) {}
}

const obj = { foo: "Foo" };

describe("#zip", () => {
  it("zips two equally long arrays", () => {
    expect(util.zip([1, 2, 3], ["a", "b", "c"])).to.deep.equal([
      [1, "a"],
      [2, "b"],
      [3, "c"]
    ]);
  });

  it("zips two arrays with different lengths", () => {
    expect(util.zip(["asdf", "bsdf", "caui"], [1, 2, 3, 4, 5])).to.deep.equal([
      ["asdf", 1],
      ["bsdf", 2],
      ["caui", 3]
    ]);
  });
});

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
