"use strict";

import xml2js = require("xml2js");

const xmlParser = new xml2js.Parser({ explicitArray: false, async: true });

import { request } from "https";
import { URL } from "url";

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
 * Class for storing the credentials to connect to a Open Build Service instance.
 */
export class Connection {
  // the username which will be used to connect to the API
  public readonly username: string;

  // the user's password
  private readonly password: string;

  // HTTP simple auth header containing the necessary credentials
  private readonly headers: string;

  // Construct a connection using the provided username and password
  constructor(
    username: string,
    password: string,
    readonly url: string = "https://api.opensuse.org"
  ) {
    this.password = password!;
    this.username = username!;

    this.headers = `${this.username}:${this.password}`;
  }

  public async makeApiCall(
    route: string,
    method: string = "GET"
  ): Promise<any> {
    const url = this.url.concat(route);

    return new Promise((resolve, reject) => {
      const req = request(url, { method, auth: this.headers }, response => {
        if (response.statusCode! < 200 || response.statusCode! > 299) {
          reject(
            new Error(
              `Failed to load URL ${url}, status code: ${response.statusCode}`
            )
          );
        }

        const body: any[] = [];
        response.on("data", chunk => {
          body.push(chunk);
        });
        response.on("end", async () =>
          resolve(await xmlParser.parseStringPromise(body.join("")))
        );
      });
      req.on("error", err => reject(err));
      req.end();
    });
  }
}
