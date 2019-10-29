import { Context } from "mocha";
import * as nock from "nock";
import { join } from "path";

nock.back.fixtures = join(__dirname, "..", "fixtures");

export async function beforeEachRecorded(this: Context) {
  const jsonPath =
    this.currentTest!.titlePath()
      .map(elem => elem.replace(/\s+/g, "_"))
      .join("_") + ".json";

  nock.back.setMode("record");
  const { nockDone } = await nock.back(jsonPath);
  this.nockDone = nockDone;
}

export function afterEachRecorded(this: Context) {
  this.nockDone();
  nock.back.setMode("wild");
}
