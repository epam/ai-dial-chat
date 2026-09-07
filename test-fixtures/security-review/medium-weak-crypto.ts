// TEST_ONLY — DO NOT MERGE.
// This file intentionally contains a security vulnerability for validating
// the automated security review workflow. The branch this lives on
// (test/security-review-workflow) must never be merged into any deployable
// branch.

import { createHash } from 'crypto';

export const hashPassword = (password: string): string =>
  createHash('md5').update(password).digest('hex');

export const verifyPassword = (password: string, hash: string): boolean =>
  hashPassword(password) === hash;