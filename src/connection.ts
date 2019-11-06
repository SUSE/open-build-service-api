"use strict";

import xml2js = require("xml2js");

const xmlParser = new xml2js.Parser({ explicitArray: false, async: true });
const xmlBuilder = new xml2js.Builder();

import { assert } from "console";
import { request } from "https";
import { URL } from "url";
import { ApiError } from "./error";

/**
 * Converts a url into a well defined format (e.g. whether `/` should be
 * appended).
 *
 * @param url  The url to be normalized. An exception is thrown if this is not a
 *     valid url.
 */
export function normalizeUrl(url: string): string {
  return new URL(url).toString();
}

/**
 * The supported request methods by [[Connection.makeApiCall]].
 */
export const enum RequestMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE"
}

/**
 * Class for storing the credentials to connect to a Open Build Service instance.
 */
export class Connection {
  /** the username which will be used to connect to the API */
  public readonly username: string;

  /** URL to the API of this buildservice instance */
  public readonly url: string;

  /** the user's password */
  private readonly password: string;

  /** HTTP simple auth header containing the necessary credentials */
  private readonly headers: string;

  /**
   * Construct a connection using the provided username and password
   * @param username  username used for authentication
   * @param password  password of the user
   * @param url URL to the API, **must** use `https`.
   *     CAUTION: this is **not** the URL to the webpage of the buildservice
   *     instance (usually you have to swap the initial `build.` to `api.`).
   *
   * @throw Error when the url is invalid or when it does not use https.
   */
  constructor(
    username: string,
    password: string,
    url: string = "https://api.opensuse.org"
  ) {
    this.password = password!;
    this.username = username!;

    this.headers = `${this.username}:${this.password}`;
    this.url = normalizeUrl(url);

    const protocol = new URL(this.url).protocol;
    if (protocol !== "https:") {
      throw new Error(
        `${this.url} does not use https, got ${protocol} instead`
      );
    }
  }

  /**
   * Perform a request to the API and return the reply's body decoded from XML.
   *
   * @param route  route which to which the request will be sent
   * @param method  The method used to perform the request. Defaults to
   *     [[GET|RequestMethod.GET]]
   * @param payload  An arbitrary object to be sent along with the request. This
   *     object is encoded to XML via xml2js'
   *     [Builder](https://github.com/Leonidas-from-XIV/node-xml2js#xml-builder-usage).
   *
   * @return The body of the reply decoded from XML via xml2js'
   *     [parseString](https://github.com/Leonidas-from-XIV/node-xml2js#usage). The
   *     reply is only decoded when the request succeeds (`200 <= statusCode <=
   *     299`)
   *
   * @throw An [[ApiError]] if the API replied with a status code less than
   *     `200` or more than `299`.
   */
  public async makeApiCall(
    route: string,
    { method, payload }: { method?: RequestMethod; payload?: any } = {}
  ): Promise<any> {
    const url = new URL(route, this.url);
    const reqMethod = method === undefined ? RequestMethod.GET : method;
    assert(
      reqMethod !== undefined,
      "request method in reqMethod must not be undefined"
    );

    return new Promise((resolve, reject) => {
      const req = request(
        url,
        {
          auth: this.headers,
          method: reqMethod
        },
        response => {
          const body: any[] = [];

          response.on("data", chunk => {
            body.push(chunk);
          });

          // handle errors in the request here, because the API returns more
          // detailed error messages in the body, but the body is not available
          // until the "end" event occurs
          response.on("end", async () => {
            try {
              const data = await xmlParser.parseStringPromise(body.join(""));

              if (response.statusCode! < 200 || response.statusCode! > 299) {
                reject(
                  new ApiError(response.statusCode!, url, reqMethod, data)
                );
              }

              resolve(data);
            } catch (err) {
              reject(err);
            }
          });
        }
      );
      req.on("error", err => reject(err));

      if (payload !== undefined) {
        req.write(xmlBuilder.buildObject(payload));
      }
      req.end();
    });
  }
}
