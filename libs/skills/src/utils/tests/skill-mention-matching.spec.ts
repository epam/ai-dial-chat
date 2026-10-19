import type { RequestSkill } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  findSkillMentionsInText,
  matchSkillMentions,
} from '../skill-mention-matching';

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

describe('findSkillMentionsInText', () => {
  const report = { url: 'skills/bucket/report', name: 'report' };
  const weekly = { url: 'skills/bucket/weekly', name: 'Weekly' };
  const weeklyReport = { url: 'skills/bucket/wr', name: 'Weekly report' };

  it('returns an anchor for every run that names a listed skill', () => {
    expect(
      findSkillMentionsInText('Run /report, then /report again', [report]),
    ).toEqual([{ url: report.url, name: 'report', start: 18, length: 7 }]);
    expect(findSkillMentionsInText('/report\n/report', [report])).toEqual([
      { url: report.url, name: 'report', start: 0, length: 7 },
      { url: report.url, name: 'report', start: 8, length: 7 },
    ]);
  });

  it('ignores a slash that does not start a run or a name that runs on', () => {
    expect(
      findSkillMentionsInText('see https://x/report and /reports or a/report', [
        report,
      ]),
    ).toEqual([]);
  });

  it('prefers the longest name when one name prefixes another', () => {
    expect(
      findSkillMentionsInText('/Weekly report now', [weekly, weeklyReport]),
    ).toEqual([
      { url: weeklyReport.url, name: 'Weekly report', start: 0, length: 14 },
    ]);
  });

  it('resolves a shared name to the first listed skill', () => {
    const publicReport = { url: 'skills/public/report', name: 'report' };

    expect(findSkillMentionsInText('/report', [report, publicReport])).toEqual([
      { url: report.url, name: 'report', start: 0, length: 7 },
    ]);
  });

  it('returns nothing for unknown names', () => {
    expect(findSkillMentionsInText('/unknown text', [report])).toEqual([]);
  });
});
