import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ProjectConversationListQueryDto } from '../conversations/dto/project-conversation-list-query.dto';
import { ProjectConversationParamDto } from '../conversations/dto/project-conversation-param.dto';

const PROJECT_ID = 'projects/a1b2c3/support-quality';

const validate = (conversationName: unknown, id: unknown = PROJECT_ID) =>
  validateSync(
    plainToInstance(ProjectConversationParamDto, { id, conversationName }),
  );
const validateLimit = (limit: unknown) =>
  validateSync(plainToInstance(ProjectConversationListQueryDto, { limit }));

describe('ProjectConversationParamDto', () => {
  it.each([
    'gpt-4o__Weekly summary__7c1d',
    'gpt-4o__Справка__1',
    'dial-chathub-v2-anthropic.claude-haiku-4-5-20251001-v1:0__hey__243cbd90',
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
    ['an over-long name', 'я'.repeat(128)],
    ['a non-string', 42],
  ])('rejects %s', (_label, name) => {
    expect(validate(name)).not.toHaveLength(0);
  });

  it('rejects an invalid project id', () => {
    expect(validate('x', 'projects/a1b2c3/../x')).not.toHaveLength(0);
  });
});

describe('ProjectConversationListQueryDto', () => {
  it.each([undefined, '1', '50', '100'])('accepts limit %s', (limit) => {
    expect(validateLimit(limit)).toHaveLength(0);
  });

  it.each(['0', '101', 'x', '1.5'])('rejects limit %s', (limit) => {
    expect(validateLimit(limit)).not.toHaveLength(0);
  });
});
