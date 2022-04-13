/**
 * Copyright (c) 2020-2022 SUSE LLC
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
import { URL } from "url";
import { RequestMethod } from "../src/connection";
import { ApiError, isTimeoutError, TimeoutError } from "../src/error";
import { ApiType } from "./test-setup";

describe("Errors", () => {
  const obsUrl = new URL(ApiType.Production);
  const testErr = new TimeoutError(RequestMethod.GET, obsUrl, 1, new Date());

  describe("#TimeoutError", () => {
    it("calculates the total time it took for the request", () => {
      const dayOne = new Date("March 1, 2020 00:00:00");

      const err = new TimeoutError(RequestMethod.GET, obsUrl, 1, dayOne);

      err.durationMs.should.be.most(new Date().getTime() - dayOne.getTime());
    });

    it("includes the request method, duration and maxRetries in the error message", () => {
      testErr.message.should.match(
        /could not make a GET request to https:\/\/api.opensuse.org\/, retried unsuccessfully 1 time and took \d+ms in total/i
      );
      testErr.message.should.include(testErr.durationMs.toString());
    });

    it("does not mention retries when none are allowed", () => {
      const err = new TimeoutError(RequestMethod.GET, obsUrl, 0, new Date());
      err.message.should.not.match(/retried unsuccessfully/);
    });

    it("uses the plural of retries in the error message", () => {
      const err = new TimeoutError(RequestMethod.GET, obsUrl, 5, new Date());
      err.message.should.match(/retried unsuccessfully 5 times and/);
    });

    it("is correctly identified as a TimeoutError", () => {
      const throws = () => {
        throw testErr;
      };
      expect(throws).to.throw(TimeoutError);
      expect(throws).to.throw(Error);
      expect(throws).to.not.throw(ApiError);
    });
  });

  describe("#isTimeoutError", () => {
    it("identifies the TimeoutError as one", () => {
      isTimeoutError(testErr).should.equal(true);
    });

    it("recognizes other Errors as not being TimeoutErrors", () => {
      isTimeoutError(
        new ApiError(400, obsUrl, RequestMethod.GET, undefined)
      ).should.equal(false);
      isTimeoutError(new Error("foo")).should.equal(false);
    });
  });
});
