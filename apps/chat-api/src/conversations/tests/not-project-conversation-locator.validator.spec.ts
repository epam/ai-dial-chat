import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { AttachGenerationDto } from '../dto/attach-generation.dto';
import { ConversationPathDto } from '../dto/conversation-path.dto';
import { SendCompletionDto } from '../dto/send-completion.dto';
import { StopCompletionDto } from '../dto/stop-completion.dto';
import { WatchConversationBodyDto } from '../dto/watch-conversation.dto';

const LOCATOR = 'projects/a1b2c3/support-quality/conversations/gpt-4o__Hi__1';
const STRIPPED_LOCATOR = 'a1b2c3/support-quality/conversations/gpt-4o__Hi__1';
const GENERATION_ID = 'cfeaf733-4ecd-4898-ad3b-d6835c0b5fc8';

const pathErrors = <T extends object>(
  dto: new () => T,
  body: Record<string, unknown>,
) =>
  validateSync(plainToInstance(dto, body)).filter(
    (error) => error.property === 'path',
  );

describe('IsNotProjectConversationLocator', () => {
  it.each([
    ['ConversationPathDto', ConversationPathDto, {}],
    ['WatchConversationBodyDto', WatchConversationBodyDto, {}],
    ['AttachGenerationDto', AttachGenerationDto, {}],
    ['StopCompletionDto', StopCompletionDto, { generationId: GENERATION_ID }],
    [
      'SendCompletionDto',
      SendCompletionDto,
      { generationId: GENERATION_ID, message: 'Hi', model: 'gpt-4o' },
    ],
  ] as const)(
    '%s rejects a project conversation locator',
    (_name, dto, body) => {
      const errors = pathErrors(dto as new () => object, {
        ...body,
        path: LOCATOR,
      });
      expect(errors).toHaveLength(1);
      expect(errors[0].constraints).toHaveProperty(
        'isNotProjectConversationLocator',
      );
    },
  );

  it.each([
    'a1b2c3/gpt-4o__Hi__1',
    'gpt-4o__Hi__1',
    'a1b2c3/projects/gpt-4o__Hi__1',
    STRIPPED_LOCATOR,
  ])('accepts %s', (path) => {
    expect(pathErrors(ConversationPathDto, { path })).toHaveLength(0);
  });
});
