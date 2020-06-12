# open-build-service-api

[![Build Status](https://travis-ci.org/SUSE/open-build-service-api.svg?branch=master)](https://travis-ci.org/SUSE/open-build-service-api)
[![CI](https://github.com/SUSE/open-build-service-api/workflows/CI/badge.svg)](https://github.com/SUSE/open-build-service-api/actions?query=workflow%3ACI)
[![coverage](https://codecov.io/gh/SUSE/open-build-service-api/branch/master/graphs/badge.svg?branch=master)](https://codecov.io/gh/SUSE/open-build-service-api)

API wrapper for the Open Build Service implemented in Typescript.


# Usage

At first, you need to setup a `Connection` object that will be used for further
communication with the Open Build Service (OBS):

``` typescript
import { Connection } from "open-build-service-api";

const con = new Connection("myUser", "myPassword");
```

You can also import existing accounts from your `~/.config/osc/oscrc`
configuration file as follows:
``` typescript
import { readAccountsFromOscrc } from "open-build-service-api";

const accounts = await readAccountsFromOscrc();
const con = Connection.from(
    accounts.find((acc) => acc.apiUrl === "https://api.my-instance.org")!
);
```

Once you have obtained a `Connection`, you can start doing actually useful
things™. For instance to checkout (= clone) a project to your local file system,
run:
```typescript
import { checkOutProject, fetchProject } from "open-build-service-api";

const proj = await fetchProject(con, "devel:libraries:c_c++");
await checkOutProject(proj, "/path/to/the/directory/");
```

# Development

You'll need node.js and the yarn package manager for development. To start
hacking, run:
```ShellSession
$ git clone https://github.com/SUSE/open-build-service-api
$ cd open-build-service-api
$ yarn install
```

Implement your modifications, write some tests and run them via `yarn run test`
or `yarn run coverage` (to also collect test coverage).

Please format your source code with [prettier](https://prettier.io/) before
committing your changes.


## Writing tests

Please implement tests for all new features that you add or for bugs that you
fix. We use the [mocha](https://mochajs.org/) test framework and
the [chai](https://www.chaijs.com/) assertion library.

Put unit tests into the `test/` folder, integration tests into
`test/integration/` and tests of the low level API wrappers into `test/api/`.

As most of the functions have to communicate with an OBS instance, we need to
be able to test these without communicating with an actual instance on the
Internet (like https://build.opensuse.org). We have a two way approach here:
1. For readonly access, we use [nock](https://github.com/nock/nock) to record
   the HTTP requests and replay them.
2. For read-write access (e.g. committing changes), we use the official
   [development environment from the open build service
   team](https://github.com/openSUSE/open-build-service/blob/master/CONTRIBUTING.md#how-to-setup-an-obs-development-environment).


### Writing a read-only test

You need to add the functions `beforeEachRecord` and `afterEachRecord` as the
`beforeEach()` and `afterEach()` hooks to your test:
```typescript
import {
  afterEachRecord,
  ApiType,
  beforeEachRecord,
  getTestConnection
} from "./test-setup";

describe("#MyClass", () => {
  beforeEach(beforeEachRecord);
  afterEach(afterEachRecord);

  const con = getTestConnection(ApiType.Production);

  it("does the right thing", async () => {
    // actual test goes in here
  });
})
```

The hooks will automatically record all HTTP requests on the first run and save
them in the `fixtures/` subdirectory. Recording requires that you have a valid
account for [OBS](https://build.opensuse.org) and provide the username and
password via the environment variables `OBS_USERNAME` and `OBS_PASSWORD`,
respectively.

In case you want to refresh the fixtures, delete **all** json files belonging to
that test suite (= the `describe()` block** and run the tests again.

**WARNING:** If you need to perform additional setup in `beforeEach`, then do
the following and don't forget to `await` beforeEachRecord():
```typescript
beforeEach(async function () {
  this.beforeEachRecord = beforeEachRecord;
  await this.beforeEachRecord();
  // additional setup follows here
});
```

### Writing read-write tests

In case you want to write tests that modify contents on OBS, then this cannot be
done on a live instance. For that we use the official development environment
from the Open Build Service (see:
https://github.com/openSUSE/open-build-service/blob/master/CONTRIBUTING.md#how-to-setup-an-obs-development-environment). To
launch it install docker and docker-compose, use the wrapper script
`start-mini-obs.sh` and run the tests with the environment variable
`HAVE_MINI_OBS` set to any value:
```ShellSession
$ ./start-mini-obs.sh
$ HAVE_MINI_OBS=1 yarn run coverage
```

For writing the actual tests, use the test connection type `ApiType.MiniObs` and
add the function `skipIfNoMiniObsHook` as a `before()` mocha-hook and ensure
that the timeout is large enough:

```typescript
describe("RwTest", function () {
  this.timeout(10000);

  before(skipIfNoMiniObsHook);
  const con = getTestConnection(ApiType.MiniObs);

  it("#testFunc", async () => {
    /* the actual test goes in here*/
  });
});
```
