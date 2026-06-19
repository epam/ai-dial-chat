# Chat API Postman collection

Import `chat-api.postman_collection.json` into Postman and start the backend at
`http://localhost:3005`.

The collection uses Postman's cookie jar for the authenticated session. Start
the OIDC flow from the `auth` folder, then run **Get current user**. The
collection automatically stores the returned `X-CSRF-Token` and sends it with
authenticated write requests together with the configured `origin`.

Regenerate the collection from the checked-in OpenAPI document:

```bash
npm run postman
```

Refresh OpenAPI first and then regenerate:

```bash
npm run postman:refresh
```
