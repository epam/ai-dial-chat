import {
  ResourceDependencyAccess,
  type ApplicationResourceDependencyDto,
} from '@epam/ai-dial-chat-api-client';
import { AccessLevel as Level } from '@epam/ai-dial-chat-shared';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ApplicationAccessContentType as Type } from '../types';
import { useApplicationAccess } from '../useApplicationAccess/useApplicationAccess';

const { Read } = ResourceDependencyAccess;

const FILES: ApplicationResourceDependencyDto = {
  linkId: 'f',
  target: { url: 'files/{current-user}/' },
  access: [Read],
};
const POLICIES: ApplicationResourceDependencyDto = {
  linkId: 'p',
  target: { url: 'files/public/policies/' },
  access: [Read],
  required: true,
};

describe('useApplicationAccess', () => {
  it('starts clean from a stored list', () => {
    const { result } = renderHook(() =>
      useApplicationAccess({ storedList: [FILES, POLICIES] }),
    );

    expect(result.current.entries).toEqual([
      { contentType: Type.Files, accessLevel: Level.Read },
    ]);
    expect(result.current.preserved.map((item) => item.url)).toEqual([
      'files/public/policies/',
    ]);
    expect(result.current.isDirty).toBe(false);
    expect(result.current.toRequestValue()).toBeUndefined();
  });

  it('stays untouched when the entries are set to the same values', () => {
    const { result } = renderHook(() =>
      useApplicationAccess({ storedList: [FILES, POLICIES] }),
    );

    act(() =>
      result.current.setEntries([
        { contentType: Type.Files, accessLevel: Level.Read },
      ]),
    );

    expect(result.current.isDirty).toBe(false);
    expect(result.current.toRequestValue()).toBeUndefined();
  });

  it('is dirty after a change and returns the full list with preserved entries in place', () => {
    const { result } = renderHook(() =>
      useApplicationAccess({ storedList: [POLICIES, FILES] }),
    );

    act(() =>
      result.current.setEntries([
        { contentType: Type.Files, accessLevel: Level.ReadWrite },
        { contentType: Type.Prompts, accessLevel: Level.Read },
      ]),
    );

    expect(result.current.isDirty).toBe(true);
    expect(result.current.toRequestValue()?.map((item) => item.linkId)).toEqual(
      ['p', 'f', 'access-prompts'],
    );
  });

  it('returns to clean when the change is reverted', () => {
    const { result } = renderHook(() =>
      useApplicationAccess({ storedList: [FILES] }),
    );

    act(() => result.current.setEntries([]));
    expect(result.current.isDirty).toBe(true);
    act(() =>
      result.current.setEntries([
        { contentType: Type.Files, accessLevel: Level.Read },
      ]),
    );

    expect(result.current.isDirty).toBe(false);
  });

  it('returns an empty list for an explicit clear with no preserved entries', () => {
    const { result } = renderHook(() =>
      useApplicationAccess({ storedList: [FILES] }),
    );

    act(() => result.current.setEntries([]));

    expect(result.current.toRequestValue()).toEqual([]);
  });

  it('keeps only the preserved entries when the configured ones are cleared', () => {
    const { result } = renderHook(() =>
      useApplicationAccess({ storedList: [FILES, POLICIES] }),
    );

    act(() => result.current.setEntries([]));

    expect(result.current.toRequestValue()).toEqual([POLICIES]);
  });

  it('is clean with nothing stored and nothing configured', () => {
    const { result } = renderHook(() => useApplicationAccess());

    expect(result.current.isDirty).toBe(false);
    expect(result.current.toRequestValue()).toBeUndefined();
  });

  it('reset discards the draft', () => {
    const { result } = renderHook(() =>
      useApplicationAccess({ storedList: [FILES] }),
    );

    act(() => result.current.setEntries([]));
    act(() => result.current.reset());

    expect(result.current.isDirty).toBe(false);
    expect(result.current.entries).toHaveLength(1);
  });

  it('reset with a list adopts it as the new baseline', () => {
    const { result } = renderHook(() => useApplicationAccess());

    act(() =>
      result.current.setEntries([
        { contentType: Type.Skills, accessLevel: Level.Read },
      ]),
    );
    const saved = result.current.toRequestValue();
    act(() => result.current.reset(saved));

    expect(result.current.isDirty).toBe(false);
    expect(result.current.toRequestValue()).toBeUndefined();
    expect(result.current.entries).toEqual([
      { contentType: Type.Skills, accessLevel: Level.Read },
    ]);
  });

  it('loads only the offered content types as editable', () => {
    const { result } = renderHook(() =>
      useApplicationAccess({
        storedList: [FILES],
        contentTypes: [Type.Prompts],
      }),
    );

    expect(result.current.entries).toEqual([]);
    expect(result.current.preserved).toHaveLength(1);
  });
});
