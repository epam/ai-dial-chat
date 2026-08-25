import { ResponseFormat, type Conversation } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  type ChatSettingsFormLabels,
  useChatSettingsFormConfig,
} from '../useChatSettingsFormConfig';

const labels: ChatSettingsFormLabels = {
  settings: 'Settings',
  savedNotification: 'Chat settings have been saved',
  responseFormatLabel: 'Response format',
  responseFormatHint: 'Applies to new and existing messages',
  responseFormatMarkdown: 'Markdown',
  responseFormatPlainText: 'Plain text',
  systemPromptLabel: 'System prompt',
  systemPromptTooltip: 'Enter a prompt',
  temperatureLabel: 'Temperature',
  temperaturePrecise: 'Precise',
  temperatureNeutral: 'Neutral',
  temperatureCreative: 'Creative',
  temperatureHint:
    'Higher values like 0.8 will make the output more random, while lower values like 0.2 will make it more focused and deterministic.',
  saveLabel: 'Apply changes',
  saveDisabledTooltip: 'Please select a response format',
};

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
  it('local mode reflects the passed-in values and saves via onValuesChange', () => {
    const onValuesChange = vi.fn();
    const onSaved = vi.fn();
    const values = {
      responseFormat: ResponseFormat.Markdown,
      systemPrompt: 'hello',
      temperature: 0.5,
    };
    const { result } = renderHook(() =>
      useChatSettingsFormConfig({
        mode: 'local',
        values,
        onValuesChange,
        labels,
        onSaved,
      }),
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
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('conversation mode reflects the target conversation and saves via onConversationChange', () => {
    const conversation = makeConversation();
    const onConversationChange = vi.fn();
    const onSaved = vi.fn();
    const { result } = renderHook(() =>
      useChatSettingsFormConfig({
        mode: 'conversation',
        conversation,
        onConversationChange,
        labels,
        onSaved,
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
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it('only patches the conversation fields that were actually edited', () => {
    const conversation = makeConversation();
    const onConversationChange = vi.fn();
    const { result } = renderHook(() =>
      useChatSettingsFormConfig({
        mode: 'conversation',
        conversation,
        onConversationChange,
        labels,
      }),
    );

    result.current.onSave({ systemPrompt: 'new prompt' });

    expect(onConversationChange).toHaveBeenCalledWith({
      ...conversation,
      prompt: 'new prompt',
    });
    // responseFormat/temperature must be untouched when absent from the saved values.
    const patched = onConversationChange.mock.calls[0][0];
    expect(patched.responseFormat).toBe(conversation.responseFormat);
    expect(patched.temperature).toBe(conversation.temperature);
  });

  it('forces the temperature field off for a Quick App regardless of deployment features', () => {
    const { result } = renderHook(() =>
      useChatSettingsFormConfig({
        mode: 'local',
        values: {
          responseFormat: ResponseFormat.Markdown,
          systemPrompt: '',
          temperature: 0.5,
        },
        onValuesChange: vi.fn(),
        deploymentFeatures: { temperature: true, systemPrompt: true },
        isQuickApp: true,
        labels,
      }),
    );

    expect(result.current.features.temperature).toBe(false);
    expect(result.current.features.systemPrompt).toBe(true);
    expect(result.current.features.responseFormat).toBe(true);
  });

  it('passes the provided labels through, with English defaults for any field omitted', () => {
    const { result } = renderHook(() =>
      useChatSettingsFormConfig({
        mode: 'local',
        values: {
          responseFormat: ResponseFormat.Markdown,
          systemPrompt: '',
          temperature: 0.5,
        },
        onValuesChange: vi.fn(),
        labels: { settings: 'Chat settings' },
      }),
    );

    expect(result.current.menuItemLabel).toBe('Chat settings');
    expect(result.current.title).toBe('Chat settings');
    // Omitted fields fall back to the English defaults.
    expect(result.current.saveLabel).toBe('Apply changes');
    expect(result.current.temperatureLabels).toEqual([
      'Precise',
      'Neutral',
      'Creative',
    ]);
  });
});
