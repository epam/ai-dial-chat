import { describe, expect, it } from 'vitest';
import { isDialResourceId } from './dial-resource-id.validator';

describe('isDialResourceId', () => {
  it.each([
    'conversations/bucket/anthropic.claude-haiku-4-5-20251001-v1:0__hi__ace3d220-6bf9-4774-afe7-9d641a3de401',
    'applications/bucket/my-app',
    'toolsets/bucket/search__0.0.1',
    'skills/bucket/team-a/docs-helper',
    'prompts/bucket/My folder/My prompt, v2',
    'prompts/bucket/New%20folder%201/Prompt%201',
    'conversations/bucket/applications/catalog/Team%2FApp%20One__0.0.1__hello',
    'conversations/bucket/gpt-4o__Wait.. what__x',
    'conversations/bucket/gpt-4o__a;b,c=d&e@f+g$h!i__x',
    "conversations/bucket/gpt-4o__it's (ok) *__x",
    'conversations/bucket/gpt-4o__Привет 你好__x',
    'gpt-4o',
    'conversations/bucket/caf%C3%A9__x',
    'conversations/bucket/chat%FF__x',
    'conversations/bucket/%252e%252e__x',
  ])('accepts the resource id %s', (value) => {
    expect(isDialResourceId(value)).toBe(true);
  });

  it.each([
    '',
    '/applications/bucket/app',
    'applications/bucket//app',
    'applications/bucket/app/',
    'applications/bucket/../other/app',
    'applications/bucket/./app',
    'applications/bucket/%2e%2e/other',
    'applications/bucket/%2E%2E/other',
    'applications/bucket/..%2Fother',
    '..%2Fapplications/bucket/app',
    String.raw`applications\bucket\app`,
    'applications/bucket/a%5Cb',
    'applications/bucket/a{b',
    'applications/bucket/a}b',
    'applications/bucket/a%7Bb',
    'applications/bucket/a"b',
    'applications/bucket/a%22b',
    'applications/bucket/a?b',
    'applications/bucket/a#b',
    'applications/bucket/a\nb',
    'applications/bucket/a\u0000b',
    'applications/bucket/a%0Ab',
    'applications/bucket/a%00b',
    'conversations/bucket/chat%zz',
    'conversations/bucket/100%',
    'applications/bucket/%FF%7Bx',
    'applications/bucket/%FF%0Ax',
    'applications/bucket/..%2F%FF',
    'applications/bucket/%FF/..',
  ])('rejects the resource id %j', (value) => {
    expect(isDialResourceId(value)).toBe(false);
  });

  it.each([null, undefined, 42, {}, ['applications/bucket/app']])(
    'rejects the non-string value %j',
    (value) => {
      expect(isDialResourceId(value)).toBe(false);
    },
  );
});
