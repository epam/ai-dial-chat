import type { StarterOption } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  getStarterConversationText,
  getStarterDisplayText,
  getStarterSubmitText,
} from '../starter-option';

const createStarter = (
  populateText: string | null,
  submit = true,
): StarterOption => ({
  const: 1,
  title: 'Pick a number',
  'dial:widgetOptions': {
    populateText,
    submit,
    confirmationMessage: null,
  },
});

describe('getStarterSubmitText', () => {
  it('returns empty submit text when populateText is null', () => {
    expect(getStarterSubmitText(createStarter(null), 'Pick a number')).toBe('');
  });

  it('uses populateText for submitted starter buttons when provided', () => {
    expect(getStarterSubmitText(createStarter('Scan this image'))).toBe(
      'Scan this image',
    );
  });

  it("prefers the starter's own populateText over the group description", () => {
    expect(
      getStarterSubmitText(createStarter('Scan this image'), 'Follow-Up'),
    ).toBe('Scan this image');
  });

  it('submits distinct text for each button of a described group', () => {
    const description = 'Follow-Up Questions';
    const first = { ...createStarter('How does feature X work?'), const: 0 };
    const second = { ...createStarter('How is feature Y priced?'), const: 1 };

    expect(getStarterSubmitText(first, description)).toBe(
      'How does feature X work?',
    );
    expect(getStarterSubmitText(second, description)).toBe(
      'How is feature Y priced?',
    );
  });

  it('falls back to the description for non-submit buttons without populateText', () => {
    expect(
      getStarterSubmitText(createStarter(null, false), 'Pick a number'),
    ).toBe('Pick a number');
  });
});

describe('getStarterDisplayText', () => {
  it("shows the starter's own populateText rather than the group description", () => {
    expect(
      getStarterDisplayText(
        createStarter('How does feature X work?'),
        'Follow-Up Questions',
      ),
    ).toBe('How does feature X work?');
  });

  it('falls back to the button label when the starter submits no text', () => {
    expect(
      getStarterDisplayText(createStarter(null), 'Follow-Up Questions'),
    ).toBe('Pick a number');
  });
});

describe('getStarterConversationText', () => {
  it('falls back to description when populateText is explicitly null', () => {
    expect(
      getStarterConversationText(createStarter(null), 'Pick a number'),
    ).toBe('Pick a number');
  });

  it("prefers the starter's own populateText over description", () => {
    expect(
      getStarterConversationText(createStarter('Scan this image'), 'ignored'),
    ).toBe('Scan this image');
  });

  it('falls back to the starter title when neither populateText nor description exist', () => {
    expect(getStarterConversationText(createStarter(null))).toBe(
      'Pick a number',
    );
  });
});
