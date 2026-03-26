import { z as zodValidation } from 'zod';

// Fix for the CSP eval error from Zod. Issue in Zod repository https://github.com/colinhacks/zod/issues/4461
// Config with jitless: true disables the generation of dynamic code and allows Zod to work in environments with strict Content Security Policies (CSP) that disallow eval and new Function().
// MUST be set before any schema is defined or imported, otherwise it will not work.
// Zod should be imported from this file, not directly from 'zod', otherwise the CSP error will appear in the console when using Zod schemas.
zodValidation.config({ jitless: true });

export { zodValidation };
