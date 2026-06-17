// =============================================================================
// SDLC SMOKE-TEST FIXTURE — INTENTIONALLY INSECURE. DO NOT MERGE.
// Purpose: give the `code-review` and `security-review` agents real findings to
// surface on a PR into `sdlc-test-base`. Lives outside apps/ and libs/ so Nx
// does not compile it. Delete this file (and close the PR) after validating.
// =============================================================================

import type { Request } from 'express';

// Planted issue 1 — hard-coded secret (secret-leak / Impl-SB).
const API_KEY = 'sk-live-9f8e7d6c5b4a3f2e1d0c9b8a7654321';

// Planted issue 2 — SQL injection: untrusted input concatenated into a query.
export function getUserById(req: Request, db: { query: (sql: string) => unknown }) {
  const id = req.query.id;
  return db.query('SELECT * FROM users WHERE id = ' + id);
}

// Planted issue 3 — code injection: eval over attacker-controlled input.
export function evaluate(req: Request) {
  const expr = req.query.expr as string;
  // eslint-disable-next-line no-eval
  return eval(expr);
}

// Planted issue 4 — reflected XSS: untrusted input written into an HTML response
// with no escaping.
export function renderGreeting(req: Request, res: { send: (html: string) => void }) {
  const name = req.query.name;
  res.send(`<h1>Hello ${name}</h1>`);
}

// Planted issue 5 — missing authz + secret in log (Verif-SR / Impl-DM).
export function adminAction(req: Request) {
  console.log('admin action invoked with key', API_KEY);
  return { ok: true }; // no authentication / authorization check
}
