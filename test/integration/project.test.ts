import { expect } from "chai";
import { afterEach, beforeEach, describe, it } from "mocha";
import { getProject } from "../../src/project";
import { LocalRole } from "../../src/user";
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection
} from "./../test-setup";

describe("#getProject", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  it("fetches the Project of Virtualization:vagrant", async () => {
    const projectName = "Virtualization:vagrant";
    const virtualizationVagrant = await getProject(con, projectName, false)
      .should.be.fulfilled;

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
    const project = "Virtualization:Appliances:Images:openSUSE-Tumbleweed";
    const TW = await getProject(con, project);

    expect(TW).to.have.property("apiUrl", con.url);
    expect(TW).to.have.property("name", project);
    expect(TW).to.have.property("meta");
    expect(TW)
      .to.have.property("packages")
      .that.deep.equals([
        { name: "kiwi-images-vagrant", project },
        { name: "kiwi-templates-JeOS", project },
        { name: "live-kiwi-hook", project },
        { name: "livecd-openSUSE", project },
        { name: "livecd-tumbleweed-gnome", project },
        { name: "livecd-tumbleweed-kde", project },
        { name: "livecd-tumbleweed-x11", project },
        { name: "livecd-tumbleweed-xfce", project }
      ]);

    expect(TW.meta).to.deep.include({
      name: project,
      title: "openSUSE Tumbleweed Images",
      description:
        "Contains the Live CD, JeOS, Vagrant boxes and possibly more.",
      person: [
        { userId: "dancermak", role: LocalRole.Maintainer },
        { userId: "dcassany", role: LocalRole.Maintainer },
        { userId: "favogt", role: LocalRole.Maintainer },
        { userId: "gmoro", role: LocalRole.Maintainer }
      ]
    });
  });
});
