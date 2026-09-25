import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSkillMentions } from '../useSkillMentions';

const resolveName = (url: string): string => url.split('/').pop() ?? url;

describe('useSkillMentions', () => {
  it('inserts a mention, updating the draft and anchors', () => {
    const { result } = renderHook(() => useSkillMentions());

    act(() => {
      result.current.insertMention('skills/bucket/abc', 'abc', 0);
    });

    expect(result.current.draft).toBe('/abc ');
    expect(result.current.anchors).toEqual([
      { url: 'skills/bucket/abc', name: 'abc', start: 0, length: 4 },
    ]);
    expect(result.current.orderedSkills).toEqual([
      { url: 'skills/bucket/abc' },
    ]);
  });

  it('shifts anchors when typing elsewhere in the draft', () => {
    const { result } = renderHook(() => useSkillMentions());

    act(() => {
      result.current.insertMention('skills/bucket/abc', 'abc', 0);
    });
    act(() => {
      result.current.onDraftChange('/abc hello ');
    });

    expect(result.current.anchors).toEqual([
      { url: 'skills/bucket/abc', name: 'abc', start: 0, length: 4 },
    ]);
  });

  it('drops a mention when the edit lands inside it', () => {
    const { result } = renderHook(() => useSkillMentions());

    act(() => {
      result.current.insertMention('skills/bucket/abc', 'abc', 0);
    });
    act(() => {
      // Editing "/abc " into "/abX " lands inside the mention's range.
      result.current.onDraftChange('/abX ');
    });

    expect(result.current.anchors).toEqual([]);
    expect(result.current.orderedSkills).toBeUndefined();
  });

  it('looks up the mention at a Backspace boundary without mutating state', () => {
    const { result } = renderHook(() => useSkillMentions());

    act(() => {
      result.current.insertMention('skills/bucket/abc', 'abc', 0);
    });

    const found = result.current.onBackspaceAtCaret(4);

    expect(found).toEqual({
      url: 'skills/bucket/abc',
      name: 'abc',
      start: 0,
      length: 4,
    });
    expect(result.current.draft).toBe('/abc ');
    expect(result.current.anchors).toEqual([
      { url: 'skills/bucket/abc', name: 'abc', start: 0, length: 4 },
    ]);
  });

  it('returns undefined from the Backspace lookup when the caret is not at a mention boundary', () => {
    const { result } = renderHook(() => useSkillMentions());

    act(() => {
      result.current.insertMention('skills/bucket/abc', 'abc', 0);
    });

    const found = result.current.onBackspaceAtCaret(2);

    expect(found).toBeUndefined();
    expect(result.current.anchors).toEqual([
      { url: 'skills/bucket/abc', name: 'abc', start: 0, length: 4 },
    ]);
  });

  it('drops the anchor via onDraftChange once the caller performs the native range deletion', () => {
    const { result } = renderHook(() => useSkillMentions());

    act(() => {
      result.current.insertMention('skills/bucket/abc', 'abc', 0);
    });

    const found = result.current.onBackspaceAtCaret(4);
    expect(found).not.toBeUndefined();

    act(() => {
      result.current.onDraftChange(' ');
    });

    expect(result.current.draft).toBe(' ');
    expect(result.current.anchors).toEqual([]);
  });

  it('reconstructs anchors matching matchSkillMentions via seedFromMessage', () => {
    const { result } = renderHook(() => useSkillMentions());

    act(() => {
      result.current.seedFromMessage(
        '/abc please summarize, then run /csd on the result',
        [{ url: 'skills/bucket/abc' }, { url: 'skills/bucket/csd' }],
        resolveName,
      );
    });

    expect(result.current.draft).toBe(
      '/abc please summarize, then run /csd on the result',
    );
    expect(result.current.anchors).toEqual([
      { url: 'skills/bucket/abc', name: 'abc', start: 0, length: 4 },
      { url: 'skills/bucket/csd', name: 'csd', start: 32, length: 4 },
    ]);
  });

  it('clears both draft and anchors on reset', () => {
    const { result } = renderHook(() => useSkillMentions());

    act(() => {
      result.current.insertMention('skills/bucket/abc', 'abc', 0);
    });
    act(() => {
      result.current.reset();
    });

    expect(result.current.draft).toBe('');
    expect(result.current.anchors).toEqual([]);
    expect(result.current.orderedSkills).toBeUndefined();
  });
});
