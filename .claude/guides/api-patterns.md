---
# API Patterns Guide

**Project**: ai-dial-chat
**Stack**: Next.js 16 API Routes, TypeScript, next-auth sessions
**Base URL**: `/api/` (proxies to `DIAL_API_HOST`)

---

## File Structure

| Purpose | Path |
|---------|------|
| API Route handlers | `apps/chat/src/pages/api/**/*.ts` |
| Server utilities | `apps/chat/src/utils/server/` |
| Auth utilities | `apps/chat/src/utils/auth/` |
| Server-side types | `apps/chat/src/types/` |
| API constants | `apps/chat/src/constants/` |

---

## Endpoint Pattern

All API routes follow: **validate session → validate input → proxy to DIAL Core**

```typescript
// Source: apps/chat/src/pages/api/chat.ts:35
const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  const session = await getServerSession(req, res, authOptions);
  const isSessionValid = validateServerSession(session, req, res);
  if (!isSessionValid) {
    return; // validateServerSession handles the response
  }

  const { id, model } = req.body as ChatBody;

  try {
    if (!id || !model) {
      return res.status(400).send(errorsMessages[400]);
    }
    // ... business logic + proxy to DIAL Core
    res.status(200).json(result);
  } catch (error) {
    return chatErrorHandler({ error, res, msg: 'Error description' });
  }
};

export default handler;
```

**To add new endpoint:**
1. Create `apps/chat/src/pages/api/[route].ts`
2. Add `validateServerSession` at the top
3. Add input validation before business logic
4. Use `try/catch` with error handler

---

## Authentication

**Method**: Session-based via `next-auth` (JWT + provider tokens)

```typescript
// Source: apps/chat/src/pages/api/chat.ts:36
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/src/utils/auth/auth-options';
import { validateServerSession } from '@/src/utils/auth/session';

const session = await getServerSession(req, res, authOptions);
const isSessionValid = validateServerSession(session, req, res);
if (!isSessionValid) return; // already sends 401 response
```

**Access user token:** `const token = await getFullToken({ req });` (`utils/server/server.ts`)
**Auth config:** `apps/chat/src/utils/auth/auth-options.ts`

---

## Streaming Response Pattern

The `/api/chat` endpoint streams responses from DIAL Core:

```typescript
// Source: apps/chat/src/pages/api/chat.ts:111
const stream = await OpenAIStream({ model, messages, userJWT: token?.token ?? '' });
res.setHeader('Transfer-Encoding', 'chunked');
res.setHeader('Content-Type', 'application/octet-stream');

const reader = stream.getReader();
res.on('close', () => reader.cancel());

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  res.write(value);
}
res.end();
```

---

## Error Handling

```typescript
// Source: apps/chat/src/utils/server/chat.ts
chatErrorHandler({ error, res, msg: 'Error description', isStreamingError?: boolean });
```

**Standard error responses:**
- `res.status(400).send(errorsMessages[400])` — bad request
- `res.status(401).send(errorsMessages.unauthorized)` — unauthorized
- `res.status(500).json({ errorMessage: '...' })` — server error

**Error constants:** `apps/chat/src/constants/errors.ts`

---

## Proxy Pattern

Most routes proxy directly to DIAL Core. Dynamic catch-all routes:

```typescript
// Source: apps/chat/src/pages/api/[entitytype]/[...slug].ts
// Handles: GET/POST/PUT/DELETE for conversations, prompts, files, etc.
// Pattern: validate session → parse entity type → proxy to DIAL API
```

| Route | Purpose |
|-------|---------|
| `api/chat.ts` | Stream chat completions |
| `api/models.ts` | Fetch available models |
| `api/listing/[...listing].ts` | DIAL storage listing |
| `api/files/upload-archive.ts` | File upload proxy |
| `api/share/create.ts` | Share creation |
| `api/[entitytype]/[...slug].ts` | Generic entity CRUD |

---

## Status Codes

| Operation | Success | Common Errors |
|-----------|---------|---------------|
| Stream | `200 chunked` | `400`, `401`, `500` |
| GET/Read | `200` | `401`, `404` |
| POST/Create | `200` | `400`, `401` |
| DELETE | `200` | `401`, `404` |

---

## Conventions

| Aspect | Convention |
|--------|------------|
| Route naming | `kebab-case` files, catch-all `[...slug].ts` |
| Handler export | `export default handler` (single named `handler`) |
| Async handling | `async/await` with `try/catch` |
| Session check | Always first line in handler |
| Types | Request body typed via `req.body as XxxBody` |

---

## Anti-Patterns

| ❌ Avoid | ✅ Use Instead | Reason |
|----------|----------------|--------|
| Skip session validation | Always call `validateServerSession` | Security |
| Access `process.env` from client code | Only in `utils/server/` or API routes | Leaks secrets |
| Return data before validating input | Validate input before processing | 400 errors |
| Import `utils/server/` in components | Keep server utils server-side only | Build errors |

---

## Quick Reference

| Task | Location |
|------|----------|
| Session validation | `apps/chat/src/utils/auth/session.ts` |
| Auth options | `apps/chat/src/utils/auth/auth-options.ts` |
| Get user token | `apps/chat/src/utils/server/server.ts` |
| Error messages | `apps/chat/src/constants/errors.ts` |
| Stream utility | `apps/chat/src/utils/server/index.ts` (OpenAIStream) |
| Error handler | `apps/chat/src/utils/server/chat.ts` (chatErrorHandler) |

---
