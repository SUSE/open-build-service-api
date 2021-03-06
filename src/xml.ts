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

import * as xml2js from "xml2js";

/**
 * @return A new
 * [`xml2js.Parser`](https://github.com/Leonidas-from-XIV/node-xml2js#promise-usage)
 * with some custom settings applied.
 */
export const newXmlParser = (): xml2js.Parser =>
  new xml2js.Parser({ explicitArray: false, async: false });

/**
 * @return A new
 * [`xml2js.Builder`](https://github.com/Leonidas-from-XIV/node-xml2js#xml-builder-usage).
 */
export const newXmlBuilder = (): xml2js.Builder =>
  new xml2js.Builder({
    // this omits the
    // <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    // header which is not really required and could only cause issues
    headless: true
  });
