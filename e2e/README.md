# E2E tests

The package contains Dial end-to-end tests. Tests are implemented using [Playwright](https://playwright.dev/) framework.

## Prerequisites

Before running tests, setup USER_TOKEN and E2E_HOST env variables in .env file

## Running tests

Run `npm run test-local` to execute the tests locally (installation of default browsers may be required: `npx playwright install`)

Config file used for CI pipeline: `playwright.config.ts`

Config file used for local run: `local.playwright.config.ts`

Set path to config file as a CLI argument:

`npx playwright test -c local.playwright-ct.config.ts`


To run tests inside docker container:

```
# Unix
docker run --rm --network host -v "$(pwd)":/test/ -w /test/ -it mcr.microsoft.com/playwright:v1.36.0-jammy /bin/bash

# Win
docker run --rm --network host -v ${pwd}:/test/ -w /test/ -it mcr.microsoft.com/playwright:v1.36.0-jammy /bin/bash

npm i
npm run test-local
```

Image version should correspond Playwright version


To generate Allure report:

`allure serve allure-results`

To run a specific test:
 - Set the test to `test.only`
