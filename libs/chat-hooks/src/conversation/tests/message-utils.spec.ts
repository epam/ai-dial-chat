import {
  type Message,
  MessageRole,
  StageStatus,
  StatusEvent,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  getLastDeploymentId,
  getLastUserMessageToolConfiguration,
  isMessageStreaming,
  messageHasStages,
} from '../message-utils';

/*
 * ---------------------------------------------------------------------------
 * Helpers
 * ---------------------------------------------------------------------------
 */

const userMessage = (content = 'hello'): Message => ({
  role: MessageRole.User,
  content,
  timestamp: '2024-01-01T00:00:00.000Z',
});

const assistantMessage = (content = 'hi', deploymentId?: string): Message => ({
  role: MessageRole.Assistant,
  content,
  timestamp: '2024-01-01T00:00:00.000Z',
  ...(deploymentId != null ? { deploymentId } : {}),
});

const statusModelChanged = (newId: string): Message =>
  ({
    role: MessageRole.Status,
    content: '',
    custom_content: {
      event_type: StatusEvent.ModelChanged,
      new_deployment_id: newId,
    },
  }) as unknown as Message;

/*
 * ---------------------------------------------------------------------------
 * isMessageStreaming
 * ---------------------------------------------------------------------------
 */

describe('isMessageStreaming', () => {
  it('returns true for the last assistant message while streaming', () => {
    const msg = assistantMessage();
    expect(isMessageStreaming(msg, 2, 3, true)).toBe(true);
  });

  it('returns false when isAssistantTyping is false', () => {
    const msg = assistantMessage();
    expect(isMessageStreaming(msg, 2, 3, false)).toBe(false);
  });

  it('returns false when the message is not the last one', () => {
    const msg = assistantMessage();
    expect(isMessageStreaming(msg, 1, 3, true)).toBe(false);
  });

  it('returns false for a user message even if it is last and typing is true', () => {
    const msg = userMessage();
    expect(isMessageStreaming(msg, 2, 3, true)).toBe(false);
  });
});

/*
 * ---------------------------------------------------------------------------
 * getLastDeploymentId
 * ---------------------------------------------------------------------------
 */

describe('getLastDeploymentId', () => {
  it('returns null for an empty list', () => {
    expect(getLastDeploymentId([])).toBeNull();
  });

  it('returns null when no message records a deployment', () => {
    expect(getLastDeploymentId([userMessage(), assistantMessage()])).toBeNull();
  });

  it("returns an assistant message's own deploymentId", () => {
    expect(
      getLastDeploymentId([userMessage(), assistantMessage('hi', 'model-a')]),
    ).toBe('model-a');
  });

  it('prefers a later assistant deploymentId over an earlier model_changed event', () => {
    /*
     * The regenerate-after-switch timeline once the truncation dropped the
     * status marker that used to sit at the end (issue #8712): the regenerated
     * answer is the only record of the model the user picked.
     */
    const messages: Message[] = [
      userMessage(),
      statusModelChanged('model-a'),
      userMessage(),
      assistantMessage('hi', 'model-b'),
    ];
    expect(getLastDeploymentId(messages)).toBe('model-b');
  });

  it('prefers a later model_changed event over an earlier assistant deploymentId', () => {
    const messages: Message[] = [
      userMessage(),
      assistantMessage('hi', 'model-a'),
      statusModelChanged('model-b'),
    ];
    expect(getLastDeploymentId(messages)).toBe('model-b');
  });

  it('skips messages that carry no deployment on the way back', () => {
    const messages: Message[] = [
      userMessage(),
      assistantMessage('hi', 'model-a'),
      userMessage(),
    ];
    expect(getLastDeploymentId(messages)).toBe('model-a');
  });

  it('returns the deployment id from the last model_changed event', () => {
    const messages: Message[] = [
      userMessage(),
      statusModelChanged('model-a'),
      userMessage(),
      statusModelChanged('model-b'),
      assistantMessage(),
    ];
    expect(getLastDeploymentId(messages)).toBe('model-b');
  });

  it('returns the only deployment id when there is one model_changed event', () => {
    expect(
      getLastDeploymentId([userMessage(), statusModelChanged('model-x')]),
    ).toBe('model-x');
  });
});

/*
 * ---------------------------------------------------------------------------
 * getLastUserMessageToolConfiguration
 * ---------------------------------------------------------------------------
 */

describe('getLastUserMessageToolConfiguration', () => {
  it('returns undefined for an empty list', () => {
    expect(getLastUserMessageToolConfiguration([])).toBeUndefined();
  });

  it('returns undefined when the last user message has no configuration_value', () => {
    expect(
      getLastUserMessageToolConfiguration([userMessage(), assistantMessage()]),
    ).toBeUndefined();
  });

  it('returns the configuration_value from the last user message', () => {
    const withConfig: Message = {
      ...userMessage('second'),
      custom_content: { configuration_value: { deep_research: true } },
    };
    const messages: Message[] = [
      { ...userMessage('first'), custom_content: {} },
      assistantMessage(),
      withConfig,
      assistantMessage(),
    ];
    expect(getLastUserMessageToolConfiguration(messages)).toEqual({
      deep_research: true,
    });
  });

  it('reads the configuration from the last user message while awaiting a reply', () => {
    const withConfig: Message = {
      ...userMessage('awaiting reply'),
      custom_content: { configuration_value: { deep_research: true } },
    };
    expect(getLastUserMessageToolConfiguration([withConfig])).toEqual({
      deep_research: true,
    });
  });
});

/*
 * ---------------------------------------------------------------------------
 * messageHasStages
 * ---------------------------------------------------------------------------
 */

describe('messageHasStages', () => {
  it('returns false for a user message', () => {
    expect(messageHasStages(userMessage())).toBe(false);
  });

  it('returns false for an assistant message with no stages', () => {
    expect(messageHasStages(assistantMessage())).toBe(false);
  });

  it('returns false for an assistant message with an empty stages array', () => {
    const msg: Message = {
      role: MessageRole.Assistant,
      content: '',
      timestamp: '2024-01-01T00:00:00.000Z',
      custom_content: { stages: [] },
    };
    expect(messageHasStages(msg)).toBe(false);
  });

  it('returns true for an assistant message with at least one stage', () => {
    const msg: Message = {
      role: MessageRole.Assistant,
      content: '',
      timestamp: '2024-01-01T00:00:00.000Z',
      custom_content: {
        stages: [
          {
            index: 0,
            name: 'step-1',
            status: StageStatus.Completed,
            content: '',
          },
        ],
      },
    };
    expect(messageHasStages(msg)).toBe(true);
  });
});
