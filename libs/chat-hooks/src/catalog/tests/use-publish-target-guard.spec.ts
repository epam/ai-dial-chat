import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublishTargetTakenError } from '../publish-target-taken';
import { usePublishTargetGuard } from '../use-publish-target-guard';

const setup = (taken: boolean) => {
  const checkPublishTarget = vi.fn().mockResolvedValue({ taken });
  const client = { checkPublishTarget };
  const getEntity = (item: { version?: string; id?: string }) =>
    item.id == null
      ? undefined
      : ({ entityType: 'application', entityId: item.id } as const);
  const view = renderHook(() => usePublishTargetGuard({ client, getEntity }));
  return { checkPublishTarget, guard: view.result, view };
};

describe('usePublishTargetGuard', () => {
  it('asks the backend about the joined folder path and the item version', async () => {
    const { checkPublishTarget, guard } = setup(true);

    await expect(
      guard.current.onCheckTargetExists(
        { id: 'applications/b/App__1.0.0', version: '2.0.0' },
        ['Acme', 'Team'],
      ),
    ).resolves.toBe(true);
    expect(checkPublishTarget).toHaveBeenCalledWith(
      'application',
      'applications/b/App__1.0.0',
      'Acme/Team',
      '2.0.0',
    );
  });

  it('sends no version for an unversioned item', async () => {
    const { checkPublishTarget, guard } = setup(false);

    await expect(
      guard.current.onCheckTargetExists({ id: 'applications/b/App__1.0.0' }, [
        'Acme',
      ]),
    ).resolves.toBe(false);
    expect(checkPublishTarget.mock.calls[0][3]).toBeUndefined();
  });

  it('is never taken for an item with no entity, and sends nothing', async () => {
    const { checkPublishTarget, guard } = setup(true);

    await expect(
      guard.current.onCheckTargetExists({ version: '1.0.0' }, ['Acme']),
    ).resolves.toBe(false);
    expect(checkPublishTarget).not.toHaveBeenCalled();
  });

  it('recognises only the error the wrapper throws', () => {
    const { guard } = setup(false);

    expect(
      guard.current.isTargetTakenError(new PublishTargetTakenError('x')),
    ).toBe(true);
    expect(guard.current.isTargetTakenError(new Error('x'))).toBe(false);
  });

  it('keeps one stable guard while its inputs do not change', () => {
    const { guard, view } = setup(false);
    const first = guard.current;

    view.rerender();

    expect(guard.current).toBe(first);
  });
});
