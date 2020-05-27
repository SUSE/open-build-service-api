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

import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import {
  createProject,
  deleteProject,
  fetchProject,
  fetchProjectList
} from "../../src/project";
import { LocalRole } from "../../src/user";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection,
  miniObsUsername,
  skipIfNoMiniObsHook,
  skipIfNoMiniObs
} from "./../test-setup";

describe("#fetchProject", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  it("fetches the Project of Virtualization:vagrant", async () => {
    const projectName = "Virtualization:vagrant";
    const virtualizationVagrant = await fetchProject(con, projectName, false);

    expect(virtualizationVagrant).to.have.property("apiUrl", con.url);
    expect(virtualizationVagrant).to.have.property("name", projectName);
    expect(virtualizationVagrant).to.have.property("meta");
    expect(virtualizationVagrant).to.not.have.property("packages");

    expect(virtualizationVagrant.meta).to.deep.include({
      name: projectName,
      title: "Devel project for Vagrant"
    });
  });

  it("fetches the package list of Virtualization:Appliances:Images:openSUSE-Tumbleweed", async () => {
    const projectName = "Virtualization:Appliances:Images:openSUSE-Tumbleweed";
    const TW = await fetchProject(con, projectName);

    expect(TW).to.have.property("apiUrl", con.url);
    expect(TW).to.have.property("name", projectName);
    expect(TW).to.have.property("meta");
    expect(TW)
      .to.have.property("packages")
      .that.deep.equals(
        [
          "kiwi-images-vagrant",
          "kiwi-templates-JeOS",
          "live-kiwi-hook",
          "livecd-openSUSE",
          "livecd-tumbleweed-gnome",
          "livecd-tumbleweed-kde",
          "livecd-tumbleweed-x11",
          "livecd-tumbleweed-xfce"
        ].map((name) => ({ name, apiUrl: con.url, projectName }))
      );

    expect(TW.meta).to.deep.include({
      name: projectName,
      title: "openSUSE Tumbleweed Images",
      description:
        "Contains the Live CD, JeOS, Vagrant boxes and possibly more.",
      person: ["dancermak", "dcassany", "favogt", "gmoro"].map((userId) => ({
        userId,
        role: LocalRole.Maintainer
      }))
    });
  });
});

describe("#fetchProjectList", function () {
  this.timeout(15000);
  before(skipIfNoMiniObsHook);

  const con = getTestConnection(ApiType.MiniObs);

  it("fetches the list of all projects", async () => {
    const projectsBefore = await fetchProjectList(con);
    const name = `home:${miniObsUsername}:for_the_search`;
    expect(projectsBefore.find((proj) => proj.name === name)).to.equal(
      undefined
    );

    await createProject(con, {
      name,
      description: "to show up in the search",
      title: "For the search"
    });

    const projectsAfter = await fetchProjectList(con);
    expect(projectsAfter).to.include.a.thing.that.deep.equals({
      name,
      apiUrl: con.url
    });

    await deleteProject(con, name);
  });
});
