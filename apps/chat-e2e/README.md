# E2E tests

The package contains Dial end-to-end tests. Tests are implemented using [Playwright](https://playwright.dev/) framework.

## Prerequisites

Tests are using Auth0 credentials to access an application.

When run tests on CI, `E2E_USERNAME` and `E2E_PASSWORD` CI variable should be set to perform Auth0 login.

## Run tests locally

Run `nx e2e chat-e2e` to execute the tests locally.
Installation of default browsers may be required, when run for the 1st time.

Local version of application is automatically started before execution the tests on `http://localhost:3000`.
Config file used for local run is `local.playwright.config.ts`.

After tests execution finished, 2 kind of reports are generated: html, allure.

Before generating Allure report, install it on your local machine following the guide: https://docs.qameta.io/allure/#_get_started.

To open html report, run the command `npx playwright show-report apps\chat-e2e\html-report`.

Allure report is opened in default browser using `allure serve apps/chat-e2e/allure-results`.

Every test inside local report contains video recording and trace attached.

If need to execute tests inside docker container run:

```
# Unix
docker run --rm --network host -v "$(pwd)":/test/ -w /test/ -it mcr.microsoft.com/playwright:v1.36.0-jammy /bin/bash

# Win
docker run --rm --network host -v ${pwd}:/test/ -w /test/ -it mcr.microsoft.com/playwright:v1.36.0-jammy /bin/bash

npm i
nx e2e chat-e2e
```

Image version should correspond Playwright version.

## Run tests on CI

Config file used for CI pipeline: `playwright.config.ts`.

`nx e2e chat-e2e --configuration=production` command is used to trigger tests on CI.

Generated Allure report is attached as a job artifact.
To view CI Allure report:

- for Chrome: run `chrome.exe --disable-web-security --disable-gpu --user-data-dir=~/chromeTemp`
- for FireFox: open `about:config` in browser and set `security.fileuri.strict_origin_policy` to false.

CI report includes screenshots for failed tests.

## Environment variables

The following variables should be placed inside `chat-e2e/.env.local` file in order to run tests locally

| Variable       | Required | Description                                                                                                                                                                                                | Available Values | Default values |
| -------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | -------------- |
| `E2E_HOST`     | No       | The host URL for end-to-end testing.                                                                                                                                                                       | Any string       |                |
| `E2E_USERNAME` | No       | Comma separated list of usernames for e2e authentification. The number of users should be equal to number of workers set in playwright config plus two users to verify share feature, e.g. E2E_WORKERS + 2 | Any string       |                |
| `E2E_WORKERS`  | No       | Number of threads to run e2e tests                                                                                                                                                                         | Any number       |                |
| `E2E_PASSWORD` | No       | A password for e2e authentification                                                                                                                                                                        | Any string       |                |
| `TMS_URL`      | No       | TMS URL                                                                                                                                                                                                    | Any string       |                |
| `ISSUE_URL`    | No       | Issue URL                                                                                                                                                                                                  | Any string       |                |
