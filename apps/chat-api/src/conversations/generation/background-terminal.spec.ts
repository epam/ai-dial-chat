import { describe, expect, it } from 'vitest';
import { BackgroundGenerationStatus } from '../dto/background-generation.dto';
import {
  ConversationMessageRole,
  type ConversationMessageDto,
} from '../dto/conversation-message.dto';
import { extractOutputText, toTerminalFields } from './background-terminal';
import {
  RESPONSES_FAILED_MESSAGE,
  RESPONSES_INCOMPLETE_MESSAGE,
} from './responses.adapter';

const GEN = 'gen-1';
const RESPONSE_ID = 'dial_gpt_r1';

const pendingMessage = (generationId = GEN): ConversationMessageDto => ({
  role: ConversationMessageRole.Assistant,
  content: '',
  timestamp: 't',
  responseId: 'dial_other',
  backgroundGeneration: {
    generationId,
    status: BackgroundGenerationStatus.Pending,
    startedAt: 1,
  },
});

describe('extractOutputText', () => {
  it('keeps only answer text, never reasoning', () => {
    expect(
      extractOutputText({
        id: RESPONSE_ID,
        status: 'completed',
        output: [
          {
            type: 'reasoning',
            content: [{ type: 'reasoning_text', text: 'thinking' }],
          },
          {
            type: 'message',
            content: [
              { type: 'output_text', text: 'Hello' },
              { type: 'refusal', text: '!' },
              { type: 'output_text', text: ' world' },
            ],
          },
        ],
      }),
    ).toBe('Hello world');
  });
});

describe('toTerminalFields', () => {
  const stored = {
    ...pendingMessage(),
    responseId: RESPONSE_ID,
    rating: 1,
  } as never;

  it('returns null while the job is running', () => {
    expect(
      toTerminalFields(stored, { id: RESPONSE_ID, status: 'in_progress' }),
    ).toBeNull();
  });

  it('maps an expired job to failed with an empty error text', () => {
    expect(toTerminalFields(stored, null)).toMatchObject({
      streamErrorMessage: '',
      backgroundGeneration: { status: BackgroundGenerationStatus.Failed },
    });
  });

  it('maps an incomplete job to failed with the same error text as the stateless path', () => {
    expect(
      toTerminalFields(stored, { id: RESPONSE_ID, status: 'incomplete' }),
    ).toMatchObject({
      streamErrorMessage: RESPONSES_INCOMPLETE_MESSAGE,
      backgroundGeneration: { status: BackgroundGenerationStatus.Failed },
    });
  });

  it('maps a failed job like the stateless path, with a fallback text', () => {
    expect(
      toTerminalFields(stored, {
        id: RESPONSE_ID,
        status: 'failed',
        error: { message: 'quota exceeded' },
      })?.streamErrorMessage,
    ).toBe('quota exceeded');
    expect(
      toTerminalFields(stored, { id: RESPONSE_ID, status: 'failed' })
        ?.streamErrorMessage,
    ).toBe(RESPONSES_FAILED_MESSAGE);
  });
});
