import { describe, expect, it, vi } from 'vitest';
import { normalizeOnboardingHints } from '../onboarding-hints.normalizer';
import { OnboardingHintPage } from '../types/onboarding-hint-page';
import { OnboardingHintTarget } from '../types/onboarding-hint-target';

describe('normalizeOnboardingHints', () => {
  it('returns an empty list with no warning when the value is absent', () => {
    const warn = vi.fn();
    expect(normalizeOnboardingHints(undefined, warn)).toEqual([]);
    expect(normalizeOnboardingHints(null, warn)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('warns and returns an empty list when the value is not an array', () => {
    const warn = vi.fn();
    expect(normalizeOnboardingHints({ id: 'x' }, warn)).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      'ONBOARDING_HINTS did not resolve to an array; ignoring it',
    );
  });

  it('returns complete entries in configured order and trims text', () => {
    const warn = vi.fn();
    const result = normalizeOnboardingHints(
      [
        {
          id: 'new-chat',
          target: 'new-chat',
          title: '  Start a new chat  ',
          description: 'Each chat keeps its own history.',
        },
        { id: 'composer', target: 'conversation-input', title: 'Ask here' },
      ],
      warn,
    );

    expect(result).toEqual([
      {
        id: 'new-chat',
        target: OnboardingHintTarget.NewChat,
        title: 'Start a new chat',
        description: 'Each chat keeps its own history.',
        pages: [],
      },
      {
        id: 'composer',
        target: OnboardingHintTarget.ConversationInput,
        title: 'Ask here',
        description: null,
        pages: [],
      },
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['a non-object entry', 'x'],
    ['a missing id', { target: 'new-chat', title: 'T' }],
    ['an id with a space', { id: 'a b', target: 'new-chat', title: 'T' }],
    [
      'an id of 65 characters',
      { id: 'a'.repeat(65), target: 'new-chat', title: 'T' },
    ],
    ['an unknown target', { id: 'a', target: 'body > div', title: 'T' }],
    ['a blank title', { id: 'a', target: 'new-chat', title: '   ' }],
  ])('drops %s with a warning', (_case, entry) => {
    const warn = vi.fn();
    expect(normalizeOnboardingHints([entry], warn)).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('keeps only the first entry of a duplicated id', () => {
    const warn = vi.fn();
    const result = normalizeOnboardingHints(
      [
        { id: 'a', target: 'new-chat', title: 'First' },
        { id: 'a', target: 'navigation', title: 'Second' },
      ],
      warn,
    );
    expect(result.map((hint) => hint.title)).toEqual(['First']);
    expect(warn).toHaveBeenCalledWith(
      'Ignoring onboarding hint "a": the id is already used',
    );
  });

  it('keeps every valid entry, however many there are', () => {
    const warn = vi.fn();
    const entries = Array.from({ length: 70 }, (_, index) => ({
      id: `hint-${index}`,
      target: 'navigation',
      title: `Hint ${index}`,
    }));
    expect(normalizeOnboardingHints(entries, warn)).toHaveLength(70);
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps the known pages of a hint once each, in their order', () => {
    const warn = vi.fn();
    const [result] = normalizeOnboardingHints(
      [
        {
          id: 'create',
          target: 'catalog-create',
          title: 'Create an agent',
          pages: ['catalog', 'home', 'catalog'],
        },
      ],
      warn,
    );
    expect(result.pages).toEqual([
      OnboardingHintPage.Catalog,
      OnboardingHintPage.Home,
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('drops an unknown page with a warning and keeps the hint', () => {
    const warn = vi.fn();
    const [result] = normalizeOnboardingHints(
      [
        {
          id: 'create',
          target: 'catalog-create',
          title: 'Create an agent',
          pages: ['/catalog', 'catalog'],
        },
      ],
      warn,
    );
    expect(result.pages).toEqual([OnboardingHintPage.Catalog]);
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).toContain(
      'Ignoring a page of onboarding hint "create"',
    );
  });

  it('treats pages that are not an array as unset, with a warning', () => {
    const warn = vi.fn();
    const [result] = normalizeOnboardingHints(
      [{ id: 'a', target: 'new-chat', title: 'A', pages: 'catalog' }],
      warn,
    );
    expect(result.pages).toEqual([]);
    expect(warn).toHaveBeenCalledWith(
      'Ignoring the pages of onboarding hint "a": they are not an array',
    );
  });
});
