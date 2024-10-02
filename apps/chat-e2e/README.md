# E2E tests

The package contains Dial end-to-end tests. Tests are implemented using [Playwright](https://playwright.dev/) framework.

## Prerequisites

By default, tests are using Auth0 provider to access an application. If a different authentication provider is needed, it must be set in the `AUTH_PROVIDER` variable and a new authentication provider class should be implemented.

`E2E_USERNAME` and `E2E_PASSWORD` env variables should be set to perform login.

## Add a new authentication provider for tests

To add a new authentication provider, you would need to create a new class that extends the `ProviderLogin` abstract class.
Here's a simplified example of how it should look:

```typescript
export class YourAuthProviderLogin extends ProviderLogin<YourAuthProviderPage> {
  constructor(loginPage: LoginPage, authProviderPage: YourAuthProviderPage, localStorageManager: LocalStorageManager) {
    super(loginPage, authProviderPage, localStorageManager);
  }

  public async navigateToCredentialsPage() {
    await this.loginPage.yourAuthProviderSignInButton.click();
  }
}
```

In this example, `YourAuthProviderLogin` is the new authentication provider class that extends `ProviderLogin<YourAuthProviderPage>` class.
It is necessary to implement the `navigateToCredentialsPage` method, an abstract method from `ProviderLogin`, which navigates from the `LoginPage` to the page where user credentials can be entered.

Additionally, the `YourAuthProviderPage` class, which extends `BasePage` and implements `LoginInterface` should be implemented. This class contains the logic for interacting with the authentication form of your provider, such as entering the username and password and clicking the login button. These actions must be defined in the `loginToChatBot` method.

```typescript
export class YourAuthProviderPage extends BasePage implements LoginInterface {
  //declare and initialize web-elements specific to authentication provider, e.g.:
  private yourAuthProviderForm!: YourAuthProviderForm;

  getYourAuthProviderForm(): YourAuthProviderForm {
    if (!this.yourAuthProviderForm) {
      this.yourAuthProviderForm = new YourAuthProviderForm(this.page);
    }
    return this.yourAuthProviderForm;
  }

  async loginToChatBot(username: string, password: string, options?: { setEntitiesEnvVars: boolean }) {
    await this.page.waitForLoadState();
    const yourAuthProviderForm = this.getYourAuthProviderForm();
    //implement interactions with the authentication provider's web-elements
    //...
    //do login and set env variables if required
    return this.waitForApiResponsesReceived(() => yourAuthProviderForm.loginButton.click(), options);
  }
}
```

In the `baseFixtures.ts` file, the `providerLogin` fixture checks the `AUTH_PROVIDER` environment variable to determine the login provider. If the `AUTH_PROVIDER` is undefined, it defaults to using the `Auth0` provider.

## API tests configuration

Dial API tests are divided into several groups based on their functionality:

- arithmetic API tests: this test group is intended to verify simple arithmetic requests to entities
- entity with addons API tests
- assistant with addons API tests
- simple text request API tests: these tests are designed to test the functionality of entities with simple text requests, an attachment can be expected as a response
- entity with attachment API tests: this test group is used to validate the functionality of APIs that handle requests with attachments

The input and expected data for the tests are configured in environment variables that must be a valid JSON, and they are parsed into different interface types. The table below illustrates the correlation between tests, environment variables, and interfaces:

| Test                          | Env variable                              | Interface                     | Example                                                                                                                                                                                  |
| ----------------------------- | ----------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entityArithmeticRequest`     | `ENTITY_ARITHMETIC_REQUEST_FOR_API_TESTS` | `ArithmeticRequestEntity`     | `'[{ "entityId": "gpt-35-turbo", "isSysPromptAllowed": "true" }]'`                                                                                                                       |
| `entityPlusAddons`            | `ENTITY_PLUS_ADDONS_FOR_API_TESTS`        | `EntityPlusAddonsRequest`     | `'[{ "entityId": "gpt-4", "addonIds": ["addon-wolfram"], "request": "plot y = x + 1", "response": "https://www6b3.wolframalpha.com/Calculate/MSP" }]'`                                   |
| `assistantPlusAddons`         | `ASSISTANT_PLUS_ADDONS_FOR_API_TESTS`     | `AssistantPlusAddonsRequest`  | `'[{ "assistantId": "test-assistant", "addonIds": ["addonId1", "addonId2"], "assistantModelId": "gpt-4", "request": "assistant request?", "response": "expected assistant response" }]'` |
| `entitySimpleRequest`         | `ENTITY_SIMPLE_REQUEST_FOR_API_TESTS`     | `EntitySimpleRequest`         | `'[{ "entityId": "stability.stable-diffusion-xl", "request": "draw smiling emoticon", "isAttachmentResponse": "true"}]'`                                                                 |
| `entityPlusAttachmentRequest` | `ENTITY_PLUS_ATTACHMENT_FOR_API_TESTS`    | `EntityPlusAttachmentRequest` | `'[{ "entityId": "gpt-4-vision-preview", "attachmentName": "sun.jpg", "response": "sun" }]'`                                                                                             |

If environment variable is not set, the corresponding test will not be executed.

## Listing tests configuration

The purpose of running listing tests is to guarantee that all necessary entities are correctly configured and accessible through `/api/models` and `/api/addons` API.
To execute these listing tests, the following environment variables need to be set:

| Env variable            | Interface | Example                                                           |
| ----------------------- | --------- | ----------------------------------------------------------------- |
| `MODELS_LIST_FOR_TESTS` | `Entity`  | `'[{"entityId":"gpt-35-turbo"}, {"entityId":"gpt-4"}]'`           |
| `ADDONS_LIST_FOR_TESTS` | `Entity`  | `'[{"entityId":"addon-wolfram"}, {"entityId":"addon-xweather"}]'` |

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

| Variable                                  | Required | Description                                                                                                                                                                                                | Available Values                                           | Default values        |
| ----------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | --------------------- |
| `E2E_HOST`                                | No       | The host URL for end-to-end testing.                                                                                                                                                                       | Any string                                                 | http://localhost:3000 |
| `E2E_USERNAME`                            | Yes      | Comma separated list of usernames for e2e authentification. The number of users should be equal to number of workers set in playwright config plus two users to verify share feature, e.g. E2E_WORKERS + 2 | Any string                                                 |                       |
| `E2E_OVERLAY_USERNAME`                    | Yes      | Comma separated list of usernames for overlay sandbox authentification. The number of users should be equal to number of workers set in playwright config                                                  | Any string                                                 |                       |
| `E2E_WORKERS`                             | No       | Number of threads to run e2e tests                                                                                                                                                                         | Any number                                                 | 3                     |
| `E2E_OVERLAY_WORKERS`                     | No       | Number of threads to run e2e overlay tests                                                                                                                                                                 | Any number                                                 | 1                     |
| `E2E_PASSWORD`                            | Yes      | A password for e2e authentification, same for chat and overlay                                                                                                                                             | Any string                                                 |                       |
| `TMS_URL`                                 | No       | TMS URL                                                                                                                                                                                                    | Any string                                                 |                       |
| `ISSUE_URL`                               | No       | Issue URL                                                                                                                                                                                                  | Any string                                                 |                       |
| `NEXT_PUBLIC_OVERLAY_HOST`                | No       | Overlay domain host                                                                                                                                                                                        | Any string                                                 | http://localhost:3000 |
| `AUTH_PROVIDER`                           | No       | Name of authentication provider                                                                                                                                                                            | `AuthProvider` enum values                                 | auth0                 |
| `ENTITY_ARITHMETIC_REQUEST_FOR_API_TESTS` | No       | Dial entities used for simple arithmetic API test                                                                                                                                                          | json corresponding `ArithmeticRequestEntity` interface     |                       |
| `ENTITY_PLUS_ADDONS_FOR_API_TESTS`        | No       | Dial entities used for entity+addons API test                                                                                                                                                              | json corresponding `EntityPlusAddonsRequest` interface     |                       |
| `ENTITY_SIMPLE_REQUEST_FOR_API_TESTS`     | No       | Dial entities used for text request API test, attachment can be expected as a response                                                                                                                     | json corresponding `EntitySimpleRequest` interface         |                       |
| `ENTITY_PLUS_ATTACHMENT_FOR_API_TESTS`    | No       | Dial entities used for attachment request API test                                                                                                                                                         | json corresponding `EntityPlusAttachmentRequest` interface |                       |
| `ASSISTANT_PLUS_ADDONS_FOR_API_TESTS`     | No       | Dial entities used for assistant+addons API test                                                                                                                                                           | json corresponding `AssistantPlusAddonsRequest` interface  |                       |
| `MODELS_LIST_FOR_TESTS`                   | No       | Dial entities used for listing test                                                                                                                                                                        | json corresponding `Entity` interface                      |                       |
| `ADDONS_LIST_FOR_TESTS`                   | No       | Dial entities used for listing test                                                                                                                                                                        | json corresponding `Entity` interface                      |                       |
