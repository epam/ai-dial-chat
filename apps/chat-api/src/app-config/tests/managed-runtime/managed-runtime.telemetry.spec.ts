import type { BatchObservableCallback, Meter } from '@opentelemetry/api';
import { describe, expect, it, vi } from 'vitest';
import { createManagedRuntimeTelemetry } from '../../managed-runtime/managed-runtime.telemetry';
import { ManagedConfigState } from '../../managed-runtime/managed-runtime.types';

const createFakeMeter = () => {
  const instruments = new Map<string, { add?: unknown; record?: unknown }>();
  const callbacks: BatchObservableCallback[] = [];
  const meter = {
    createCounter: vi.fn((name: string) => {
      const counter = { add: vi.fn() };
      instruments.set(name, counter);
      return counter;
    }),
    createHistogram: vi.fn((name: string) => {
      const histogram = { record: vi.fn() };
      instruments.set(name, histogram);
      return histogram;
    }),
    createObservableGauge: vi.fn((name: string) => ({ name })),
    addBatchObservableCallback: vi.fn((callback: BatchObservableCallback) => {
      callbacks.push(callback);
    }),
    removeBatchObservableCallback: vi.fn(),
  };
  return {
    meter: meter as unknown as Meter,
    raw: meter,
    instrument: (name: string) =>
      instruments.get(name) as {
        add: ReturnType<typeof vi.fn>;
        record: ReturnType<typeof vi.fn>;
      },
    collect: () => {
      const observed: [string, number, Record<string, string>][] = [];
      for (const callback of callbacks) {
        void callback({
          observe: (
            observable: { name?: string },
            value: number,
            attributes?: Record<string, string>,
          ) => {
            observed.push([observable.name ?? '', value, attributes ?? {}]);
          },
        } as never);
      }
      return observed;
    },
  };
};

describe('createManagedRuntimeTelemetry', () => {
  it('counts refreshes by instance and bounded outcome, with duration in seconds', () => {
    const fake = createFakeMeter();
    const telemetry = createManagedRuntimeTelemetry(() => [], fake.meter);

    telemetry.recordRefresh('chat-dev', 'rejected_invalid_payload', 250);

    expect(
      fake.instrument('dial.chat.managed_config.refresh').add,
    ).toHaveBeenCalledWith(1, {
      instance: 'chat-dev',
      outcome: 'rejected_invalid_payload',
    });
    expect(
      fake.instrument('dial.chat.managed_config.refresh.duration').record,
    ).toHaveBeenCalledWith(0.25, {
      instance: 'chat-dev',
      outcome: 'rejected_invalid_payload',
    });
  });

  it('counts a late response without a duration', () => {
    const fake = createFakeMeter();
    const telemetry = createManagedRuntimeTelemetry(() => [], fake.meter);

    telemetry.recordRefresh('chat-dev', 'late_discarded');

    expect(
      fake.instrument('dial.chat.managed_config.refresh.duration').record,
    ).not.toHaveBeenCalled();
  });

  it('observes snapshot age and a one-hot state per instance', () => {
    const fake = createFakeMeter();
    createManagedRuntimeTelemetry(
      () => [
        {
          instanceId: 'chat-dev',
          state: ManagedConfigState.Degraded,
          ageSeconds: 42,
        },
        { instanceId: 'launchpad-dev', state: ManagedConfigState.Unavailable },
      ],
      fake.meter,
    );

    const observed = fake.collect();

    expect(observed).toContainEqual([
      'dial.chat.managed_config.snapshot.age',
      42,
      { instance: 'chat-dev' },
    ]);
    expect(
      observed.filter(
        ([name, , attributes]) =>
          name === 'dial.chat.managed_config.snapshot.age' &&
          attributes['instance'] === 'launchpad-dev',
      ),
    ).toEqual([]);
    const states = observed.filter(
      ([name, , attributes]) =>
        name === 'dial.chat.managed_config.state' &&
        attributes['instance'] === 'chat-dev',
    );
    expect(states).toHaveLength(Object.values(ManagedConfigState).length);
    expect(
      states.filter(([, value]) => value === 1).map(([, , a]) => a['state']),
    ).toEqual(['degraded']);
  });

  it('labels only with instance, fixed values and registry keys', () => {
    const fake = createFakeMeter();
    const telemetry = createManagedRuntimeTelemetry(() => [], fake.meter);

    telemetry.recordShadowComparison(
      'chat-dev',
      'welcomeScreen.description',
      'differs',
    );

    expect(
      fake.instrument('dial.chat.managed_config.shadow.comparison').add,
    ).toHaveBeenCalledWith(1, {
      instance: 'chat-dev',
      key: 'welcomeScreen.description',
      result: 'differs',
    });
  });

  it('removes its observable callback on dispose', () => {
    const fake = createFakeMeter();
    createManagedRuntimeTelemetry(() => [], fake.meter).dispose();
    expect(fake.raw.removeBatchObservableCallback).toHaveBeenCalledTimes(1);
  });
});
