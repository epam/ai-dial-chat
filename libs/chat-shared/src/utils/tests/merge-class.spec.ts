import { describe, expect, it } from 'vitest';
import { mergeClasses } from '../merge-class';

describe('mergeClasses', () => {
  it('drops falsy values and joins the rest', () => {
    expect(mergeClasses('base', false, undefined, 'extra')).toBe('base extra');
  });

  it('keeps the last of two conflicting utilities', () => {
    expect(mergeClasses('h-[36px]', 'h-[44px]')).toBe('h-[44px]');
  });

  it("resolves the theme's own shadow key against a stock one", () => {
    expect(mergeClasses('shadow-chat-button', 'shadow-md')).toBe('shadow-md');
    expect(mergeClasses('shadow-md', 'shadow-chat-button')).toBe(
      'shadow-chat-button',
    );
  });

  it('leaves a shadow variant alone, since it is a group of its own', () => {
    expect(
      mergeClasses('shadow-chat-button hover:shadow-xs', 'shadow-md'),
    ).toBe('hover:shadow-xs shadow-md');
  });
});
