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

import { createHash } from "crypto";
import { promises as fsPromises } from "fs";
import { pathExists, PathType } from "./util";

/** Hash functions supported by the functions from this module */
export type SupportedHashfunction = "md5" | "sha256";

/**
 * Return the hash digest of the Buffer `contents` with the given
 * `hashFunction` encoded as hex.
 */
export function calculateHash(
  contents: Buffer | string,
  hashFunction: SupportedHashfunction
): string {
  const hash = createHash(hashFunction);
  hash.update(contents);
  return hash.digest("hex");
}

const CHUNKSIZE = 4096;

/**
 * Return the hash of the file contents with the provided hash function.
 *
 * @return The hex digest of the hash of the raw file contents or undefined if
 *     the file does not exist.
 */
export async function calculateFileHash(
  path: string,
  hashFunction: SupportedHashfunction
): Promise<string | undefined> {
  if ((await pathExists(path, PathType.File)) === undefined) {
    return undefined;
  }
  const hash = createHash(hashFunction);
  const buff = new Uint8Array(CHUNKSIZE);
  const fd = await fsPromises.open(path, "r");

  try {
    let readRes: { bytesRead: number; buffer: Uint8Array };

    do {
      readRes = await fd.read(buff, 0, CHUNKSIZE);
      hash.update(new DataView(readRes.buffer.buffer, 0, readRes.bytesRead));
    } while (readRes.bytesRead > 0);

    return hash.digest("hex");
  } finally {
    await fd.close();
  }
}
