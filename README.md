# DIAL Chat

This is an example README file for a Next.js project. Make sure to edit this template with your project's relevant information.

## Overview

This project is a web application built using [Next.js](https://nextjs.org/), a React framework with server-rendering capabilities. It can be easily customized and adapted to your needs by following the steps mentioned below.

## Developer Environment

Before diving into the development environment, you should have Node.js (version >=14.6.0) and npm (version >=6.14.6) installed on your system. If you don't already have them, follow the instructions [here](https://nodejs.org/en/download/).

Once you've installed Node.js and npm, follow these steps to set up your developer environment:

1. Clone the repository:

```
git clone https://gitlab.deltixhub.com/Deltix/openai-apps/chatbot-ui
```

2. Navigate to the project directory:

```
cd chatbot-ui
```

3. Install project dependencies:

```bash
npm install
```

4. To start the development server, run:

```
npm run dev
```

## Build

To create an optimized build of your application, run the following command:

```
npm run build
```

After running the command, you'll see a `.next` folder created in your project directory which contains the optimized output.

## Run

To start the development server, run:

```
npm run dev
```

Once the server is up and running, open `http://localhost:3000` in your browser to view your application.

To run the optimized production build, first build the app and then run:

```
npm start
```

This will start a production server on the default port 3000.

## Test

To run the unit tests suite for your application, execute the following command:

```
npm test
```

To run the e2e tests run the following command:

```
npm run test:e2e
```

For more infor check [E2E tests documentation](e2e/README.md)

## Environment Variables

This project leverages environment variables for configuration. You should create a `.env.local` file in the root directory of your project with the following format:

| Variable                          | EXAMPLE VALUE                                                        | Description                                                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NEXTAUTH_SECRET                   | `Generate Random Secret - openssl rand -base64 32`                   | The secret for Next.js authentication.                                                                                                                              |
| OPENAI_API_HOST                   | `TODO: update host example value`                                    | The endpoint for making API requests to the AI model host.                                                                                                          |
| DEFAULT_MODEL                     | gpt-35-turbo                                                         | The default AI model to use for text generation.                                                                                                                    |
| DEFAULT_ASSISTANT_SUB_MODEL       | gpt-4                                                                | The default sub-model for the AI assistant.                                                                                                                         |
| OPENAI_API_VERSION                | 2023-03-15-preview                                                   | The version of the AI service provider's API.                                                                                                                       |
| OPENAI_API_KEY                    | `TODO: Update api key example value`                                 | The API key needed for authentication to the AI service provider.                                                                                                   |
| NEXT_PUBLIC_DEFAULT_SYSTEM_PROMPT |                                                                      | The default system prompt used in the app.                                                                                                                          |
| NEXT_PUBLIC_APP_NAME              | AI Chat Configurable name                                            | The configurable name of the app.                                                                                                                                   |
| USE_USER_JOB_TITLE                | false                                                                | A flag to enable or disable the usage of user job title in the app.                                                                                                 |
| ENABLED_FEATURES                  |                                                                      | A list of enabled features in the app. All available features can be found in src/types/features.ts                                                                 |
| FOOTER_HTML_MESSAGE               |                                                                      | A custom HTML message displayed in the footer.                                                                                                                      |
| THEMES_CONFIG_HOST                |                                                                      | The host URL for custom themes configuration. Models images is located in this host. More info in [Themes configuration documentation](docs/THEME-CUSTOMIZATION.md) |
| AUTH_DISABLED                     | false                                                                | A flag to enable or disable authentication.                                                                                                                         |
| RECENT_MODELS_IDS                 | gpt-35-turbo,gpt-4,epam10k-semantic-search,gpt-world,mirror          | A list of IDs for recently used AI models.                                                                                                                          |
| RECENT_ADDONS_IDS                 | addon-epam10k-golden-qna,addon-epam10k-semantic-search,addon-wolfram | A list of IDs for recently used AI model addons.                                                                                                                    |
| AUTH_TEST_TOKEN                   | `For local use any value`                                            | A test token for e2e authentification. More info in [E2E tests documentation](e2e/README.md)                                                                        |
| PREVIEW_TEST_TOKEN                | `For local use same value as in PREVIEW_TEST_TOKEN `                 | A test token for e2e authentification. More info in [E2E tests documentation](e2e/README.md)                                                                        |
| E2E_HOST                          | http://localhost:3000                                                | The host URL for end-to-end testing. More info in [E2E tests documentation](e2e/README.md)                                                                          |

The .env file contains environment variables that can be used to configure your app's settings and behavior. These values can be changed as needed to suit your specific requirements.

Also we have a lot of auth provider specific env variables:

| Variable                | Description                                       |
| ----------------------- | ------------------------------------------------- |
| AUTH_AZURE_AD_CLIENT_ID | The Azure AD client ID for authentication.        |
| AUTH_AZURE_AD_SECRET    | The Azure AD client secret for authentication.    |
| AUTH_AZURE_AD_TENANT_ID | The Azure AD tenant ID for authentication.        |
| AUTH_AZURE_AD_NAME      | The Azure AD app display name for authentication. |
| AUTH_GITLAB_CLIENT_ID   | The GitLab client ID for authentication.          |
| AUTH_GITLAB_SECRET      | The GitLab client secret for authentication.      |
| AUTH_GITLAB_NAME        | The GitLab app display name for authentication.   |
| AUTH_GITLAB_HOST        | The GitLab host URL for authentication.           |
| AUTH_GOOGLE_CLIENT_ID   | The Google client ID for authentication.          |
| AUTH_GOOGLE_SECRET      | The Google client secret for authentication.      |
| AUTH_GOOGLE_NAME        | The Google app display name for authentication.   |
| AUTH_AUTH0_CLIENT_ID    | The Auth0 client ID for authentication.           |
| AUTH_AUTH0_SECRET       | The Auth0 client secret for authentication.       |
| AUTH_AUTH0_NAME         | The Auth0 app display name for authentication.    |
| AUTH_AUTH0_HOST         | The Auth0 host URL for authentication.            |
| AUTH_AUTH0_AUDIENCE     | The Auth0 audience for authentication.            |
| AUTH_PING_ID_CLIENT_ID  | The Ping ID client ID for authentication.         |
| AUTH_PING_ID_SECRET     | The Ping ID client secret for authentication.     |
| AUTH_PING_ID_NAME       | The Ping ID app display name for authentication.  |
| AUTH_PING_ID_HOST       | The Ping ID host URL for authentication.          |
| AUTH_KEYCLOAK_CLIENT_ID | The Keycloak client ID for authentication.        |
| AUTH_KEYCLOAK_SECRET    | The Keycloak client secret for authentication.    |
| AUTH_KEYCLOAK_NAME      | The Keycloak app display name for authentication. |
| AUTH_KEYCLOAK_HOST      | The Keycloak host URL for authentication.         |
| AUTH_TEST_TOKEN         | A test token for authentication.                  |
