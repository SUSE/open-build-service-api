"use strict";

import { assert } from "console";
import { URL } from "url";
import { RequestMethod } from "./connection";
import { extractElementAsArray, extractElementIfPresent } from "./util";

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
   * Additional data tag that can be processed by the client.
   * Contains a list of target projects.
   */
  data: string[];
}

/** [[StatusReply]] as decoded via xml2js when received from the API */
export interface StatusReplyApiReply {
  status: {
    $: { code: string };
    data?: string[];
    details?: string;
    summary?: string;
  };
}

/** Converts the status reply from the API into a [[StatusReply]] */
export function statusReplyFromApi(data: StatusReplyApiReply): StatusReply {
  return {
    code: data.status.$.code,
    data: extractElementAsArray<string>(data.status, "data"),
    details: extractElementIfPresent<string>(data.status, "details"),
    summary: extractElementIfPresent<string>(data.status, "summary")
  };
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
    super(`Failed to load URL ${url}, status code: ${statusCode}`);

    assert(
      statusCode > 299 || statusCode < 200,
      `statusCode indicates success (${statusCode}), while the request should have failed`
    );

    this.statusCode = statusCode;
    this.url = url;
    this.method = method;

    // status can actually be anything, it needn't be a status-reply element.
    // E.g. when authorization fails, then we get a HTML file instead, which
    // xml2js decodes, but the following would throw and so we need to guard
    // against that.
    try {
      this.status = statusReplyFromApi(status);
    } catch {
      // something went wrong while decoding the status, it is probably not a
      // status-reply then
    }

    Object.setPrototypeOf(this, ApiError.prototype);
  }
}
