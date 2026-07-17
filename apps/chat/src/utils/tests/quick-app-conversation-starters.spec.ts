import { describe, expect, it } from 'vitest';
import { getQuickAppConversationStarters } from '../quick-app-conversation-starters';

describe('quick-app-conversation-starters', () => {
  it('maps valid Quick Apps starters to StarterOption entries', () => {
    const result = getQuickAppConversationStarters({
      introText: '  Pick a task  ',
      autoSubmit: false,
      chatMessageInputDisabled: true,
      starters: [
        { title: ' Summarize ', text: ' Summarize this ' },
        { title: '', text: 'Ignored' },
        { title: 'Explain', text: ' ' },
      ],
    });

    expect(result).toEqual({
      introText: 'Pick a task',
      isChatMessageInputDisabled: true,
      starters: [
        {
          const: 0,
          title: 'Summarize',
          'dial:widgetOptions': {
            populateText: 'Summarize this',
            submit: false,
            confirmationMessage: null,
          },
        },
      ],
    });
  });

  it('defaults starter buttons to auto-submit when the setting is absent', () => {
    const result = getQuickAppConversationStarters({
      starters: [{ title: 'Start', text: 'Begin' }],
    });

    expect(result.starters[0]['dial:widgetOptions'].submit).toBe(true);
  });

  it('returns empty settings for invalid payloads', () => {
    expect(getQuickAppConversationStarters(null)).toEqual({
      starters: [],
      introText: undefined,
      isChatMessageInputDisabled: false,
    });
  });
});
