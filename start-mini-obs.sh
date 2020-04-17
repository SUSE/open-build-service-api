#!/bin/bash

set -euo pipefail

export repo_dir="open-build-service"
export obs_url="http://localhost:3000"
obs_version=2.10.2

pushd .

if [[ ! -d "${repo_dir}" ]]; then
  git clone https://github.com/openSUSE/${repo_dir}.git
fi

cd "${repo_dir}"
git fetch origin master
git reset --hard ${obs_version}
git submodule init
git submodule update

rake docker:build
docker-compose up &

# from openSUSE-release-tools/dist/ci/docker-compose-test.sh:
c=0
until curl ${obs_url}/about 2>/dev/null ; do
  ((c++)) && ((c==500)) && (
    curl ${obs_url}/about
    exit 1
  )
  sleep 1
done

popd

TEST_USER="obsTestUser"
CREDENTIALS="Admin:opensuse"

# setup a test user
curl --user ${CREDENTIALS} -X PUT ${obs_url}/person/obsTestUser -d "
<person>
<login>${TEST_USER}</login>
<email>${TEST_USER}@notexisting.com</email>
<state>confirmed</state>
</person>
"
curl --user ${CREDENTIALS} -X POST ${obs_url}/person/${TEST_USER}?cmd=change_password -d "nots3cr3t"

curl --user ${CREDENTIALS} -X PUT ${obs_url}/group/testers -d "<group>
<title>testers</title>
<person>
<person user_id='${TEST_USER}'/>
</person>
</group>"

curl --user ${CREDENTIALS} -X PUT ${obs_url}/group/admins -d "<group>
<title>admins</title>
<person>
<person user_id='Admin'/>
</person>
</group>"

curl --user ${CREDENTIALS} -X PUT ${obs_url}/group/everyone -d "<group>
<title>everyone</title>
<person>
<person user_id='Admin'/>
<person user_id='${TEST_USER}'/>
</person>
</group>"

curl --user ${CREDENTIALS} -X PUT ${obs_url}/source/openSUSE:Factory/_meta -d "
<project name='openSUSE:Factory'>
  <title>The next openSUSE distribution</title>
  <description>Have a look at http://en.opensuse.org/Portal:Factory for more details.</description>
  <person userid='Admin' role='maintainer'/>
  <lock>
    <disable/>
  </lock>
  <build>
    <disable repository='snapshot'/>
    <disable repository='ports'/>
  </build>
  <publish>
    <disable/>
    <enable repository='standard'/>
  </publish>
  <debuginfo>
    <enable/>
  </debuginfo>
  <repository name='standard' rebuild='local'>
    <arch>x86_64</arch>
    <arch>i586</arch>
  </repository>
  <repository name='ports'>
    <arch>ppc64le</arch>
    <arch>ppc64</arch>
    <arch>ppc</arch>
    <arch>armv6l</arch>
    <arch>armv7l</arch>
    <arch>aarch64</arch>
  </repository>
</project>
"
