import {
  metrics,
  type BatchObservableCallback,
  type Meter,
} from '@opentelemetry/api';
import packageJson from '../../../package.json';
import { ManagedConfigState } from './managed-runtime.types';

/*
 * Attribute values are bounded: `instance` comes only from the deployment's
 * MANAGED_CONFIG_INSTANCES (at most 16), `outcome`, `state` and `result` are
 * fixed enums, and `key` is a registry key. No payload, value, role,
 * credential, revision ID or response body is ever recorded.
 */
export const MANAGED_CONFIG_INSTANCE_ATTRIBUTE = 'instance';
export const MANAGED_CONFIG_OUTCOME_ATTRIBUTE = 'outcome';
export const MANAGED_CONFIG_STATE_ATTRIBUTE = 'state';
export const MANAGED_CONFIG_KEY_ATTRIBUTE = 'key';
export const MANAGED_CONFIG_RESULT_ATTRIBUTE = 'result';

/** Up to the 5 s read deadline, plus room for a slow first byte. */
const REFRESH_DURATION_BOUNDARIES = [
  0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
];

/** What the instruments observe on each collection. */
export interface ManagedRuntimeObservation {
  readonly instanceId: string;
  readonly state: ManagedConfigState;
  /** Seconds since the last successful verification; absent without one. */
  readonly ageSeconds?: number;
}

/** The managed-configuration instruments of one runtime service. */
export interface ManagedRuntimeTelemetry {
  recordRefresh(instanceId: string, outcome: string, durationMs?: number): void;
  recordShadowComparison(instanceId: string, key: string, result: string): void;
  /** Removes the observable callbacks. */
  dispose(): void;
}

export const createManagedRuntimeTelemetry = (
  observe: () => readonly ManagedRuntimeObservation[],
  meter: Meter = metrics.getMeter('dial-chat-api', packageJson.version),
): ManagedRuntimeTelemetry => {
  const refresh = meter.createCounter('dial.chat.managed_config.refresh', {
    description:
      'Runtime reads of a Config Studio instance, by instance and bounded outcome.',
  });
  const duration = meter.createHistogram(
    'dial.chat.managed_config.refresh.duration',
    {
      description: 'Duration of one runtime read of a Config Studio instance.',
      unit: 's',
      advice: { explicitBucketBoundaries: REFRESH_DURATION_BOUNDARIES },
    },
  );
  const shadow = meter.createCounter(
    'dial.chat.managed_config.shadow.comparison',
    {
      description:
        'Shadow-mode comparisons of a managed key with its effective value, by bounded result.',
    },
  );
  const age = meter.createObservableGauge(
    'dial.chat.managed_config.snapshot.age',
    {
      description:
        'Seconds since the active snapshot of a Config Studio instance was last verified.',
      unit: 's',
    },
  );
  const state = meter.createObservableGauge('dial.chat.managed_config.state', {
    description:
      'The current managed state of a Config Studio instance: 1 for the current state, 0 for the others.',
  });

  const collect: BatchObservableCallback = (result) => {
    for (const observation of observe()) {
      const instance = {
        [MANAGED_CONFIG_INSTANCE_ATTRIBUTE]: observation.instanceId,
      };
      if (observation.ageSeconds != null) {
        result.observe(age, observation.ageSeconds, instance);
      }
      for (const candidate of Object.values(ManagedConfigState)) {
        result.observe(state, candidate === observation.state ? 1 : 0, {
          ...instance,
          [MANAGED_CONFIG_STATE_ATTRIBUTE]: candidate,
        });
      }
    }
  };
  meter.addBatchObservableCallback(collect, [age, state]);

  return {
    recordRefresh: (instanceId, outcome, durationMs) => {
      const attributes = {
        [MANAGED_CONFIG_INSTANCE_ATTRIBUTE]: instanceId,
        [MANAGED_CONFIG_OUTCOME_ATTRIBUTE]: outcome,
      };
      refresh.add(1, attributes);
      if (durationMs != null) duration.record(durationMs / 1000, attributes);
    },
    recordShadowComparison: (instanceId, key, result) => {
      shadow.add(1, {
        [MANAGED_CONFIG_INSTANCE_ATTRIBUTE]: instanceId,
        [MANAGED_CONFIG_KEY_ATTRIBUTE]: key,
        [MANAGED_CONFIG_RESULT_ATTRIBUTE]: result,
      });
    },
    dispose: () => meter.removeBatchObservableCallback(collect, [age, state]),
  };
};
