import {
  PublishDependencyType,
  type PublishDependency,
} from '@epam/ai-dial-publish-panel';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  usePublishDependencies,
  type UsePublishDependenciesOptions,
} from '../use-publish-dependencies';

const dependency = (name: string): PublishDependency => ({
  id: `prompts/b/${name}`,
  name,
  type: PublishDependencyType.Prompt,
  location: '',
});
const deferred = <T>() => {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

const loadDependencies =
  vi.fn<UsePublishDependenciesOptions['loadDependencies']>();

const render = (isOpen: boolean, entityId = 'applications/b/a') =>
  renderHook(
    (props: { isOpen: boolean; entityId: string }) =>
      usePublishDependencies({ ...props, loadDependencies }),
    { initialProps: { isOpen, entityId } },
  );

describe('usePublishDependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the dependencies of the entity when the panel opens', async () => {
    loadDependencies.mockResolvedValue([dependency('Hi')]);

    const { result } = render(true);

    await waitFor(() => expect(result.current).toEqual([dependency('Hi')]));
    expect(loadDependencies).toHaveBeenCalledWith('applications/b/a');
  });

  it('does not read while the panel is closed', () => {
    render(false);

    expect(loadDependencies).not.toHaveBeenCalled();
  });

  it('reads again on every open, so a dependency published since drops off', async () => {
    loadDependencies
      .mockResolvedValueOnce([dependency('Old')])
      .mockResolvedValueOnce([]);
    const { result, rerender } = render(true);
    await waitFor(() => expect(result.current).toEqual([dependency('Old')]));

    rerender({ isOpen: false, entityId: 'applications/b/a' });
    rerender({ isOpen: true, entityId: 'applications/b/a' });

    await waitFor(() => expect(result.current).toEqual([]));
    expect(loadDependencies).toHaveBeenCalledTimes(2);
  });

  it('ignores a result that arrives after the entity changed', async () => {
    const first = deferred<PublishDependency[]>();
    loadDependencies
      .mockReturnValueOnce(first.promise)
      .mockResolvedValueOnce([dependency('Other')]);
    const { result, rerender } = render(true, 'applications/b/a');

    rerender({ isOpen: true, entityId: 'applications/b/other' });
    await waitFor(() => expect(result.current).toEqual([dependency('Other')]));
    await act(async () => first.resolve([dependency('Stale')]));

    expect(result.current).toEqual([dependency('Other')]);
  });

  it("never shows another entity's dependencies while the new entity's load", async () => {
    const second = deferred<PublishDependency[]>();
    loadDependencies
      .mockResolvedValueOnce([dependency('First')])
      .mockReturnValueOnce(second.promise);
    const { result, rerender } = render(true, 'applications/b/a');
    await waitFor(() => expect(result.current).toEqual([dependency('First')]));

    rerender({ isOpen: true, entityId: 'applications/b/other' });

    expect(result.current).toEqual([]);
    await act(async () => second.resolve([dependency('Second')]));
    expect(result.current).toEqual([dependency('Second')]);
  });

  it('shows an empty list when the read fails', async () => {
    loadDependencies.mockRejectedValue(new Error('offline'));

    const { result } = render(true);

    await waitFor(() => expect(loadDependencies).toHaveBeenCalledOnce());
    expect(result.current).toEqual([]);
  });

  it('returns the same empty array on every render until something loads', () => {
    const { result, rerender } = render(false);
    const first = result.current;

    rerender({ isOpen: false, entityId: 'applications/b/a' });

    expect(result.current).toBe(first);
  });
});
