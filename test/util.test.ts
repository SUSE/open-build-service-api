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
import { describe, it } from "mocha";
import * as util from "../src/util";
import { existsSync } from "fs";
import { rmRf } from "../src/util";

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

describe("#unixTimeStampFromDate", () => {
  it("converts a date to a number", () => {
    expect(
      util.unixTimeStampFromDate(new Date("Thu, 07 Nov 2019 22:08:29 +0100"))
    ).to.equal(1573160909);
  });

  it("is the inverse of dateFromUnixTimeStamp", () => {
    const unixTime = 1552575139;
    expect(
      util.unixTimeStampFromDate(util.dateFromUnixTimeStamp(unixTime))
    ).to.equal(unixTime);
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
    expect(util.deleteUndefinedMembers(someObj)).to.deep.equal({
      foo: 1,
      bar: 2
    });

    expect(someObj).to.deep.equal({ foo: 1, bar: 2, baz: undefined });
  });

  it("should not modify the actual object", () => {
    const someObj = { Foo: "a", bar: ["foo"], Baz: undefined };
    util.deleteUndefinedMembers(someObj);

    expect(someObj).to.deep.equal({ Foo: "a", bar: ["foo"], Baz: undefined });
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

describe("#rmRf", () => {
  beforeEach(() => {
    mockFs({
      "fooDir/dturinae/asdf": "something",
      "fooDir/foo/bar/baz": "nested",
      "fooDir/testFile": "It's something",
      thisShouldStay: "I'm still there"
    });
  });

  afterEach(() => {
    mockFs.restore();
  });

  it("removes the directory fooDir and all its contents", async () => {
    expect(existsSync("fooDir")).to.equal(true);

    await rmRf("fooDir").should.be.fulfilled;

    expect(existsSync("fooDir/foo")).to.equal(false);
    expect(existsSync("fooDir")).to.equal(false);
    expect(existsSync("thisShouldStay")).to.equal(true);
  });
});

describe("#runProcess", () => {
  const myIt = process.platform === "win32" ? xit : it;

  myIt("runs a simple process", async () => {
    await util.runProcess("true").should.be.fulfilled;
  });

  myIt(
    "throws an error when the program exits with a non-zero status",
    async () => {
      await util
        .runProcess("false")
        .should.be.rejectedWith(Error, /false exited with 1/);
    }
  );

  myIt(
    "reads the stderr of the program and reports it in the thrown error",
    async () => {
      const nonExistantDir = "/foo/bar/baz/I/really/hope/this/does/not/exist";
      await util
        .runProcess("ls", { args: [nonExistantDir] })
        .should.be.rejectedWith(Error, nonExistantDir);
    }
  );

  myIt("resolves with the stdout of the command", async () => {
    await util.runProcess("echo", { args: ["foo"] }).should.be.fulfilled.and
      .eventually.deep.equal(`foo
`);
  });

  myIt("passes stdin to the command", async () => {
    await util.runProcess("grep", {
      stdin: `fooo
bar
baz
`,
      args: ["foo"]
    }).should.be.fulfilled.and.eventually.deep.equal(`fooo
`);
  });
});
