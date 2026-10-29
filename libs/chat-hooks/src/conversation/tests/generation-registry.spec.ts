import { describe, expect, it } from 'vitest';
import {
  ClientGenerationStatus,
  createGenerationRegistry,
} from '../generation-registry';

describe('generation registry', () => {
  it('aborts only the replaced active generation and ignores stale completion', () => {
    const registry = createGenerationRegistry();
    const old = registry.startGeneration('a%2Fb', 'old');
    const other = registry.startGeneration('a/b', 'other');
    const current = registry.startGeneration('a%2Fb', 'current');
    registry.completeGeneration('a%2Fb', 'old');
    expect(old.signal.aborted).toBe(true);
    expect(other.signal.aborted).toBe(false);
    expect(current.signal.aborted).toBe(false);
    expect(registry.getGeneration('a%2Fb')?.status).toBe(
      ClientGenerationStatus.Active,
    );
  });

  it('keeps independent instances and paths isolated', () => {
    const first = createGenerationRegistry();
    const second = createGenerationRegistry();
    expect(first.hasActiveGeneration()).toBe(false);
    expect(first.getGeneration('missing')).toBeUndefined();
    const controller = first.startGeneration('a', '1');
    second.startGeneration('a', '2');
    second.completeGeneration('a', '2');
    first.completeGeneration('missing', '1');
    expect(second.hasActiveGeneration()).toBe(false);
    expect(first.hasActiveGeneration()).toBe(true);
    expect(controller.signal.aborted).toBe(false);
  });

  it('does not abort a completed generation when replacing it', () => {
    const registry = createGenerationRegistry();
    const controller = registry.startGeneration('a', '1');
    registry.completeGeneration('a', '1');
    expect(registry.hasActiveGeneration()).toBe(false);
    expect(registry.getGeneration('a')?.status).toBe(
      ClientGenerationStatus.Done,
    );
    registry.startGeneration('a', '2');
    expect(controller.signal.aborted).toBe(false);
  });
});
