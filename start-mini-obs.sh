#!/bin/bash

set -euox pipefail

export REPO_DIR="open-build-service"

pushd .

if [[ ! -d "${REPO_DIR}" ]]; then
  git clone https://github.com/openSUSE/${REPO_DIR}.git
fi

cd "${REPO_DIR}"
git fetch -tp origin
git checkout master
git reset --hard origin/master
git submodule init
git submodule update

# don't build the containers for testing, we don't need them and it just takes ages
sed -i '/docker-compose.*docker-compose\.yml.*docker-compose\.minitest\.yml.*docker-compose\.minitest-user\.yml.*build.*minitest/d' Rakefile
rake docker:build
docker-compose up -d
