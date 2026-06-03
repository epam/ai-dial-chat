---
name: dial-api-patterns
description: Reference for writing ai-dial-chat Next.js API routes - session validation with next-auth, the validate-session/validate-input/proxy pattern, streaming responses from DIAL Core, error handling, and status-code conventions. Use when creating or editing any handler under apps/chat/src/pages/api/.
metadata:
  author: ai-dial-chat
  version: "1.0"
---

The full API patterns guide lives at `.claude/guides/api-patterns.md`. Read it for the complete reference, then apply the patterns below.

## When this applies

- Creating or editing any route under `apps/chat/src/pages/api/`
- Working with session validation, streaming, or proxying to DIAL Core

## Endpoint pattern

Every route follows: **validate session → validate input → proxy to DIAL Core**.

```typescript
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) return; // validateServerSession already sent the response

  const { id, model } = req.body as ChatBody;
  try {
    if (!id || !model) return res.status(400).send(errorsMessages[400]);
    // ... business logic + proxy to DIAL Core
    res.status(200).json(result);
  } catch (error) {
    return chatErrorHandler({ error, res, msg: 'Error description' });
  }
};

export default handler;
```

## Rules

- **Always** call `validateServerSession` as the first line — never skip it (security).
- Validate input **before** business logic; return `400` on bad input.
- Use `try/catch` with `chatErrorHandler({ error, res, msg })`.
- Single named `handler`, exported as `export default handler`.
- Never read `process.env` from client code — only in `utils/server/` or API routes.
- For streaming (`/api/chat`): set `Transfer-Encoding: chunked`, `Content-Type: application/octet-stream`, and cancel the reader on `res.on('close', ...)`.

## Key locations

- Session validation: `apps/chat/src/utils/auth/session.ts`
- Auth options: `apps/chat/src/utils/auth/auth-options.ts`
- Error messages: `apps/chat/src/constants/errors.ts`
- Error handler / stream util: `apps/chat/src/utils/server/`

See `.claude/guides/api-patterns.md` for the proxy table, status codes, and anti-patterns.
