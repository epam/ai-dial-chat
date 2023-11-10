# DIAL Chat

This is a default UI for [AI DIAL](https://epam-rail.com). AI DIAL can be used as headless system, but UI is recommended to learn the capability.

Originally forked from [chatbot-ui](https://github.com/mckaywrigley/chatbot-ui) and then completely reworked and published under [apache 2.0 license](./LICENSE), while code taken from original repository is still subject to [original MIT license](./license-original). Due to rework we introduced lots of new features such as varios IDP support, model side-by-side compare, [DIAL extensions](https://epam-rail.com/extension-framework) support, conversation replays, branding and many more.

![ai-dial-chat](./docs/ai-dial-chat.png)

## Docs

`ChatOverlay` documentation is placed [here](./docs/OVERLAY.md).

`Theme` documentation is placed [here](./docs/THEME-CUSTOMIZATION.md).

## Overview

This project is a web application built using [Next.js](https://nextjs.org/), a React framework with server-rendering capabilities. It can be easily customized and adapted to your needs by following the steps mentioned below.

## Developer Environment

Before diving into the development environment, you should have Node.js (version >=14.6.0) and npm (version >=6.14.6) installed on your system. If you don't already have them, follow the instructions [here](https://nodejs.org/en/download/).

Once you've installed Node.js and npm, follow these steps to set up your developer environment:

1. Clone the repository:

```
git clone https://github.com/epam/ai-dial-chat.git
```

2. Navigate to the project directory:

```bash
cd ai-dial-chat
```

3. Install project dependencies:

```bash
npm install
```

4. Create `.env.local` file and add next variables with appropriate values(more info in [Environment Variables](#environment-variables)):

```
OPENAI_API_HOST="ADD_VALUE_HERE"
OPENAI_API_KEY="ADD_VALUE_HERE"
NEXTAUTH_SECRET="ADD_VALUE_HERE"
```

5. To start the development server, run:

```bash
npm run dev
```

5. To start the development server, run:

```bash
npm run dev
```

## Build

To create an optimized build of your application, run the following command:

```bash
npm run build
```

After running the command, you'll see a `.next` folder created in your project directory which contains the optimized output.

## Run

To start the development server, run:

```bash
npm run dev
```

Once the server is up and running, open `http://localhost:3000` in your browser to view your application.

To run the optimized production build, first build the app and then run:

```bash
npm start
```

This will start a production server on the default port 3000.

## Test

To run the unit tests suite for your application, execute the following command:

```bash
npm test
```

To run the e2e tests run the following command:

```bash
npm run test:e2e
```

For more info check [E2E tests documentation](e2e/README.md)

## Environment Variables

This project leverages environment variables for configuration.

**Note: for development we have some predefined variables located in `.env.development`**

| Variable                            | Required                        | Description                                                                                                                  | Available Values             | Default values |
| ----------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------- |
| `OPENAI_API_HOST`                   | Yes                             | OpenAI API Host                                                                                                              | Any string                   |                |
| `OPENAI_API_KEY`                    | Yes                             | OpenAI API Key                                                                                                               | Any string                   |                |
| `OPENAI_API_VERSION`                | Yes                             | OpenAI API Version                                                                                                           | Any string                   |                |
| `APP_BASE_PATH`                     | No                              | Application base path                                                                                                        | Any string                   |                |
| `APP_BASE_ORIGIN`                   | Yes (if `APP_BASE_PATH` is set) | Application base origin                                                                                                      | Any string                   |                |
| `ALLOWED_IFRAME_ORIGINS`            | No                              | Allowed iFrame Origins                                                                                                       | Any origin valid format. See | none           |
| `IS_IFRAME`                         | No                              | Is iFrame                                                                                                                    | `true`, `false`              | false          |
| `ENABLED_FEATURES`                  | No                              | Enabled Features                                                                                                             | Any string                   |                |
| `NEXT_PUBLIC_APP_NAME`              | No                              | Public Application Name                                                                                                      | Any string                   | AI Dial        |
| `NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT` | No                              | Public Default System Prompt                                                                                                 | Any string                   |                |
| `NEXT_PUBLIC_DEFAULT_TEMPERATURE`   | No                              | Public Default Temperature                                                                                                   | 0 to 1                       |                |
| `DEFAULT_MODEL`                     | No                              | Default Model                                                                                                                | Any string                   | gpt-35-turbo   |
| `DEFAULT_ASSISTANT_SUB_MODEL`       | No                              | Default Assistant Sub Model                                                                                                  | Any string                   | gpt-4          |
| `RECENT_MODELS_IDS`                 | No                              | A list of IDs for recently used AI models.                                                                                   | Any string                   |                |
| `RECENT_ADDONS_IDS`                 | No                              | A list of IDs for recently used AI model addons.                                                                             | Any string                   |                |
| `E2E_HOST`                          | No                              | The host URL for end-to-end testing. More info in [E2E tests documentation](e2e/README.md)                                   | Any string                   |                |
| `PREVIEW_TEST_TOKEN`                | No                              | A test token for e2e authentification. More info in [E2E tests documentation](e2e/README.md)                                 | Any string                   |                |
| `TRACES_URL`                        | No                              | Traces URL                                                                                                                   | Any string                   |                |
| `TMS_URL`                           | No                              | TMS URL                                                                                                                      | Any string                   |                |
| `ISSUE_URL`                         | No                              | Issue URL                                                                                                                    | Any string                   |                |
| `THEMES_CONFIG_HOST`                | No                              | The host URL for custom themes configuration. More info in [Themes configuration documentation](docs/THEME-CUSTOMIZATION.md) | Any string                   |                |
| `FOOTER_HTML_MESSAGE`               | No                              | Footer HTML Message                                                                                                          | Any string                   |                |
| `AZURE_FUNCTIONS_API_HOST`          | No                              | Azure Functions API Host                                                                                                     | Any string                   |                |
| `REPORT_ISSUE_CODE`                 | No                              | Report Issue Code used when sending report issue info to AZURE_FUNCTIONS_API_HOST                                            | Any string                   |                |
| `REQUEST_API_KEY_CODE`              | No                              | Request API Key Code used when sending request api key info to AZURE_FUNCTIONS_API_HOST                                      | Any string                   |                |
| `CODE_GENERATION_WARNING`           | No                              | Warning text regarding code generation                                                                                       | Any string                   |                |
| `SHOW_TOKEN_SUB`                    | No                              | Show token sub in refresh login error logs                                                                                   | `true`, `false`              | false          |

The .env file contains environment variables that can be used to configure your app's settings and behavior. These values can be changed as needed to suit your specific requirements.

Also we have a lot of auth specific env variables:

| Variable                  | Required             | Description                                                         | Available Values | Default values |
| ------------------------- | -------------------- | ------------------------------------------------------------------- | ---------------- | -------------- |
| `AUTH_DISABLED`           | No                   | A flag to enable or disable authentication.                         | `true`, `false`  | false          |
| `NEXTAUTH_URL`            | Yes (for production) | NextAuth URL                                                        | Any string       |                |
| `NEXTAUTH_SECRET`         | Yes                  | NextAuth Secret (generate by `openssl rand -base64 32` for example) | Any string       |                |
| `AUTH_TEST_TOKEN`         | No                   | Test Token                                                          | Any string       |                |
| `AUTH_AUTH0_AUDIENCE`     | No                   | Auth0 Audience                                                      | Any string       |                |
| `AUTH_AUTH0_CLIENT_ID`    | No                   | Auth0 Client ID                                                     | Any string       |                |
| `AUTH_AUTH0_HOST`         | No                   | Auth0 Host                                                          | Any string       |                |
| `AUTH_AUTH0_NAME`         | No                   | Auth0 Name                                                          | Any string       |                |
| `AUTH_AUTH0_SECRET`       | No                   | Auth0 Secret                                                        | Any string       |                |
| `AUTH_AZURE_AD_CLIENT_ID` | No                   | Azure AD Client ID                                                  | Any string       |                |
| `AUTH_AZURE_AD_NAME`      | No                   | Azure AD Name                                                       | Any string       |                |
| `AUTH_AZURE_AD_SECRET`    | No                   | Azure AD Secret                                                     | Any string       |                |
| `AUTH_AZURE_AD_TENANT_ID` | No                   | Azure AD Tenant ID                                                  | Any string       |                |
| `AUTH_GITLAB_CLIENT_ID`   | No                   | GitLab Client ID                                                    | Any string       |                |
| `AUTH_GITLAB_HOST`        | No                   | GitLab Host                                                         | Any string       |                |
| `AUTH_GITLAB_NAME`        | No                   | GitLab Name                                                         | Any string       |                |
| `AUTH_GITLAB_SECRET`      | No                   | GitLab Secret                                                       | Any string       |                |
| `AUTH_GOOGLE_CLIENT_ID`   | No                   | Google Client ID                                                    | Any string       |                |
| `AUTH_GOOGLE_NAME`        | No                   | Google Name                                                         | Any string       |                |
| `AUTH_GOOGLE_SECRET`      | No                   | Google Secret                                                       | Any string       |                |
| `AUTH_KEYCLOAK_CLIENT_ID` | No                   | Keycloak Client ID                                                  | Any string       |                |
| `AUTH_KEYCLOAK_HOST`      | No                   | Keycloak Host                                                       | Any string       |                |
| `AUTH_KEYCLOAK_NAME`      | No                   | Keycloak Name                                                       | Any string       |                |
| `AUTH_KEYCLOAK_SECRET`    | No                   | Keycloak Secret                                                     | Any string       |                |
| `AUTH_PING_ID_CLIENT_ID`  | No                   | PingID Client ID                                                    | Any string       |                |
| `AUTH_PING_ID_HOST`       | No                   | PingID Host                                                         | Any string       |                |
| `AUTH_PING_ID_NAME`       | No                   | PingID Name                                                         | Any string       |                |
| `AUTH_PING_ID_SECRET`     | No                   | PingID Secret                                                       | Any string       |                |
