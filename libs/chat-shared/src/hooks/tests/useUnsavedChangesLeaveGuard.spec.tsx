import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUnsavedChanges } from '../../components/UnsavedChangesProvider/unsaved-changes-context';
import { UnsavedChangesProvider } from '../../components/UnsavedChangesProvider/UnsavedChangesProvider';
import { useUnsavedChangesLeaveConfirmation } from '../useUnsavedChangesLeaveConfirmation';
import {
  useUnsavedChangesLeaveGuard,
  type UnsavedChangesLeaveGuardResult,
} from '../useUnsavedChangesLeaveGuard';

const Status: FC = () => {
  const { hasUnsavedChanges, requestDiscard } = useUnsavedChanges();
  return (
    <>
      <p>{hasUnsavedChanges ? 'dirty' : 'clean'}</p>
      <button type="button" onClick={() => requestDiscard(() => undefined)}>
        Log out
      </button>
    </>
  );
};

interface GuardedProps {
  isDirty: boolean;
  onReady: (guard: UnsavedChangesLeaveGuardResult) => void;
}

const Guarded: FC<GuardedProps> = ({ isDirty, onReady }) => {
  onReady(useUnsavedChangesLeaveGuard({ isDirty }));
  return null;
};

interface ConfirmingProps {
  isBlocked: boolean;
  onDiscard: () => void;
  onKeep: () => void;
}

const Confirming: FC<ConfirmingProps> = (props) => {
  useUnsavedChangesLeaveConfirmation(props);
  return null;
};

const renderGuard = (isDirty: boolean) => {
  let guard: UnsavedChangesLeaveGuardResult | undefined;
  const onReady = (next: UnsavedChangesLeaveGuardResult) => {
    guard = next;
  };
  const tree = (dirty: boolean) => (
    <UnsavedChangesProvider>
      <Status />
      <Guarded isDirty={dirty} onReady={onReady} />
    </UnsavedChangesProvider>
  );
  const utils = render(tree(isDirty));
  return {
    getGuard: () => guard as UnsavedChangesLeaveGuardResult,
    rerenderDirty: (next: boolean) => utils.rerender(tree(next)),
  };
};

const renderConfirmation = (isBlocked: boolean) => {
  const onDiscard = vi.fn();
  const onKeep = vi.fn();
  const tree = (blocked: boolean, isMounted: boolean) => (
    <UnsavedChangesProvider>
      <Status />
      {isMounted && (
        <Confirming isBlocked={blocked} onDiscard={onDiscard} onKeep={onKeep} />
      )}
    </UnsavedChangesProvider>
  );
  const utils = render(tree(isBlocked, true));
  return {
    onDiscard,
    onKeep,
    rerenderWith: (blocked: boolean, isMounted = true) =>
      utils.rerender(tree(blocked, isMounted)),
  };
};

const dispatchBeforeUnload = () => {
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  return event;
};

describe('useUnsavedChangesLeaveGuard', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throws a provider-naming error outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<Guarded isDirty onReady={() => undefined} />)).toThrow(
      /UnsavedChangesProvider/,
    );
  });

  it('registers the dirty state and clears it when the form turns clean', () => {
    const { rerenderDirty } = renderGuard(true);
    expect(screen.getByText('dirty')).toBeTruthy();

    rerenderDirty(false);

    expect(screen.getByText('clean')).toBeTruthy();
  });

  it('blocks a leaving transition only while dirty', () => {
    const { getGuard, rerenderDirty } = renderGuard(true);

    expect(getGuard().shouldBlockLeave(true)).toBe(true);
    expect(getGuard().shouldBlockLeave(false)).toBe(false);

    rerenderDirty(false);

    expect(getGuard().shouldBlockLeave(true)).toBe(false);
  });

  it('keeps both callbacks stable across renders', () => {
    const { getGuard, rerenderDirty } = renderGuard(true);
    const { shouldBlockLeave, allowNextNavigation } = getGuard();

    rerenderDirty(false);

    expect(getGuard().shouldBlockLeave).toBe(shouldBlockLeave);
    expect(getGuard().allowNextNavigation).toBe(allowNextNavigation);
  });

  it('lets exactly one transition through after allowNextNavigation', () => {
    const { getGuard } = renderGuard(true);

    getGuard().allowNextNavigation();

    expect(getGuard().shouldBlockLeave(true)).toBe(false);
    expect(getGuard().shouldBlockLeave(true)).toBe(true);
  });

  it('asks the browser to warn before unload only while dirty', () => {
    const { rerenderDirty } = renderGuard(true);
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true);

    rerenderDirty(false);

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
  });

  it('skips the unload warning once a confirmed discard allowed it', async () => {
    const user = userEvent.setup();
    renderGuard(true);

    await user.click(screen.getByRole('button', { name: 'Log out' }));
    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
  });
});

describe('useUnsavedChangesLeaveConfirmation', () => {
  it('opens no dialog while nothing is blocked', () => {
    renderConfirmation(false);

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('runs onDiscard once on Discard changes', async () => {
    const user = userEvent.setup();
    const { onDiscard, onKeep } = renderConfirmation(true);

    await user.click(screen.getByRole('button', { name: 'Discard changes' }));

    expect(onDiscard).toHaveBeenCalledOnce();
    expect(onKeep).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('runs onKeep once on Keep editing', async () => {
    const user = userEvent.setup();
    const { onDiscard, onKeep } = renderConfirmation(true);

    await user.click(screen.getByRole('button', { name: 'Keep editing' }));

    expect(onKeep).toHaveBeenCalledOnce();
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('closes its dialog unanswered once the transition is no longer blocked', () => {
    const { onDiscard, onKeep, rerenderWith } = renderConfirmation(true);
    expect(screen.getByRole('dialog')).toBeTruthy();

    rerenderWith(false);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onDiscard).not.toHaveBeenCalled();
    expect(onKeep).not.toHaveBeenCalled();
  });

  it('closes its dialog unanswered when the caller unmounts', () => {
    const { onKeep, rerenderWith } = renderConfirmation(true);

    rerenderWith(true, false);

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(onKeep).not.toHaveBeenCalled();
  });

  it('leaves a dialog opened by another request open', async () => {
    const user = userEvent.setup();
    const { rerenderWith } = renderConfirmation(false);
    await user.click(screen.getByRole('button', { name: 'Log out' }));

    rerenderWith(false, false);

    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
