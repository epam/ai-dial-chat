import type { StarterOption } from '@epam/ai-dial-chat-shared';
import { describe, expect, it } from 'vitest';
import {
  getStarterPopulateText,
  getStartersFromSchema,
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

describe('getStarterPopulateText', () => {
  it('returns populateText when provided', () => {
    expect(getStarterPopulateText(createStarter('Scan this image'))).toBe(
      'Scan this image',
    );
  });

  it('falls back to the title when populateText is empty', () => {
    expect(getStarterPopulateText(createStarter(''))).toBe('Pick a number');
  });

  it('falls back to the title when populateText is null', () => {
    expect(getStarterPopulateText(createStarter(null))).toBe('Pick a number');
  });
});

describe('getStartersFromSchema', () => {
  it('offers no buttons for a form_schema that only switches a tool toggle', () => {
    const { starters, propertyKey } = getStartersFromSchema({
      properties: {
        deep_research: {
          type: 'boolean',
          default: false,
          oneOf: [{ const: false, title: 'Off' }],
        },
      },
    });

    expect(starters).toEqual([]);
    expect(propertyKey).toBeUndefined();
  });
});
