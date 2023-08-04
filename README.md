# FORKED REPOSITORY

This repository was forked from github.com/mckaywrigley/chatbot-ui.git . The code was scanned by Snyk (no major vulnerabilities) - and, later, [with OpenAI](./testme.ipynb) - and we didn't see data flowing anywhere but OpenAI API).
It's forked and "frozen" to minimize the risk. In future we will, hopefully, have someone responsible for this project - but as of now we want to provide the service ASAP.

# Chatbot UI

Chatbot UI is an open source chat UI for AI models.

See a [demo](https://twitter.com/mckaywrigley/status/1640380021423603713?s=46&t=AowqkodyK6B4JccSOxSPew).

![Chatbot UI](./public/screenshots/screenshot-0402023.jpg)

## Updates

Chatbot UI will be updated over time.

Expect frequent improvements.

**Next up:**

- [ ] Sharing
- [ ] "Bots"

## Deploy

**Vercel**

Host your own live version of Chatbot UI with Vercel.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmckaywrigley%2Fchatbot-ui)

**Docker**

Build locally:

```shell
docker build -t chatgpt-ui .
docker run -e OPENAI_API_KEY=xxxxxxxx -e AUTH_AZURE_AD_CLIENT_ID=xxxxxxxx -e AUTH_AZURE_AD_TENANT_ID=xxxxxxxx -e AUTH_AZURE_AD_SECRET=xxxxxxxx -e NEXTAUTH_SECRET=xxxxxxxx -p 3000:3000 chatgpt-ui
```

Pull from ghcr:

```
docker run -e OPENAI_API_KEY=xxxxxxxx -p 3000:3000 ghcr.io/mckaywrigley/chatbot-ui:main
```

## Running Locally

**1. Clone Repo**

```bash
git clone https://github.com/mckaywrigley/chatbot-ui.git
```

**2. Install Dependencies**

```bash
npm i
```

**3. Provide OpenAI API Key**

Create a .env.local file in the root of the repo with your OpenAI API Key:

```bash
OPENAI_API_KEY=YOUR_KEY
```

> You can set `OPENAI_API_HOST` where access to the official OpenAI host is restricted or unavailable, allowing users to configure an alternative host for their specific needs.

> Additionally, if you have multiple OpenAI Organizations, you can set `OPENAI_ORGANIZATION` to specify one.

**4. Configure SSO for Auth0**

Add variables .env.local:

```bash
AUTH_AUTH0_CLIENT_ID="QXHosbmuKaegHNn9MMSAKUhRNb6JXvNp"
AUTH_AUTH0_SECRET="N-uPvuwXXluEkIT69E2RvEYxA7lHoUh4zMtjPzlGlJDCNdPzJhMTBjknGcSY9WGl"
AUTH_AUTH0_HOST="https://chatbot-ui-staging.eu.auth0.com"
NEXTAUTH_SECRET=xxxxx
```

where `NEXTAUTH_SECRET` is random string (`openssl rand -base64 32`)

**5. Run App**

```bash
npm run dev
```

**6. Use It**

You should be able to start chatting.

## Configuration

When deploying the application, the following environment variables can be set:

| Environment Variable            | Default value                                       | Description                                                       |
| ------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| AUTH_AZURE_AD_CLIENT_ID         |                                                     | Client ID from Azure AD                                           |
| AUTH_AZURE_AD_TENANT_ID         |                                                     | Tenant ID from Azure AD                                           |
| AUTH_AZURE_AD_SECRET            |                                                     | Client Secret from Azure AD                                       |
| NEXTAUTH_SECRET                 |                                                     | Random crypto-string                                              |
| OPENAI_API_KEY                  |                                                     | The default API key used for authentication with OpenAI           |
| OPENAI_API_HOST                 | `https://api.openai.com`                            | The base url, for Azure use `https://<endpoint>.openai.azure.com` |
| OPENAI_API_TYPE                 | `openai`                                            | The API type, options are `openai` or `azure`                     |
| OPENAI_API_VERSION              | `2023-03-15-preview`                                | Only applicable for Azure OpenAI                                  |
| OPENAI_ORGANIZATION             |                                                     | Your OpenAI organization ID                                       |
| DEFAULT_MODEL                   | `gpt-3.5-turbo` _(OpenAI)_ `gpt-35-turbo` _(Azure)_ | The default model to use on new conversations                     |
| NEXT_PUBLIC_DEFAULT_TEMPERATURE | 1                                                   | The default temperature to use on new conversations               |
| GOOGLE_API_KEY                  |                                                     | See [Custom Search JSON API documentation][GCSE]                  |
| GOOGLE_CSE_ID                   |                                                     | See [Custom Search JSON API documentation][GCSE]                  |

If you do not provide an OpenAI API key with `OPENAI_API_KEY`, users will have to provide their own key.

If you don't have an OpenAI API key, you can get one [here](https://platform.openai.com/account/api-keys).

## Contact

If you have any questions, feel free to reach out to Mckay on [Twitter](https://twitter.com/mckaywrigley).

[GCSE]: https://developers.google.com/custom-search/v1/overview
