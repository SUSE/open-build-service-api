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

import * as assert from "assert";
import { Context } from "mocha";
import { rmRf, runProcess } from "../src/util";
import {
  createTemporaryDirectory,
  skipIfNoMiniObs,
  haveMiniObs
} from "./test-setup";

export type OscFixtureCtx = { fixture: OscFixture } & Context;

export class OscFixture {
  public static before(ctx: Context): void {
    skipIfNoMiniObs(ctx);
  }

  public static async beforeEach(ctx: Context): Promise<void> {
    if (!haveMiniObs()) {
      ctx.skip();
    } else {
      const fixture = new OscFixture();
      fixture.tmpPath = await createTemporaryDirectory();
      ctx.fixture = fixture;
    }
  }

  public static async afterEach(ctx: Context): Promise<void> {
    if (!haveMiniObs()) {
      return;
    }

    if (ctx.fixture === undefined) {
      return;
    }
    const fixture = (ctx as OscFixtureCtx).fixture;
    assert(
      fixture.tmpPath !== undefined,
      "ctx.fixture.tmpPath is undefined: beforeEach not called?"
    );
    await rmRf(fixture.tmpPath);
  }

  // private envClone: NodeJS.ProcessEnv = {};
  public tmpPath: string | undefined;

  public async runOsc(args: string[], cwd?: string): Promise<string> {
    return runProcess("pipenv", {
      args: ["run", "osc"].concat(args),
      cwd
    });
  }
}
