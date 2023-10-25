# DIAL Chat

This is a default UI for [AI DIAL](https://epam-rail.com). AI DIAL can be used as headless system, but UI is recommended to learn the capability.

Originally forked from [chatbot-ui](https://github.com/mckaywrigley/chatbot-ui) and then completely reworked and published under [apache 2.0 license](./LICENSE), while code taken from original repository is still subject to [original MIT license](./license-original). Due to rework we introduced lots of new features such as varios IDP support, model side-by-side compare, [DIAL extensions](https://epam-rail.com/extension-framework) support, conversation replays, branding and many more.

![ai-dial-chat](./docs/ai-dial-chat.png)

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

This project leverages environment variables for configuration:

| Variable                          | Description                                                                                                                          | Default Value                                                                                                                                                                                                                    | Required                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| OPENAI_API_HOST                   | OpenAI API Host                                                                                                                      |                                                                                                                                                                                                                                  | true                             |
| OPENAI_API_KEY                    | OpenAI API Key                                                                                                                       |                                                                                                                                                                                                                                  | true                             |
| OPENAI_API_VERSION                | OpenAI API Version                                                                                                                   | 2023-03-15-preview                                                                                                                                                                                                               | true                             |
| APP_BASE_PATH                     | Application base path                                                                                                                |                                                                                                                                                                                                                                  |                                  |
| APP_BASE_ORIGIN                   | Application base origin                                                                                                              |                                                                                                                                                                                                                                  | true(if APP_BASE_PATH presented) |
| ALLOWED_IFRAME_ORIGINS            | Allowed iFrame Origins                                                                                                               |                                                                                                                                                                                                                                  |                                  |
| IS_IFRAME                         | Is iFrame                                                                                                                            | false                                                                                                                                                                                                                            |                                  |
| ENABLED_FEATURES                  | Enabled Features                                                                                                                     | conversations-section,prompts-section,top-settings,top-clear-conversation,top-chat-info,top-chat-model-settings,empty-chat-settings,header,footer,request-api-key,report-an-issue,likes                                          |                                  |
| NEXT_PUBLIC_APP_NAME              | Public Application Name                                                                                                              | Local Development APP Name                                                                                                                                                                                                       |                                  |
| NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT | Public Default System Prompt                                                                                                         |                                                                                                                                                                                                                                  |                                  |
| NEXT_PUBLIC_DEFAULT_TEMPERATURE   | Public Default Temperature                                                                                                           | 1                                                                                                                                                                                                                                |                                  |
| DEFAULT_MODEL                     | Default Model                                                                                                                        | gpt-35-turbo                                                                                                                                                                                                                     |                                  |
| DEFAULT_ASSISTANT_SUB_MODEL       | Default Assistant Sub Model                                                                                                          | gpt-4                                                                                                                                                                                                                            |                                  |
| RECENT_MODELS_IDS                 | A list of IDs for recently used AI models.                                                                                           | gpt-35-turbo,gpt-4,epam10k-semantic-search,gpt-world,mirror                                                                                                                                                                      |                                  |
| RECENT_ADDONS_IDS                 | A list of IDs for recently used AI model addons.                                                                                     | addon-epam10k-golden-qna,addon-epam10k-semantic-search,addon-wolfram                                                                                                                                                             |                                  |
| E2E_HOST                          | The host URL for end-to-end testing. More info in E2E tests documentation                                                            | http://localhost:3000                                                                                                                                                                                                            |                                  |
| PREVIEW_TEST_TOKEN                | A test token for e2e authentification. More info in E2E tests documentation                                                          | TEST                                                                                                                                                                                                                             |                                  |
| TRACES_URL                        | Traces URL                                                                                                                           |                                                                                                                                                                                                                                  |                                  |
| TMS_URL                           | TMS URL                                                                                                                              |                                                                                                                                                                                                                                  |                                  |
| ISSUE_URL                         | Issue URL                                                                                                                            |                                                                                                                                                                                                                                  |                                  |
| THEMES_CONFIG_HOST                | The host URL for custom themes configuration. Models images is located in this host. More info in Themes configuration documentation |                                                                                                                                                                                                                                  |                                  |
| FOOTER_HTML_MESSAGE               | Footer HTML Message                                                                                                                  | For API access please fill&nbsp;<a href="#requestApiKey"><u><strong>this form</strong></u></a>.&nbsp;If you have a problem please&nbsp;<a href="#reportAnIssue"><u><strong>report an issue</strong></u></a>. Version %%VERSION%% |                                  |
| AZURE_FUNCTIONS_API_HOST          | Azure Functions API Host                                                                                                             |                                                                                                                                                                                                                                  |                                  |
| REPORT_ISSUE_CODE                 | Report Issue Code                                                                                                                    |                                                                                                                                                                                                                                  |                                  |
| REQUEST_API_KEY_CODE              | Request API Key Code                                                                                                                 |                                                                                                                                                                                                                                  |                                  |
| CODE_GENERATION_WARNING           | Warning text regarding code generation                                                                                               | Full responsibility for code correctness, security and licensing lies solely with the user, not with DIAL platform or LLM vendor.                                                                                                |                                  |

The .env file contains environment variables that can be used to configure your app's settings and behavior. These values can be changed as needed to suit your specific requirements.

Also we have a lot of auth specific env variables:

| Variable                | Description                                 | Default Value | Required                                     |
| ----------------------- | ------------------------------------------- | ------------- | -------------------------------------------- |
| AUTH_DISABLED           | A flag to enable or disable authentication. | false         |                                              |
| NEXTAUTH_URL            | NextAuth URL                                |               | true (for production)                        |
| NEXTAUTH_SECRET         | NextAuth Secret                             |               | true (generate by `openssl rand -base64 32`) |
| AUTH_TEST_TOKEN         | Test Token                                  | TEST          |                                              |
| AUTH_AUTH0_AUDIENCE     | Auth0 Audience                              | chat          |                                              |
| AUTH_AUTH0_CLIENT_ID    | Auth0 Client ID                             |               |                                              |
| AUTH_AUTH0_HOST         | Auth0 Host                                  |               |                                              |
| AUTH_AUTH0_NAME         | Auth0 Name                                  |               |                                              |
| AUTH_AUTH0_SECRET       | Auth0 Secret                                |               |                                              |
| AUTH_AZURE_AD_CLIENT_ID | Azure AD Client ID                          |               |                                              |
| AUTH_AZURE_AD_NAME      | Azure AD Name                               |               |                                              |
| AUTH_AZURE_AD_SECRET    | Azure AD Secret                             |               |                                              |
| AUTH_AZURE_AD_TENANT_ID | Azure AD Tenant ID                          |               |                                              |
| AUTH_GITLAB_CLIENT_ID   | GitLab Client ID                            |               |                                              |
| AUTH_GITLAB_HOST        | GitLab Host                                 |               |                                              |
| AUTH_GITLAB_NAME        | GitLab Name                                 |               |                                              |
| AUTH_GITLAB_SECRET      | GitLab Secret                               |               |                                              |
| AUTH_GOOGLE_CLIENT_ID   | Google Client ID                            |               |                                              |
| AUTH_GOOGLE_NAME        | Google Name                                 |               |                                              |
| AUTH_GOOGLE_SECRET      | Google Secret                               |               |                                              |
| AUTH_KEYCLOAK_CLIENT_ID | Keycloak Client ID                          |               |                                              |
| AUTH_KEYCLOAK_HOST      | Keycloak Host                               |               |                                              |
| AUTH_KEYCLOAK_NAME      | Keycloak Name                               |               |                                              |
| AUTH_KEYCLOAK_SECRET    | Keycloak Secret                             |               |                                              |
| AUTH_PING_ID_CLIENT_ID  | PingID Client ID                            |               |                                              |
| AUTH_PING_ID_HOST       | PingID Host                                 |               |                                              |
| AUTH_PING_ID_NAME       | PingID Name                                 |               |                                              |
| AUTH_PING_ID_SECRET     | PingID Secret                               |               |                                              |
