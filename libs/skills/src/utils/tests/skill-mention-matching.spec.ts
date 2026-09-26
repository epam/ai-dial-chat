import type { RequestSkill } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { matchSkillMentions } from '../skill-mention-matching';

const skill = (url: string): RequestSkill => ({ url });

const resolveName = (url: string): string => url.split('/').pop() ?? url;

describe('matchSkillMentions', () => {
  it('matches a single mention', () => {
    const result = matchSkillMentions(
      '/summarize please do this',
      [skill('skills/bucket/summarize')],
      resolveName,
    );

    expect(result).toEqual([{ skillIndex: 0, start: 0, length: 10 }]);
  });

  it('matches multiple mentions left to right', () => {
    const result = matchSkillMentions(
      '/abc please summarize, then run /csd on the result',
      [skill('skills/bucket/abc'), skill('skills/bucket/csd')],
      resolveName,
    );

    expect(result).toEqual([
      { skillIndex: 0, start: 0, length: 4 },
      { skillIndex: 1, start: 32, length: 4 },
    ]);
  });

  it('consumes same-name-different-url pairs left to right into distinct occurrences', () => {
    const result = matchSkillMentions(
      '/code-review first /code-review second',
      [skill('skills/bucket/code-review'), skill('skills/mine/code-review')],
      resolveName,
    );

    expect(result).toEqual([
      { skillIndex: 0, start: 0, length: 12 },
      { skillIndex: 1, start: 19, length: 12 },
    ]);
  });

  it('omits an entry with no locatable text, still matching later entries', () => {
    const result = matchSkillMentions(
      'no mention here, but /csd later',
      [skill('skills/bucket/abc'), skill('skills/bucket/csd')],
      resolveName,
    );

    expect(result).toEqual([{ skillIndex: 1, start: 21, length: 4 }]);
  });

  it('rejects a name that is a prefix of a longer word', () => {
    const result = matchSkillMentions(
      '/summarizer is not the same as /summarize',
      [skill('skills/bucket/summarize')],
      resolveName,
    );

    expect(result).toEqual([{ skillIndex: 0, start: 31, length: 10 }]);
  });

  it('returns an empty array for text with no skills', () => {
    expect(matchSkillMentions('plain text', [], resolveName)).toEqual([]);
  });

  it('accepts a mention immediately followed by another slash', () => {
    const result = matchSkillMentions(
      '/abc/csd',
      [skill('skills/bucket/abc'), skill('skills/bucket/csd')],
      resolveName,
    );

    expect(result).toEqual([
      { skillIndex: 0, start: 0, length: 4 },
      { skillIndex: 1, start: 4, length: 4 },
    ]);
  });
});
