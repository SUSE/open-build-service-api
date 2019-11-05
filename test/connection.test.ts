import { expect, should, use } from "chai";
import * as chaiAsPromised from "chai-as-promised";
import { describe, it } from "mocha";

import { Connection, normalizeUrl } from "../src/connection";
import { afterEachRecorded, beforeEachRecorded } from "./nock-record";

use(chaiAsPromised);
should();

describe("normalizeUrl", () => {
  it("throws an exception when the url is invalid", () => {
    expect(() => {
      normalizeUrl("__asdf");
    }).to.throw(TypeError, /invalid url/i);
  });
});

describe("Connection", () => {
  describe("#makeApiCall", () => {
    beforeEach(beforeEachRecorded);

    afterEach(afterEachRecorded);

    it("throws an exception when the HTTP request fails", async () => {
      const conn = new Connection("suspicouslyFake", "evenFaker");
      await conn
        .makeApiCall("superInvalidRouteFromOuterSpace")
        .should.be.rejectedWith(/failed to load url/i);
    });
  });
});
