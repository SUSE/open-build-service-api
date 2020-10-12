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

import { promises as fsPromises } from "fs";
import { join } from "path";
import { checkOutProject, deleteProject } from "../../src/project";
import {
  addAndDeleteFilesFromPackage,
  commit,
  readInModifiedPackageFromDir
} from "../../src/vcs";
import { OscFixture } from "../osc-fixture";
import { ApiType, getTestConnection, miniObsUsername } from "../test-setup";

const utilProj = "openSUSE.org:utilities";

describe("osc up compatibility", function () {
  this.timeout(60000);

  const branchedProj = {
    name: `home:${miniObsUsername}:branches:${utilProj}`,
    apiUrl: ApiType.MiniObs
  };

  const con = getTestConnection(ApiType.MiniObs);

  before(function () {
    OscFixture.before(this);
  });

  beforeEach(async function () {
    await OscFixture.beforeEach(this);
    await this.fixture.runOsc(["branch", `${utilProj}/jtc`]);
    await checkOutProject(con, branchedProj, this.fixture.tmpPath);
  });

  afterEach(async function () {
    await OscFixture.afterEach(this);
    try {
      await deleteProject(con, branchedProj);
    } catch (err) {}
  });

  it("osc st works", async function () {
    await this.fixture
      .runOsc(["st", this.fixture.tmpPath])
      .should.eventually.deep.equal("");
  });

  it("osc up works", async function () {
    const contents = Buffer.from("dummy");
    const jtcDir = join(this.fixture.tmpPath, "jtc");
    await fsPromises.writeFile(join(jtcDir, "foo.txt"), contents);
    const pkg = await readInModifiedPackageFromDir(jtcDir);
    await commit(
      con,
      await addAndDeleteFilesFromPackage(pkg, [], ["foo.txt"]),
      "add foo.txt"
    );

    // await this.fixture.runOsc(["up", join(this.tmpPath, "jtc")]);
    await deleteProject(con, branchedProj);

    await this.fixture.runOsc(["branch", `${utilProj}/jtc`]);
    // await this.fixture
    //   .runOsc(["up", join(this.tmpPath, "jtc")])
    //   .should.eventually.deep.equal("");
  });
});
