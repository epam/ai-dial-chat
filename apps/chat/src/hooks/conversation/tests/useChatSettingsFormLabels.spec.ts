import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useChatSettingsFormLabels } from '../useChatSettingsFormLabels';

describe('useChatSettingsFormLabels', () => {
  it('returns a translated value for every chat-settings form label', () => {
    const { result } = renderHook(() => useChatSettingsFormLabels());

    expect(result.current.settings).toBeTruthy();
    expect(result.current.savedNotification).toBeTruthy();
    expect(result.current.responseFormatLabel).toBeTruthy();
    expect(result.current.responseFormatHint).toBeTruthy();
    expect(result.current.responseFormatMarkdown).toBeTruthy();
    expect(result.current.responseFormatPlainText).toBeTruthy();
    expect(result.current.systemPromptLabel).toBeTruthy();
    expect(result.current.systemPromptTooltip).toBeTruthy();
    expect(result.current.temperatureLabel).toBeTruthy();
    expect(result.current.temperaturePrecise).toBeTruthy();
    expect(result.current.temperatureNeutral).toBeTruthy();
    expect(result.current.temperatureCreative).toBeTruthy();
    expect(result.current.temperatureHint).toBeTruthy();
    expect(result.current.saveLabel).toBeTruthy();
    expect(result.current.saveDisabledTooltip).toBeTruthy();
  });
});
