import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDeploymentChangeTracking } from '../useDeploymentChangeTracking';
describe('deployment change tracking', () => {
  it('treats a direct loaded conversation switch as restoration', () => {
    const onChange = vi.fn();
    const initialProps = {
      conversationId: 'a',
      selectedDeploymentId: 'model-a' as string | null,
      isLoaded: true,
      onChange,
    };
    const { rerender } = renderHook(
      (props) => useDeploymentChangeTracking(props),
      { initialProps },
    );
    rerender({
      ...initialProps,
      conversationId: 'b',
      selectedDeploymentId: 'model-b',
    });
    expect(onChange).not.toHaveBeenCalled();
    rerender({
      ...initialProps,
      conversationId: 'b',
      selectedDeploymentId: 'model-c',
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith('model-b', 'model-c');
  });
  it('ignores initial restore, equality, unloaded changes and null selections', () => {
    const onChange = vi.fn();
    const initialProps = {
      conversationId: 'a' as string | undefined,
      selectedDeploymentId: 'one' as string | null,
      isLoaded: false,
      onChange,
    };
    const { rerender } = renderHook(
      (props) => useDeploymentChangeTracking(props),
      { initialProps },
    );
    rerender({ ...initialProps, selectedDeploymentId: 'two', isLoaded: true });
    rerender({ ...initialProps, selectedDeploymentId: 'two', isLoaded: true });
    rerender({ ...initialProps, selectedDeploymentId: null, isLoaded: true });
    expect(onChange).not.toHaveBeenCalled();
    rerender({
      ...initialProps,
      selectedDeploymentId: 'three',
      isLoaded: true,
    });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(null, 'three');
    onChange.mockClear();
    rerender({ ...initialProps, isLoaded: false });
    rerender({
      ...initialProps,
      selectedDeploymentId: 'restored',
      isLoaded: true,
    });
    rerender({ ...initialProps, conversationId: undefined, isLoaded: true });
    expect(onChange).not.toHaveBeenCalled();
  });
});
