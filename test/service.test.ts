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

import { describe, it } from "mocha";
import {
  GoModulesService,
  ServiceMode,
  serviceToXmlString
} from "../src/service";

describe("Service", () => {
  describe("GoModulesService", () => {
    it("creates a valid xml from its defaults", () => {
      const goMod = new GoModulesService();

      serviceToXmlString([goMod]).should.equal(`<services>
  <service name="go_modules"/>
</services>`);
    });

    it("creates valid xml with additional settings", () => {
      const archive = "foo.tar.xz";
      const compression = "lzma";
      const goMod = new GoModulesService(ServiceMode.Disabled, {
        archive,
        compression
      });

      serviceToXmlString([goMod]).should.equal(`<services>
  <service name="go_modules" mode="disabled">
    <param name="archive">${archive}</param>
    <param name="compression">${compression}</param>
  </service>
</services>`);
    });
  });
});
