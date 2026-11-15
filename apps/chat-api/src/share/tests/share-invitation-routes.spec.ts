import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getInvitationRoutePath } from '../utils/share-resource.util';

/*
 * chat-api cannot import the SPA's route enum across the Nx module boundary,
 * so the share-link prefixes in `share-resource.util.ts` are duplicated
 * literals. This spec reads `apps/chat/src/types/routes.ts` as text and fails
 * when either side changes alone, instead of the share link breaking silently.
 */
const FRONTEND_ROUTES_PATH = join(
  __dirname,
  '../../../../chat/src/types/routes.ts',
);

const INVITATION_ROUTES = [
  { member: 'SharedInvitation', sampleItemId: 'applications/bucket/app' },
  {
    member: 'ConversationSharedInvitation',
    sampleItemId: 'conversations/bucket/conversation',
  },
  {
    member: 'ProjectSharedInvitation',
    sampleItemId: 'projects/bucket/project',
  },
];

const readFrontendRoute = (source: string, member: string): string | null =>
  source.match(new RegExp(`^\\s*${member} = '([^']+)',`, 'm'))?.[1] ?? null;

describe('share-invitation routes match the frontend router', () => {
  it('finds the frontend route enum', () => {
    expect(existsSync(FRONTEND_ROUTES_PATH), FRONTEND_ROUTES_PATH).toBe(true);
  });

  it.each(INVITATION_ROUTES)(
    'ROUTES.$member equals the backend invitation route',
    ({ member, sampleItemId }) => {
      const source = readFileSync(FRONTEND_ROUTES_PATH, 'utf8');

      expect(readFrontendRoute(source, member), `ROUTES.${member}`).toBe(
        `${getInvitationRoutePath(sampleItemId)}/:invitationId`,
      );
    },
  );
});
