/** Required manifest filename, matching the BFF's exact, case-sensitive check. */
export const SKILL_MANIFEST_FILE = 'SKILL.md';

/**
 * `accept` tokens for the skill upload drop zone. The BFF dispatches on the
 * uploaded filename — a ZIP archive, or a file named exactly `SKILL.md` — so
 * these are the only two extensions it can take.
 */
export const SKILL_ARCHIVE_ACCEPT = '.zip,.md';
