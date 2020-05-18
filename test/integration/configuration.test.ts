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

import { afterEach, beforeEach, describe, it } from "mocha";
import { URL } from "url";
import { Arch } from "../../src/api/base-types";
import {
  Configuration,
  fetchConfiguration,
  UserRegistration
} from "./../../src/configuration";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection
} from "./../test-setup";

const obsDescription = `<p class="description">
      The openSUSE Build Service is the public instance of the
      <a href="http://openbuildservice.org">Open Build Service (OBS)</a>
      used for development of the openSUSE distribution and to offer packages from same source for Fedora, Debian, Ubuntu, SUSE Linux Enterprise and other distributions..
    </p>
    <p class="description">
      Please find further details of this service on our <a href="http://wiki.opensuse.org/openSUSE:Build_Service">wiki pages</a>
    </p>
    <p class="description">
      This instance offers a special <a href="http://software.opensuse.org/search">package search interface</a>. Users of any distribution can
      search there for built packages for their distribution.
      For developers it is an efficient place to build up groups and work together through its project model.
    </p>`
  .split("\n")
  .join("\r\n");

const ObsConfiguration: Configuration = {
  title: "openSUSE Build Service",
  description: obsDescription,
  name: "build.opensuse.org",
  downloadOnDemand: false,
  enforceProjectKeys: true,
  anonymous: true,
  registration: UserRegistration.Allow,
  defaultAccessDisabled: false,
  allowUsersCreateHomeProject: true,
  disallowGroupCreation: false,
  changePassword: false,
  hidePrivateOptions: true,
  gravatar: true,
  ympUrl: new URL("http://software.opensuse.org/ymp"),
  bugzillaUrl: new URL("https://bugzilla.opensuse.org"),
  noProxyFilter: "",
  autoCleanupAfterDays: 30,
  theme: "bento",
  cleanupEmptyProjects: true,
  disableBranchPublishing: true,
  adminEmail: "admin@opensuse.org",
  unlistedProjectsFilter: "^home:.+|^openSUSE:Maintenance:.+",
  unlistedProjectsFilterDescription: "home projects",
  repositoryUrl: new URL("https://download.opensuse.org/repositories"),
  webUiUrl: new URL("https://build.opensuse.org"),
  schedulers: [
    Arch.I586,
    Arch.X86_64,
    Arch.Ppc,
    Arch.Ppc64,
    Arch.S390x,
    Arch.Local,
    Arch.Armv6l,
    Arch.Armv7l,
    Arch.Aarch64,
    Arch.Ppc64le,
    Arch.Aarch64Ilp32,
    Arch.Riscv64
  ]
};

const ObsTestConfiguration: Configuration = {
  title: "TEST INSTANCE of openSUSE Build Service",
  description:
    "<p>This is our test instance. It uses standard openSUSE user credentials, but only approved users are activated. Ask your fellow admin in case you are an OBS developer or have another reason to test something.</p>",
  name: "openSUSE_TEST",
  downloadOnDemand: true,
  enforceProjectKeys: false,
  anonymous: true,
  registration: UserRegistration.Confirmation,
  defaultAccessDisabled: false,
  allowUsersCreateHomeProject: true,
  disallowGroupCreation: false,
  changePassword: true,
  hidePrivateOptions: false,
  gravatar: true,
  cleanupEmptyProjects: true,
  disableBranchPublishing: true,
  adminEmail: "unconfigured@openbuildservice.org",
  unlistedProjectsFilter: "^home:.+|^BLAH:.+",
  unlistedProjectsFilterDescription: "home projects",
  repositoryUrl: new URL("http://download-test.opensuse.org/repositories"),
  webUiUrl: new URL("https://build-test.opensuse.org"),
  schedulers: [
    Arch.Armv5l,
    Arch.Armv7l,
    Arch.I586,
    Arch.Local,
    Arch.Mips,
    Arch.Ppc,
    Arch.Ppc64,
    Arch.X86_64,
    Arch.Aarch64,
    Arch.M68k,
    Arch.Ppc64le
  ]
};

describe("Configuration", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  describe("#fetchConfiguration", () => {
    it("gets the server info from build.opensuse.org", async () => {
      await fetchConfiguration(
        getTestConnection(ApiType.Production)
      ).should.eventually.deep.equal(ObsConfiguration);
    });

    it("gets the server info from build-test.opensuse.org", async () => {
      await fetchConfiguration(
        getTestConnection(ApiType.Staging)
      ).should.eventually.deep.equal(ObsTestConfiguration);
    });
  });
});
