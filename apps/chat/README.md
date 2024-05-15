# DIAL Chat

This is a default UI for [AI DIAL](https://epam-rail.com). AI DIAL can be used as headless system, but UI is recommended to learn the capability.

Originally forked from [chatbot-ui](https://github.com/mckaywrigley/chatbot-ui) and then completely reworked and published under [apache 2.0 license](./LICENSE), while code taken from original repository is still subject to [original MIT license](./license-original). Due to rework we introduced lots of new features such as varios IDP support, model side-by-side compare, [DIAL extensions](https://epam-rail.com/extension-framework) support, conversation replays, branding and many more.

![ai-dial-chat](../../docs/ai-dial-chat.png)

## Docs

`AI DIAL Overlay` documentation is placed [here](./libs/overlay/README.md).

`Theming and branding` documentation is placed [here](./docs/THEME-CUSTOMIZATION.md).

## Overview

This project is a web application built using [Next.js](https://nextjs.org/), a React framework with server-rendering capabilities. It can be easily customized and adapted to your needs by following the steps mentioned below.

## Developer Environment

This project is managed by nx ([NX](https://nextjs.org/)).

Before diving into the development environment, you should have Node.js (version >=18.18.2) and npm (version >=9.8.1) installed on your system. If you don't already have them, follow the instructions [here](https://nodejs.org/en/download/).

Once you've installed Node.js and npm, follow these steps to set up your developer environment:

1. Clone the repository:

```
git clone https://github.com/epam/ai-dial-chat.git
```

2. Install project dependencies:

```bash
npm install
```

3. Create `.env.local` file and add next variables with appropriate values(more info in [Environment Variables](#environment-variables)):

```
DIAL_API_HOST="ADD_VALUE_HERE"
DIAL_API_KEY="ADD_VALUE_HERE"
NEXTAUTH_SECRET="ADD_VALUE_HERE"
```

4. To start the development server, run:

```bash
npm run nx serve chat
```

## Build

To create an optimized build of your application, run the following command:

```bash
npm run nx build chat --configuration=production
```

After running the command, you'll see a `.next` folder created in your project directory which contains the optimized output.

## Run

To start the development server, run:

```bash
npm run nx serve chat
```

Once the server is up and running, open `http://localhost:3000` in your browser to view your application.

To run the optimized production build, first build the app and then run:

```bash
npm run nx serve chat --configuration=production
```

This will start a production server on the default port 3000.

## Test

To run the unit tests suite for your application, execute the following command:

```bash
npm run nx test chat
```

To run the e2e tests run the following command:

```bash
npm run nx e2e chat-e2e
```

For more info check [E2E tests documentation](../chat-e2e/README.md)

## Environment Variables

This project leverages environment variables for configuration.

**Note: for development we have some predefined variables located in `.env.development`**

| Variable                            | Required                        | Description                                                                                                                                                                                                                                                                                   | Available Values                                                       | Default values                     |
| ----------------------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| `DIAL_API_HOST`                     | Yes                             | Dial API Host                                                                                                                                                                                                                                                                                 | Any string                                                             |                                    |
| `DIAL_API_KEY`                      | Yes                             | Dial API Key                                                                                                                                                                                                                                                                                  | Any string                                                             |                                    |
| `DIAL_API_VERSION`                  | No                              | Dial API Version                                                                                                                                                                                                                                                                              | Any string                                                             | `2024-02-01`                       |
| `APP_BASE_PATH`                     | No                              | Application base path                                                                                                                                                                                                                                                                         | Any string                                                             |                                    |
| `APP_BASE_ORIGIN`                   | Yes (if `APP_BASE_PATH` is set) | Application base origin                                                                                                                                                                                                                                                                       | Any string                                                             |                                    |
| `ALLOWED_IFRAME_ORIGINS`            | No                              | Allowed iFrame Origins                                                                                                                                                                                                                                                                        | Any origin valid format. See                                           | `none`                             |
| `IS_IFRAME`                         | No                              | Is iFrame                                                                                                                                                                                                                                                                                     | `true`, `false`                                                        | `false`                            |
| `ENABLED_FEATURES`                  | No                              | Enabled Features                                                                                                                                                                                                                                                                              | See available features [here](../../libs/shared/src/types/features.ts) |                                    |
| `NEXT_PUBLIC_APP_NAME`              | No                              | Public Application Name                                                                                                                                                                                                                                                                       | Any string                                                             | `AI Dial`                          |
| `NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT` | No                              | Public Default System Prompt                                                                                                                                                                                                                                                                  | Any string                                                             |                                    |
| `NEXT_PUBLIC_DEFAULT_TEMPERATURE`   | No                              | Public Default Temperature                                                                                                                                                                                                                                                                    | 0 to 1                                                                 |                                    |
| `DEFAULT_MODEL`                     | No                              | Default Model                                                                                                                                                                                                                                                                                 | Any string                                                             | First available model from listing |
| `DEFAULT_ASSISTANT_SUB_MODEL`       | No                              | Default Assistant Sub Model                                                                                                                                                                                                                                                                   | Any string                                                             | `gpt-4`                            |
| `RECENT_MODELS_IDS`                 | No                              | A list of IDs for recently used AI models.                                                                                                                                                                                                                                                    | Any string                                                             |                                    |
| `RECENT_ADDONS_IDS`                 | No                              | A list of IDs for recently used AI model addons.                                                                                                                                                                                                                                              | Any string                                                             |                                    |
| `THEMES_CONFIG_HOST`                | No                              | The host URL for custom themes configuration. More info in [Themes configuration documentation](docs/THEME-CUSTOMIZATION.md)                                                                                                                                                                  | Any string                                                             |                                    |
| `FOOTER_HTML_MESSAGE`               | No                              | Footer HTML Message                                                                                                                                                                                                                                                                           | Any string                                                             |                                    |
| `ANNOUNCEMENT_HTML_MESSAGE`         | No                              | Announcement banner HTML Message                                                                                                                                                                                                                                                              | Any string                                                             |                                    |
| `AZURE_FUNCTIONS_API_HOST`          | No                              | Azure Functions API Host                                                                                                                                                                                                                                                                      | Any string                                                             |                                    |
| `REPORT_ISSUE_CODE`                 | No                              | Report Issue Code used when sending report issue info to Azure Functions API Host                                                                                                                                                                                                             | Any string                                                             |                                    |
| `REQUEST_API_KEY_CODE`              | No                              | Request API Key Code used when sending request api key info to Azure Functions API Host                                                                                                                                                                                                       | Any string                                                             |                                    |
| `CODE_GENERATION_WARNING`           | No                              | Warning text regarding code generation                                                                                                                                                                                                                                                        | Any string                                                             |                                    |
| `SHOW_TOKEN_SUB`                    | No                              | Show token sub in refresh login error logs                                                                                                                                                                                                                                                    | `true`, `false`                                                        | `false`                            |
| `STORAGE_TYPE`                      | No                              | Type of storage used for getting and saving information generated by user. Now supported only `api`                                                                                                                                                                                           | `browserStorage`, `api`                                                | `api`                              |
| `KEEP_ALIVE_TIMEOUT`                | No                              | Determines the maximum time in milliseconds in seconds that a connection may be idle before it is closed by the server. This is needed because infrastructure usually have default keep alive timeout 60 seconds and next server should have bigger value. Used only when running dockerfile. | Any number string                                                      | `61000`                            |
| `TRACES_URL`                        | No                              | Traces URL                                                                                                                                                                                                                                                                                    | Any string                                                             |                                    |
| `MAX_PROMPT_TOKENS_DEFAULT_PERCENT` | No                              | Max prompt tokens default percent value of maxTotalTokens if max_prompt_tokens for model not presented. It used when calculate max_prompt_tokens for completions requests like minimum of it and `MAX_PROMPT_TOKENS_DEFAULT_VALUE`                                                            | Any string                                                             | `75`                               |
| `MAX_PROMPT_TOKENS_DEFAULT_VALUE`   | No                              | Max prompt tokens default value if max_prompt_tokens for model not presented. It used when calculate max_prompt_tokens for completions requests like minimum of it and `MAX_PROMPT_TOKENS_DEFAULT_PERCENT`                                                                                    | Any string                                                             | `2000`                             |

The .env file contains environment variables that can be used to configure your app's settings and behavior. These values can be changed as needed to suit your specific requirements.

Also we have a lot of auth specific env variables:

| Variable                  | Required             | Description                                                                                                                                                                                                                                        | Available Values | Default values                                  |
| ------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------------------------- |
| `NEXTAUTH_URL`            | Yes (for production) | NextAuth URL                                                                                                                                                                                                                                       | Any string       |                                                 |
| `NEXTAUTH_SECRET`         | Yes                  | NextAuth Secret (generate by `openssl rand -base64 32` for example)                                                                                                                                                                                | Any string       |                                                 |
| `AUTH_AUTH0_AUDIENCE`     | No                   | Auth0 Audience                                                                                                                                                                                                                                     | Any string       |                                                 |
| `AUTH_AUTH0_CLIENT_ID`    | No                   | Auth0 Client ID                                                                                                                                                                                                                                    | Any string       |                                                 |
| `AUTH_AUTH0_HOST`         | No                   | Auth0 Host                                                                                                                                                                                                                                         | Any string       |                                                 |
| `AUTH_AUTH0_NAME`         | No                   | Auth0 Name                                                                                                                                                                                                                                         | Any string       |                                                 |
| `AUTH_AUTH0_SECRET`       | No                   | Auth0 Secret                                                                                                                                                                                                                                       | Any string       |                                                 |
| `AUTH_AUTH0_SCOPE`        | No                   | Auth0 Scope                                                                                                                                                                                                                                        | Any string       | `openid email profile offline_access`           |
| `AUTH_AZURE_AD_CLIENT_ID` | No                   | A unique identifier for the client application registered in Azure Active Directory (AD). It is used to authenticate the client application when accessing Azure AD resources.                                                                     | Any string       |                                                 |
| `AUTH_AZURE_AD_NAME`      | No                   | A name of the Azure AD tenant. It is used to specify the specific Azure AD instance to authenticate against.                                                                                                                                       | Any string       |                                                 |
| `AUTH_AZURE_AD_SECRET`    | No                   | Also known as the client secret or application secret, this parameter is a confidential string that authenticates and authorizes the client application to access Azure AD resources. It serves as a password for the client application.          | Any string       |                                                 |
| `AUTH_AZURE_AD_TENANT_ID` | No                   | Tenant ID refers to a globally unique identifier (GUID) that represents a specific Azure AD tenant. It is used to identify and authenticate the Azure AD tenant that the client application belongs to.                                            | Any string       |                                                 |
| `AUTH_AZURE_AD_SCOPE`     | No                   | This parameter specifies the level of access and permissions that the client application requests when making a request to Azure AD resources. It defines the resources and actions that the application can access on behalf of a user or itself. | Any string       | `openid profile user.Read email offline_access` |
| `AUTH_GITLAB_CLIENT_ID`   | No                   | GitLab Client ID                                                                                                                                                                                                                                   | Any string       |                                                 |
| `AUTH_GITLAB_HOST`        | No                   | GitLab Host                                                                                                                                                                                                                                        | Any string       |                                                 |
| `AUTH_GITLAB_NAME`        | No                   | GitLab Name                                                                                                                                                                                                                                        | Any string       |                                                 |
| `AUTH_GITLAB_SECRET`      | No                   | GitLab Secret                                                                                                                                                                                                                                      | Any string       |                                                 |
| `AUTH_GITLAB_SCOPE`       | No                   | GitLab Scope                                                                                                                                                                                                                                       | Any string       | `read_user`                                     |
| `AUTH_GOOGLE_CLIENT_ID`   | No                   | Google Client ID                                                                                                                                                                                                                                   | Any string       |                                                 |
| `AUTH_GOOGLE_NAME`        | No                   | Google Name                                                                                                                                                                                                                                        | Any string       |                                                 |
| `AUTH_GOOGLE_SECRET`      | No                   | Google Secret                                                                                                                                                                                                                                      | Any string       |                                                 |
| `AUTH_GOOGLE_SCOPE`       | No                   | Google Scope                                                                                                                                                                                                                                       | Any string       | `openid email profile offline_access`           |
| `AUTH_KEYCLOAK_CLIENT_ID` | No                   | Keycloak Client ID                                                                                                                                                                                                                                 | Any string       |                                                 |
| `AUTH_KEYCLOAK_HOST`      | No                   | Keycloak Host                                                                                                                                                                                                                                      | Any string       |                                                 |
| `AUTH_KEYCLOAK_NAME`      | No                   | Keycloak Name                                                                                                                                                                                                                                      | Any string       |                                                 |
| `AUTH_KEYCLOAK_SECRET`    | No                   | Keycloak Secret                                                                                                                                                                                                                                    | Any string       |                                                 |
| `AUTH_KEYCLOAK_SCOPE`     | No                   | Keycloak Scope                                                                                                                                                                                                                                     | Any string       | `openid email profile offline_access`           |
| `AUTH_PING_ID_CLIENT_ID`  | No                   | PingID Client ID                                                                                                                                                                                                                                   | Any string       |                                                 |
| `AUTH_PING_ID_HOST`       | No                   | PingID Host                                                                                                                                                                                                                                        | Any string       |                                                 |
| `AUTH_PING_ID_NAME`       | No                   | PingID Name                                                                                                                                                                                                                                        | Any string       |                                                 |
| `AUTH_PING_ID_SECRET`     | No                   | PingID Secret                                                                                                                                                                                                                                      | Any string       |                                                 |
| `AUTH_PING_ID_SCOPE`      | No                   | PingID Scope                                                                                                                                                                                                                                       | Any string       | `offline_access`                                |
| `AUTH_COGNITO_CLIENT_ID`  | No                   | Cognito Client ID                                                                                                                                                                                                                                  | Any string       |                                                 |
| `AUTH_COGNITO_HOST`       | No                   | Cognito Host                                                                                                                                                                                                                                       | Any string       |                                                 |
| `AUTH_COGNITO_NAME`       | No                   | Cognito Name                                                                                                                                                                                                                                       | Any string       |                                                 |
| `AUTH_COGNITO_SECRET`     | No                   | Cognito Secret                                                                                                                                                                                                                                     | Any string       |                                                 |
| `AUTH_COGNITO_SCOPE`      | No                   | Cognito Scope                                                                                                                                                                                                                                      | Any string       | `openid email profile`                          |
| `AUTH_OKTA_CLIENT_ID`     | No                   | Okta Client ID                                                                                                                                                                                                                                     | Any string       |                                                 |
| `AUTH_OKTA_CLIENT_SECRET` | No                   | Okta Client Secret                                                                                                                                                                                                                                 | Any string       |                                                 |
| `AUTH_OKTA_ISSUER`        | No                   | Okta domain issuer                                                                                                                                                                                                                                 | Any string       |                                                 |
| `AUTH_OKTA_SCOPE`         | No                   | Okta Scope                                                                                                                                                                                                                                         | Any string       | `openid email profile`                          |

_NOTE: to being able to test the app in unauthenticated mode just not set any of auth providers variables_
