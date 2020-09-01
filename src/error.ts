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

import * as assert from "assert";
import { URL } from "url";
import { RequestMethod } from "./connection";
import { isEmptyObj, mapOrApply, withoutUndefinedMembers } from "./util";

/**
 * Status reply that is received in response to PUT requests or on failed GET
 * requests.
 *
 * Source: https://build.opensuse.org/apidocs/status.xsd
 */
export interface StatusReply {
  /** short code describing the status */
  code: string;

  /** Summary of the status */
  summary?: string;

  /** Detailed, human readable information about the status. */
  details?: string;

  /**
   * Additional data tag(s) converted to a dictionary.
   *
   * This entry is populated from the <data> array received from OBS as follows:
   * ```xml
   * <data name="targetproject">home:foo</data>
   * <data name="targetpackage">bar</data>
   * ```
   * becomes:
   * ```typescript
   * {
   *   targetproject: "home:foo",
   *   targetpackage: "bar"
   * }
   * ```
   */
  data?: Record<string, string>;
}

/** [[StatusReply]] as decoded via xml2js when received from the API */
export interface StatusReplyApiReply {
  status: {
    $: { code: string };
    data?:
      | { $: { name: string }; _: string }[]
      | { $: { name: string }; _: string };
    details?: string;
    summary?: string;
  };
}

/** Converts the status reply from the API into a [[StatusReply]] */
export function statusReplyFromApi(status: StatusReplyApiReply): StatusReply {
  const data: Record<string, string> = {};
  if (status.status.data !== undefined) {
    mapOrApply(status.status.data, (entry) => {
      data[entry.$.name] = entry._;
    });
  }
  const reply: StatusReply = {
    code: status.status.$.code,
    data: isEmptyObj(data) ? undefined : data,
    summary: status.status.summary,
    details: status.status.details
  };
  return withoutUndefinedMembers(reply);
}

/** Typeguard for the custom [[ApiError]] type */
export function isApiError(err: Error): err is ApiError {
  return (
    (err as ApiError).statusCode !== undefined &&
    (err as ApiError).url !== undefined &&
    (err as ApiError).method !== undefined
  );
}

/** Error that is thrown when a request to the API fails. */
export class ApiError extends Error {
  /** The HTTP status code of the call to the API */
  public readonly statusCode: number;

  /** URL to which the request was sent */
  public readonly url: URL;

  /** The HTTP method which was used to access [[url]] */
  public readonly method: RequestMethod;

  /**
   * A [[StatusReply]] instance when provided in the body of the reply from the
   * API.
   */
  public readonly status?: StatusReply;

  /**
   * @param statusCode  status code of the reply resulting in this error
   * @param url  full URL that was requested
   * @param method  request method that was used
   * @param status  The body of the request decoded via xml2js. This function
   *     will save it in the [[status]] field, if it is well formed. Otherwise
   *     that field is omitted.
   */
  constructor(
    statusCode: number,
    url: URL,
    method: RequestMethod,
    status: any
  ) {
    assert(
      statusCode > 299 || statusCode < 200,
      `statusCode indicates success (${statusCode}), while the request should have failed`
    );

    let decodedStatus: StatusReply | undefined;
    // status can actually be anything, it needn't be a status-reply element.
    // E.g. when authorization fails, then we get a HTML file instead, which
    // xml2js decodes, but the following would throw and so we need to guard
    // against that.
    try {
      decodedStatus = statusReplyFromApi(status);
    } catch {
      // something went wrong while decoding the status, it is probably not a
      // status-reply then
    }

    let errMsg = `Failed to make a ${method} request to ${url}, got a ${statusCode}`;
    if (decodedStatus !== undefined) {
      errMsg = errMsg.concat(`:
status: ${decodedStatus.code}
summary: ${decodedStatus.summary}
details: ${decodedStatus.details}
`);
    }

    super(errMsg);

    this.statusCode = statusCode;
    this.url = url;
    this.method = method;
    this.status = decodedStatus;

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
