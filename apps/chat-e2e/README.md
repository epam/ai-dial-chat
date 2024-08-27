# E2E tests

The package contains Dial end-to-end tests. Tests are implemented using [Playwright](https://playwright.dev/) framework.

## Prerequisites

By default, tests are using Auth0 provider to access an application. If a different authentication provider is needed, it must be set in the `AUTH_PROVIDER` variable and a method that extends `ProviderLogin<>` class should be implemented.

`E2E_USERNAME` and `E2E_PASSWORD` env variables should be set to perform login.

## Run tests locally

Run `nx e2e chat-e2e` to execute chat and overlay sandbox tests locally.
Installation of default browsers may be required, when run for the 1st time.

Local version of application is automatically started before execution the tests on `http://localhost:3000`.
Config file used for local run is `local.chat.playwright.config.ts`.

Overlay sandbox is launched on `http://localhost:4200` and use `local.overlay.playwright.config.ts` config for tests.

To run only chat e2e tests use `nx run chat-e2e:e2e:chat`, for overlay sandbox tests `nx run chat-e2e:e2e:overlay`.

After tests execution finished, 2 kind of reports are generated: html, allure.

Before generating Allure report, install it on your local machine following the guide: https://docs.qameta.io/allure/#_get_started.

To open chat html report, run the command `npx playwright show-report apps\chat-e2e\chat-html-report`, for overlay report - `npx playwright show-report apps\chat-e2e\overlay-html-report`

Chat allure report is opened in default browser using `allure serve apps/chat-e2e/allure-chat-results`, overlay allure report is triggered by `allure serve apps/chat-e2e/allure-overlay-results`

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

Config files used for CI pipeline: `chat.playwright.config.ts` and `overlay.playwright.config.ts`

`nx e2e chat-e2e --configuration=production` command is used to trigger tests on CI.

Generated Allure report is attached as a job artifact.
To view CI Allure report:

- for Chrome: open report in browser instance started with command `"[PATH_TO_CHROME]\chrome.exe" --disable-web-security --disable-gpu --user-data-dir=%LOCALAPPDATA%\Google\chromeTemp`
- for FireFox: open `about:config` in browser and set `security.fileuri.strict_origin_policy` to false.

CI report includes screenshots for failed tests.

## Environment variables

The following variables should be placed inside `chat-e2e/.env.local` file in order to run tests locally

| Variable                                  | Required | Description                                                                                                                                                                                                | Available Values                                                                                                                                                                                                                                                           | Default values        |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `E2E_HOST`                                | No       | The host URL for end-to-end testing.                                                                                                                                                                       | Any string                                                                                                                                                                                                                                                                 | http://localhost:3000 |
| `E2E_USERNAME`                            | Yes      | Comma separated list of usernames for e2e authentification. The number of users should be equal to number of workers set in playwright config plus two users to verify share feature, e.g. E2E_WORKERS + 2 | Any string                                                                                                                                                                                                                                                                 |                       |
| `E2E_OVERLAY_USERNAME`                    | Yes      | Comma separated list of usernames for overlay sandbox authentification. The number of users should be equal to number of workers set in playwright config                                                  | Any string                                                                                                                                                                                                                                                                 |                       |
| `E2E_WORKERS`                             | No       | Number of threads to run e2e tests                                                                                                                                                                         | Any number                                                                                                                                                                                                                                                                 | 3                     |
| `E2E_OVERLAY_WORKERS`                     | No       | Number of threads to run e2e overlay tests                                                                                                                                                                 | Any number                                                                                                                                                                                                                                                                 | 1                     |
| `E2E_PASSWORD`                            | Yes      | A password for e2e authentification, same for chat and overlay                                                                                                                                             | Any string                                                                                                                                                                                                                                                                 |                       |
| `TMS_URL`                                 | No       | TMS URL                                                                                                                                                                                                    | Any string                                                                                                                                                                                                                                                                 |                       |
| `ISSUE_URL`                               | No       | Issue URL                                                                                                                                                                                                  | Any string                                                                                                                                                                                                                                                                 |                       |
| `NEXT_PUBLIC_OVERLAY_HOST`                | No       | Overlay domain host                                                                                                                                                                                        | Any string                                                                                                                                                                                                                                                                 | http://localhost:3000 |
| `AUTH_PROVIDER`                           | No       | Name of authentication provider                                                                                                                                                                            | `AuthProvider` enum values                                                                                                                                                                                                                                                 | auth0                 |
| `ENTITY_ARITHMETIC_REQUEST_FOR_API_TESTS` | No       | Dial entities used for simple arithmetic API test                                                                                                                                                          | Should be a valid json corresponding `ArithmeticRequestEntity` interface, e.g. `'[{ "entityId": "gpt-35-turbo", "isSysPromptAllowed": "true" }]'`                                                                                                                          |                       |
| `ENTITY_PLUS_ADDONS_FOR_API_TESTS`        | No       | Dial entities used for entity+addons API test                                                                                                                                                              | Should be a valid json corresponding `EntityPlusAddonsRequest` interface, e.g. `'[{ "entityId": "gpt-4", "addonIds": ["addon-wolfram"], "request": "plot y = x + 1", "response": "https://www6b3.wolframalpha.com/Calculate/MSP" }]'`                                      |                       |
| `ENTITY_SIMPLE_REQUEST_FOR_API_TESTS`     | No       | Dial entities used for text request API test, attachment can be expected as a response                                                                                                                     | Should be a valid json corresponding `EntitySimpleRequest` interface, e.g. `'[{ "entityId": "stability.stable-diffusion-xl", "request": "draw smiling emoticon", "isAttachmentResponse": "true"}]'`                                                                        |                       |
| `ENTITY_PLUS_ATTACHMENT_FOR_API_TESTS`    | No       | Dial entities used for attachment request API test                                                                                                                                                         | Should be a valid json corresponding `EntityPlusAttachmentRequest` interface, e.g. `'[{ "entityId": "gpt-4-vision-preview", "attachmentName": "sun.jpg", "response": "sun" }]'`                                                                                            |                       |
| `ASSISTANT_PLUS_ADDONS_FOR_API_TESTS`     | No       | Dial entities used for assistant+addons API test                                                                                                                                                           | Should be a valid json corresponding `AssistantPlusAddonsRequest` interface, e.g. `'[{ "assistantId": "test-assistant", "addonIds": ["addonId1", "addonId2"], "assistantModelId": "gpt-4", "request": "assistant request?", "response": "expected assistant response" }]'` |                       |
