import { beforeEach, describe, expect, it, vi } from 'vitest';

import { allowEnterClick } from '@/src/utils/app/keyboard';

import { EnterType } from '@/src/types/settings';

const mocks = vi.hoisted(() => ({
  isTouchable: vi.fn(),
  isDesktopDevice: vi.fn(),
  isMacOs: vi.fn(),
}));

vi.mock('@/src/utils/app/mobile', () => mocks);

const enterEvent = (overrides: Partial<KeyboardEvent> = {}) =>
  ({
    key: 'Enter',
    keyCode: 13,
    isComposing: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ctrlKey: false,
    ...overrides,
  }) as KeyboardEvent;

describe('allowEnterClick', () => {
  beforeEach(() => {
    mocks.isTouchable.mockReturnValue(false);
    mocks.isDesktopDevice.mockReturnValue(true);
    mocks.isMacOs.mockReturnValue(false);
  });

  it('sends on Enter on a desktop without a touch screen', () => {
    expect(allowEnterClick(EnterType.Enter)(enterEvent())).toBe(true);
  });

  it('sends on Enter on a laptop with a touch screen', () => {
    mocks.isTouchable.mockReturnValue(true);
    mocks.isDesktopDevice.mockReturnValue(true);

    expect(allowEnterClick(EnterType.Enter)(enterEvent())).toBe(true);
  });

  it('does not send on Enter on a touch device that is not a desktop', () => {
    mocks.isTouchable.mockReturnValue(true);
    mocks.isDesktopDevice.mockReturnValue(false);

    expect(allowEnterClick(EnterType.Enter)(enterEvent())).toBe(false);
  });

  it('ignores keys other than Enter', () => {
    expect(allowEnterClick(EnterType.Enter)(enterEvent({ key: 'a' }))).toBe(
      false,
    );
  });

  it('does not send while an IME composition is active', () => {
    expect(
      allowEnterClick(EnterType.Enter)(enterEvent({ isComposing: true })),
    ).toBe(false);
    expect(allowEnterClick(EnterType.Enter)(enterEvent({ keyCode: 229 }))).toBe(
      false,
    );
  });

  it('does not send on Shift+Enter or Alt+Enter', () => {
    expect(
      allowEnterClick(EnterType.Enter)(enterEvent({ shiftKey: true })),
    ).toBe(false);
    expect(allowEnterClick(EnterType.Enter)(enterEvent({ altKey: true }))).toBe(
      false,
    );
  });

  describe('with the Ctrl+Enter shortcut', () => {
    it('requires Ctrl on a touch laptop', () => {
      mocks.isTouchable.mockReturnValue(true);

      expect(allowEnterClick(EnterType.CtrlEnter)(enterEvent())).toBe(false);
      expect(
        allowEnterClick(EnterType.CtrlEnter)(enterEvent({ ctrlKey: true })),
      ).toBe(true);
    });

    it('requires Cmd on a mac', () => {
      mocks.isMacOs.mockReturnValue(true);

      expect(
        allowEnterClick(EnterType.CtrlEnter)(enterEvent({ ctrlKey: true })),
      ).toBe(false);
      expect(
        allowEnterClick(EnterType.CtrlEnter)(enterEvent({ metaKey: true })),
      ).toBe(true);
    });
  });

  it('does not send plain Enter with a modifier when Enter is the shortcut', () => {
    expect(
      allowEnterClick(EnterType.Enter)(enterEvent({ ctrlKey: true })),
    ).toBe(false);
  });
});
