import type { SkillMetadataItemDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import { findSkillByUrl } from '../skill-lookup';

const skill = (url: string, name = 'skill'): SkillMetadataItemDto =>
  ({ url, name }) as SkillMetadataItemDto;

describe('findSkillByUrl', () => {
  it('searches the personal, shared and organisation listings', () => {
    const shared = skill('skills/other/shared');
    const organisation = skill('skills/public/org');

    expect(
      findSkillByUrl(
        { skills: [], sharedWithMe: [shared], publicSkills: [organisation] },
        'skills/public/org',
      ),
    ).toBe(organisation);
    expect(
      findSkillByUrl({ skills: [], sharedWithMe: [shared] }, shared.url),
    ).toBe(shared);
  });

  it('matches a decoded url against the percent-encoded listing url', () => {
    const encoded = skill('skills/bucket/My%20Skill');

    expect(
      findSkillByUrl({ skills: [encoded] }, 'skills/bucket/My Skill'),
    ).toBe(encoded);
  });

  it('returns undefined when no listing holds the url', () => {
    expect(
      findSkillByUrl({ skills: [skill('skills/bucket/a')] }, 'skills/bucket/b'),
    ).toBeUndefined();
  });
});
