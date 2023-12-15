# E2E tests

The package contains Dial end-to-end tests. Tests are implemented using [Playwright](https://playwright.dev/) framework.

## Prerequisites

Tests are using Auth0 credentials to access an application.
Please, set `AUTH_TEST_TOKEN` variable in .env file in order to enable it.

When run tests on CI, `E2E_USERNAME` and `E2E_PASSWORD` CI variable should be set to perform Auth0 login.


## Run tests locally

Run `npm run test:e2e` to execute the tests locally. 
Installation of default browsers may be required, when run for the 1st time: `npx playwright install`.

Local version of application is automatically started before execution the tests on `http://localhost:3000`.
Config file used for local run is `local.playwright.config.ts`.

After tests execution finished, 2 kind of reports are generated: html, allure.

To open html report, run `npm run test:e2e:html`.

Before generating Allure report, install it on your local machine following the guide: https://docs.qameta.io/allure/#_get_started.

To generate Allure report, run `npm allure:serve`.

Every test inside local report contains video recording and trace attached.

If need to execute tests inside docker container run:

```
# Unix
docker run --rm --network host -v "$(pwd)":/test/ -w /test/ -it mcr.microsoft.com/playwright:v1.36.0-jammy /bin/bash

# Win
docker run --rm --network host -v ${pwd}:/test/ -w /test/ -it mcr.microsoft.com/playwright:v1.36.0-jammy /bin/bash

npm i
npm run test:e2e
```

Image version should correspond Playwright version.


## Run tests on CI

Config file used for CI pipeline: `playwright.config.ts`.

`npm test:e2e-ci` command is used to trigger tests on CI.

Generated Allure report is attached as a job artifact.
To view CI Allure report:
- for Chrome: run `chrome.exe --disable-web-security --disable-gpu --user-data-dir=~/chromeTemp`
- for FireFox: open `about:config` in browser and set `security.fileuri.strict_origin_policy` to false.

CI report includes screenshots for failed tests. 
