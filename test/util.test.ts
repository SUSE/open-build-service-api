/**
 * Copyright (c) 2019-2022 SUSE LLC
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
import { existsSync } from "fs";
import { describe, it } from "mocha";
import { assertType, TypesEqual } from "../src/types";
import * as util from "../src/util";
import { RetT, strToInt } from "../src/util";

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
      construct: (data) => new TestClass(data)
    });
    expect(res).to.not.be.undefined;
    expect(res).to.haveOwnProperty("value").and.to.equal("Foo");
  });

  it("should create a new TestClass when passed TestClass as the type option", () => {
    const res = util.extractElementIfPresent<TestClass>(obj, "foo", {
      type: TestClass
    });
    expect(res).to.not.be.undefined;
    expect(res).to.haveOwnProperty("value").and.to.equal("Foo");
  });
});

describe("#extractElementOrDefault", () => {
  it("should return the default if the property is not present", () => {
    expect(util.extractElementOrDefault<string>(obj, "bar", "baz")).to.equal(
      "baz"
    );
  });
});

describe("#withoutUndefinedMembers", () => {
  type AllOptional = { a?: string; b?: number };
  type SomeOptional = { a?: number; b: boolean };

  assertType<TypesEqual<AllOptional, Partial<AllOptional>>>();

  assertType<TypesEqual<RetT<AllOptional>, AllOptional | undefined>>();
  assertType<TypesEqual<RetT<SomeOptional>, SomeOptional>>();

  it("returns undefined when all members of the object are undefined", () => {
    expect(
      util.withoutUndefinedMembers({ a: undefined, b: undefined })
    ).to.equal(undefined);
  });

  it("should drop undefined members", () => {
    const someObj = { foo: 1, bar: 2, baz: undefined };
    expect(util.withoutUndefinedMembers(someObj)).to.deep.equal({
      foo: 1,
      bar: 2
    });

    expect(someObj).to.deep.equal({ foo: 1, bar: 2, baz: undefined });
  });

  it("should not modify the actual object", () => {
    const someObj = { Foo: "a", bar: ["foo"], Baz: undefined };
    util.withoutUndefinedMembers(someObj);

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

  afterEach(() => mockFs.restore());

  it("removes the directory fooDir and all its contents", async () => {
    expect(existsSync("fooDir")).to.equal(true);

    await util.rmRf("fooDir");

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
        .should.be.rejectedWith(util.ProcessError, /false exited with 1/);
    }
  );

  myIt(
    "reads the stderr of the program and reports it in the thrown error",
    async () => {
      const nonExistantDir = "/foo/bar/baz/I/really/hope/this/does/not/exist";
      await util
        .runProcess("ls", { args: [nonExistantDir] })
        .should.be.rejectedWith(util.ProcessError, nonExistantDir);
    }
  );

  myIt("resolves with the stdout of the command", async () => {
    await util.runProcess("echo", { args: ["foo"] }).should.eventually.deep
      .equal(`foo
`);
  });

  myIt("passes stdin to the command", async () => {
    await util.runProcess("grep", {
      stdin: `fooo
bar
baz
`,
      args: ["foo"]
    }).should.eventually.deep.equal(`fooo
`);
  });

  myIt("passes the environment to the spawned process", async () => {
    const nearlyEmptyEnv = await util.runProcess("env", {
      env: { MY_VAR: "42" }
    });
    nearlyEmptyEnv
      .split("\n")
      .should.include.a.thing.that.deep.equals("MY_VAR=42");
  });

  myIt("passes process.env by default to the spawned process", async () => {
    const defaultEnv = await util.runProcess("env");
    defaultEnv.should.not.include("MY_SUPERSPECIAL_SNOWFLAKE_VAR=42");

    process.env.MY_SUPERSPECIAL_SNOWFLAKE_VAR = "42";
    const env = await util.runProcess("env");
    env.should.include("MY_SUPERSPECIAL_SNOWFLAKE_VAR=42");
  });

  myIt(
    "throws an exception when the called command does not exist",
    async () => {
      const nonExistentCmd = "this_command_does_hopefully_not_exist";
      await util
        .runProcess(nonExistentCmd)
        .should.be.rejectedWith(Error, new RegExp(`${nonExistentCmd}.*ENOENT`));
    }
  );

  describe("ProcessError", () => {
    myIt("contains the stderr of the failed process", async () => {
      let exceptionCaught = false;
      try {
        await util.runProcess("sh", { stdin: "echo 'bar' >&2 ; exit 1;" });
      } catch (err: any) {
        util.isProcessError(err).should.equal(true);
        (err as util.ProcessError).stderr.join("\n").should.match(/bar/);
        exceptionCaught = true;
      }
      exceptionCaught.should.equal(true);
    });

    myIt("contains the stdout of the failed process", async () => {
      let exceptionCaught = false;
      try {
        await util.runProcess("sh", { stdin: "echo 'foo'; exit 1;" });
      } catch (err: any) {
        util.isProcessError(err).should.equal(true);
        (err as util.ProcessError).stdout.join("\n").should.match(/foo/);
        exceptionCaught = true;
      }
      exceptionCaught.should.equal(true);
    });

    myIt("contains the stderr of a process killed by a signal", async () => {
      let exceptionCaught = false;
      try {
        await util.runProcess("sh", { stdin: "kill -9 $$" });
      } catch (err: any) {
        util.isProcessError(err).should.equal(true);
        err.toString().should.match(/killed by a signal/i);
        exceptionCaught = true;
      }
      exceptionCaught.should.equal(true);
    });
  });

  describe("#isProcessError", () => {
    it("does not recognize Errors as ProcessErrors", () => {
      util
        .isProcessError(new Error("foo exited with 1, got stderr: "))
        .should.equal(false);
    });

    it("recognizes ProcessErrors with no stdout or stderr", () => {
      util
        .isProcessError(new util.ProcessError("bar", 1, [], []))
        .should.equal(true);
    });
  });
});

describe("#pathExists", () => {
  beforeEach(() => {
    mockFs({
      fooDir: mockFs.directory(),
      fooFile: "content",
      linkToFile: mockFs.symlink({ path: "fooFile" }),
      linkToDir: mockFs.symlink({ path: "fooDir" })
    });
  });

  afterEach(() => mockFs.restore());

  it("returns true for files and directories if no type is requested", async () => {
    await util.pathExists("fooDir").should.eventually.not.equal(undefined);
    await util.pathExists("fooFile").should.eventually.not.equal(undefined);
  });

  it("returns true for files and false for directories if we are checking for files", async () => {
    await util
      .pathExists("fooDir", util.PathType.File)
      .should.eventually.equal(undefined);
    const fooStat = await util.pathExists("fooFile", util.PathType.File);
    expect(fooStat).to.have.property("isFile");
    expect(fooStat!.isFile()).to.equal(true);
  });

  it("returns false for files and true for directories if we are checking for directories", async () => {
    const fooDirStat = await util.pathExists("fooDir", util.PathType.Directory);
    expect(fooDirStat).to.not.equal(undefined);
    expect(fooDirStat!.isDirectory()).to.equal(true);

    await util
      .pathExists("fooFile", util.PathType.Directory)
      .should.eventually.equal(undefined);
  });

  it("recognizes links as existing", async () => {
    await util.pathExists("linkToDir").should.eventually.not.equal(undefined);
    await util.pathExists("linkToFile").should.eventually.not.equal(undefined);
  });

  it("works when converting to boolean", async () => {
    expect(!(await util.pathExists("fooDir"))).to.equal(false);
    expect(!(await util.pathExists("nonExistent"))).to.equal(true);
  });
});

describe("#range", () => {
  it("creates an array starting at zero when only the end is given", () => {
    expect(util.range(5)).to.deep.equal([0, 1, 2, 3, 4]);
  });

  it("creates an array starting at the given start when provided", () => {
    expect(util.range(1, 5)).to.deep.equal([1, 2, 3, 4]);
  });
});

describe("#strToInt", () => {
  it("parses a string", () => {
    strToInt("10").should.equal(10);
    strToInt("10", 16).should.equal(16);
  });

  it("throws an exception if the string cannot be parsed", () => {
    expect(() => strToInt("foo")).to.throw(Error, /could not parse foo/);
  });
});
