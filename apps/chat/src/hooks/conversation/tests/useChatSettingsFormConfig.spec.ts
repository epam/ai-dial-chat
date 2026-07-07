import { ResponseFormat, type Conversation } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useChatSettingsFormConfig } from '../useChatSettingsFormConfig';

const mockShowNotification = vi.fn();

vi.mock('../../../context/NotificationContext', () => ({
  useNotification: () => ({ showNotification: mockShowNotification }),
}));

const makeConversation = (): Conversation =>
  ({
    id: 'conv-1',
    name: 'Test',
    model: { id: 'gpt-4o' },
    messages: [],
    folderId: '',
    prompt: 'existing prompt',
    temperature: 0.7,
    responseFormat: ResponseFormat.PlainText,
    lastActivityDate: Date.now(),
    updatedAt: Date.now(),
    selectedAddons: [],
    assistantModelId: '',
  }) as Conversation;

describe('useChatSettingsFormConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('local mode reflects the passed-in values and saves via onValuesChange', () => {
    const onValuesChange = vi.fn();
    const values = {
      responseFormat: ResponseFormat.Markdown,
      systemPrompt: 'hello',
      temperature: 0.5,
    };
    const { result } = renderHook(() =>
      useChatSettingsFormConfig({ mode: 'local', values, onValuesChange }),
    );

    expect(result.current.responseFormat).toBe(ResponseFormat.Markdown);
    expect(result.current.systemPrompt).toBe('hello');
    expect(result.current.temperature).toBe(0.5);

    result.current.onSave({ temperature: 0.9 });

    expect(onValuesChange).toHaveBeenCalledWith({
      responseFormat: ResponseFormat.Markdown,
      systemPrompt: 'hello',
      temperature: 0.9,
    });
    expect(mockShowNotification).toHaveBeenCalledOnce();
  });

  it('conversation mode reflects the target conversation and saves via onConversationChange', () => {
    const conversation = makeConversation();
    const onConversationChange = vi.fn();
    const { result } = renderHook(() =>
      useChatSettingsFormConfig({
        mode: 'conversation',
        conversation,
        onConversationChange,
      }),
    );

    expect(result.current.responseFormat).toBe(ResponseFormat.PlainText);
    expect(result.current.systemPrompt).toBe('existing prompt');
    expect(result.current.temperature).toBe(0.7);

    result.current.onSave({ temperature: 0.2 });

    expect(onConversationChange).toHaveBeenCalledWith({
      ...conversation,
      temperature: 0.2,
    });
  });

  it('resolves every label through the same i18n keys regardless of mode', () => {
    const onValuesChange = vi.fn();
    const { result: localResult } = renderHook(() =>
      useChatSettingsFormConfig({
        mode: 'local',
        values: {
          responseFormat: ResponseFormat.Markdown,
          systemPrompt: '',
          temperature: 0.5,
        },
        onValuesChange,
      }),
    );

    const onConversationChange = vi.fn();
    const { result: conversationResult } = renderHook(() =>
      useChatSettingsFormConfig({
        mode: 'conversation',
        conversation: makeConversation(),
        onConversationChange,
      }),
    );

    const labelKeys = [
      'menuItemLabel',
      'title',
      'responseFormatLabel',
      'responseFormatHint',
      'responseFormatMarkdownLabel',
      'responseFormatPlainTextLabel',
      'systemPromptLabel',
      'systemPromptTooltip',
      'temperatureLabel',
      'temperatureHint',
      'saveLabel',
      'saveDisabledTooltip',
    ] as const;

    for (const key of labelKeys) {
      expect(localResult.current[key]).toBe(conversationResult.current[key]);
    }
    expect(localResult.current.temperatureLabels).toEqual(
      conversationResult.current.temperatureLabels,
    );
  });
});
