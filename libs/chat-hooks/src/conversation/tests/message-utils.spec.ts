import {
  type Message,
  MessageRole,
  StageStatus,
  StatusEvent,
} from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  getFormSchemaToolSyncKey,
  getLastDeploymentId,
  getLastUserMessageToolConfiguration,
  getLatestToolConfiguration,
  getToolConfigurationFromFormSchema,
  isMessageStreaming,
  messageHasStages,
} from '../message-utils';
import { getStartersFromSchema } from '../starter-option';

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
     * status marker that used to sit at the end ([#8712](https://github.com/epam/ai-dial-chat/issues/8712)): the regenerated
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

/*
 * ---------------------------------------------------------------------------
 * form_schema-driven tool configuration
 * ---------------------------------------------------------------------------
 */

const withFormSchema = (
  message: Message,
  properties: Record<string, Record<string, unknown>>,
): Message => ({
  ...message,
  custom_content: { form_schema: { type: 'object', properties } },
});

const userWithConfig = (value: Record<string, unknown>): Message => ({
  ...userMessage(),
  custom_content: { configuration_value: value },
});

describe('getToolConfigurationFromFormSchema', () => {
  it('returns undefined when there is no schema', () => {
    expect(getToolConfigurationFromFormSchema(undefined)).toBeUndefined();
  });

  it('reads a boolean default, true or false', () => {
    expect(
      getToolConfigurationFromFormSchema({
        properties: {
          deep_research: { type: 'boolean', default: true },
          web_search: { type: 'boolean', default: false },
        },
      }),
    ).toEqual({ deep_research: true, web_search: false });
  });

  it('falls back to the const of a single-option oneOf', () => {
    expect(
      getToolConfigurationFromFormSchema({
        properties: {
          deep_research: { oneOf: [{ const: false, title: 'Off' }] },
        },
      }),
    ).toEqual({ deep_research: false });
  });

  it('prefers default over a single-option oneOf', () => {
    expect(
      getToolConfigurationFromFormSchema({
        properties: {
          deep_research: { default: true, oneOf: [{ const: false }] },
        },
      }),
    ).toEqual({ deep_research: true });
  });

  it('ignores a multi-option oneOf, since no option is marked selected', () => {
    expect(
      getToolConfigurationFromFormSchema({
        properties: {
          deep_research: { oneOf: [{ const: true }, { const: false }] },
        },
      }),
    ).toBeUndefined();
  });

  it('ignores non-boolean values such as numeric button consts', () => {
    expect(
      getToolConfigurationFromFormSchema({
        properties: {
          deep_research: { default: 'yes' },
          button: { 'dial:widget': 'buttons', oneOf: [{ const: 1 }] },
        },
      }),
    ).toBeUndefined();
  });
});

/* A toggle sent as a buttons widget whose single option carries the current value. */
const buttonsToggleForm = {
  additionalProperties: false,
  properties: {
    deep_research: {
      'dial:widget': 'buttons',
      oneOf: [
        {
          const: false,
          'dial:widgetOptions': {
            confirmationMessage: null,
            populateText: null,
            submit: false,
          },
          title: 'Deep research',
        },
      ],
      title: 'Deep research',
      type: 'boolean',
    },
  },
  required: ['deep_research'],
  title: 'DeepResearchToggleForm',
  type: 'object',
};

describe('getToolConfigurationFromFormSchema — single-option buttons widget', () => {
  it('reads the toggle state from the single buttons option', () => {
    expect(getToolConfigurationFromFormSchema(buttonsToggleForm)).toEqual({
      deep_research: false,
    });
  });

  it('offers no starter buttons for it', () => {
    expect(getStartersFromSchema(buttonsToggleForm).starters).toEqual([]);
  });
});

describe('getLatestToolConfiguration', () => {
  it('returns the last user configuration when no assistant message follows it', () => {
    expect(
      getLatestToolConfiguration([userWithConfig({ deep_research: true })]),
    ).toEqual({ deep_research: true });
  });

  it('lets a later assistant form_schema override the user configuration', () => {
    const messages = [
      userWithConfig({ deep_research: true, web_search: true }),
      withFormSchema(assistantMessage(), {
        deep_research: { type: 'boolean', default: false },
      }),
    ];
    expect(getLatestToolConfiguration(messages)).toEqual({
      deep_research: false,
      web_search: true,
    });
  });

  it('ignores an assistant form_schema that precedes the last user message', () => {
    const messages = [
      userWithConfig({ deep_research: false }),
      withFormSchema(assistantMessage(), {
        deep_research: { type: 'boolean', default: true },
      }),
      userWithConfig({ deep_research: false }),
      assistantMessage(),
    ];
    expect(getLatestToolConfiguration(messages)).toEqual({
      deep_research: false,
    });
  });

  it('uses assistant values when the conversation has no user configuration', () => {
    const messages = [
      userMessage(),
      withFormSchema(assistantMessage(), {
        deep_research: { type: 'boolean', default: true },
      }),
    ];
    expect(getLatestToolConfiguration(messages)).toEqual({
      deep_research: true,
    });
  });

  it('returns undefined for an empty list', () => {
    expect(getLatestToolConfiguration([])).toBeUndefined();
  });
});

describe('getFormSchemaToolSyncKey', () => {
  const onSchema = { deep_research: { type: 'boolean', default: true } };

  it('returns the known tool values of the last assistant message', () => {
    const result = getFormSchemaToolSyncKey(
      'c1',
      [
        userMessage(),
        withFormSchema(assistantMessage(), {
          ...onSchema,
          web_search: { type: 'boolean', default: true },
        }),
      ],
      ['deep_research'],
    );
    expect(result?.values).toEqual({ deep_research: true });
  });

  it('returns undefined when the last message is a user message', () => {
    expect(
      getFormSchemaToolSyncKey(
        'c1',
        [withFormSchema(assistantMessage(), onSchema), userMessage()],
        ['deep_research'],
      ),
    ).toBeUndefined();
  });

  it('returns undefined when no value matches a current tool', () => {
    expect(
      getFormSchemaToolSyncKey(
        'c1',
        [userMessage(), withFormSchema(assistantMessage(), onSchema)],
        [],
      ),
    ).toBeUndefined();
  });

  it('keeps the same key for an identical schema re-created by a later chunk', () => {
    const first = getFormSchemaToolSyncKey(
      'c1',
      [userMessage(), withFormSchema(assistantMessage('a'), onSchema)],
      ['deep_research'],
    );
    const second = getFormSchemaToolSyncKey(
      'c1',
      [userMessage(), withFormSchema(assistantMessage('ab'), { ...onSchema })],
      ['deep_research'],
    );
    expect(second?.key).toBe(first?.key);
  });

  it('keeps the same key when the tool ids arrive in a different order', () => {
    const messages = [
      userMessage(),
      withFormSchema(assistantMessage(), {
        ...onSchema,
        web_search: { type: 'boolean', default: false },
      }),
    ];
    expect(
      getFormSchemaToolSyncKey('c1', messages, ['web_search', 'deep_research'])
        ?.key,
    ).toBe(
      getFormSchemaToolSyncKey('c1', messages, ['deep_research', 'web_search'])
        ?.key,
    );
  });

  it('changes the key when the app sends a different value', () => {
    const on = getFormSchemaToolSyncKey(
      'c1',
      [userMessage(), withFormSchema(assistantMessage(), onSchema)],
      ['deep_research'],
    );
    const off = getFormSchemaToolSyncKey(
      'c1',
      [
        userMessage(),
        withFormSchema(assistantMessage(), {
          deep_research: { type: 'boolean', default: false },
        }),
      ],
      ['deep_research'],
    );
    expect(off?.key).not.toBe(on?.key);
  });
});
