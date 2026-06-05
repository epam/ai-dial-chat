import type { StarterOption } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import { getStarterSubmitText } from '../starter-option';

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

describe('starter-option', () => {
  it('returns empty submit text when populateText is null', () => {
    expect(getStarterSubmitText(createStarter(null), 'Pick a number')).toBe('');
  });

  it('uses populateText for submitted starter buttons when provided', () => {
    expect(getStarterSubmitText(createStarter('Scan this image'))).toBe(
      'Scan this image',
    );
  });
});
