import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ProjectConversationParamDto } from '../conversations/dto/project-conversation-param.dto';
import { ProjectConversationTitlesBodyDto } from '../conversations/dto/project-conversation-titles.dto';

const PROJECT_ID = 'projects/a1b2c3/support-quality';

const validate = (conversationName: unknown, id: unknown = PROJECT_ID) =>
  validateSync(
    plainToInstance(ProjectConversationParamDto, { id, conversationName }),
  );
const validateNames = (names: unknown) =>
  validateSync(plainToInstance(ProjectConversationTitlesBodyDto, { names }));

describe('ProjectConversationParamDto', () => {
  it.each([
    'gpt-4o__Weekly summary__7c1d',
    'gpt-4o__Справка__1',
    'dial-chathub-v2-anthropic.claude-haiku-4-5-20251001-v1:0__hey__243cbd90',
    `dial-chathub-v2-anthropic.claude-haiku-4-5-20251001-v1:0__${'я'.repeat(127)}__243cbd90-00e0-424c-8400-b01b41786e82`,
  ])('accepts %s', (name) => {
    expect(validate(name)).toHaveLength(0);
  });

  it.each([
    ['traversal', '..'],
    ['a path', '../context/tickets.csv'],
    ['a slash', 'a/b'],
    ['a control character', 'a\u0001b'],
    ['a backslash', 'a\\b'],
    ['an empty name', ''],
    ['an over-long name', 'я'.repeat(513)],
    ['a non-string', 42],
  ])('rejects %s', (_label, name) => {
    expect(validate(name)).not.toHaveLength(0);
  });

  it('rejects an invalid project id', () => {
    expect(validate('x', 'projects/a1b2c3/../x')).not.toHaveLength(0);
  });
});

describe('ProjectConversationTitlesBodyDto', () => {
  it.each([
    ['one name', ['gpt-4o__Weekly summary__7c1d']],
    ['100 names', Array.from({ length: 100 }, (_, i) => `gpt-4o__T__${i}`)],
  ])('accepts %s', (_label, names) => {
    expect(validateNames(names)).toHaveLength(0);
  });

  it.each([
    ['no names', []],
    ['101 names', Array.from({ length: 101 }, (_, i) => `gpt-4o__T__${i}`)],
    ['traversal', ['..']],
    ['a path', ['../context/tickets.csv']],
    ['a non-string', [42]],
    ['a non-array', 'gpt-4o__T__1'],
  ])('rejects %s', (_label, names) => {
    expect(validateNames(names)).not.toHaveLength(0);
  });
});
