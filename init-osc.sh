#!/bin/bash

set -euox pipefail

if pipenv --venv; then
  exit 0
fi

APIURL="http://localhost:3000"
OBS_USERNAME="obsTestUser"
OBS_PASSWORD="nots3cr3t"

pipenv --three
pipenv install osc

mkdir -p ./.osc_config/osc/
cat << EOF > ./.osc_config/osc/oscrc
[general]
apiurl = ${APIURL}
use_keyring = 0

[${APIURL}]
user = ${OBS_USERNAME}
pass = ${OBS_PASSWORD}
aliases = miniobs
realname = ${OBS_USERNAME}
email = noreply@nonexistent-domain.asdf
EOF
