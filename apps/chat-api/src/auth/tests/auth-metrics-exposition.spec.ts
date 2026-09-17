import { metrics } from '@opentelemetry/api';
import { PrometheusSerializer } from '@opentelemetry/exporter-prometheus';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AuthProviderId } from '../providers/provider.types';

class TestMetricReader extends MetricReader {
  protected async onForceFlush(): Promise<void> {
    /* the serialized snapshot is produced from reader.collect() directly */
  }

  protected async onShutdown(): Promise<void> {
    /* this reader owns no external resources */
  }
}

/*
 * The Prometheus exporter's naming rules — dots to underscores, `_total` on counters,
 * `_bucket`/`_sum`/`_count` on histograms, and no unit suffix — are what the dashboard and
 * `docs/observability.md` promise. Asserting them against the real serializer keeps the
 * documented series names from drifting away from the instrument definitions. This is an
 * offline exposition check: it starts no HTTP listener and proves nothing about scraping.
 */
describe('auth metric exposition names', () => {
  let serialized: string;

  beforeAll(async () => {
    const reader = new TestMetricReader();
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));

    const authMetrics = await import('../auth-metrics');
    const provider = { 'dial.chat.auth.provider': AuthProviderId.Keycloak };

    authMetrics.authLoginStarted.add(1, provider);
    authMetrics.authRefreshCoalesced.add(1, provider);
    authMetrics.authCallbackDuration.record(0.2, {
      ...provider,
      'dial.chat.auth.outcome': authMetrics.AuthCallbackOutcome.Success,
    });
    authMetrics.authRefreshDuration.record(0.2, {
      ...provider,
      'dial.chat.auth.outcome': authMetrics.AuthRefreshOutcome.Refreshed,
    });
    authMetrics.authAuthorization.add(1, {
      'dial.chat.auth.source': 'cookie',
      'dial.chat.auth.outcome': authMetrics.AuthAuthorizationOutcome.Accepted,
      'dial.chat.auth.reason': authMetrics.AuthAuthorizationReason.Accepted,
    });
    authMetrics.authLogout.add(1, {
      'dial.chat.auth.result': authMetrics.AuthLogoutResult.CookieCleared,
      'dial.chat.auth.revocation': authMetrics.AuthLogoutRevocation.Success,
    });

    const { resourceMetrics } = await reader.collect();
    serialized = new PrometheusSerializer().serialize(resourceMetrics);
  });

  afterAll(() => {
    metrics.disable();
  });

  it('exports every series name the dashboard and observability doc query', () => {
    for (const series of [
      'dial_chat_auth_login_started_total',
      'dial_chat_auth_refresh_coalesced_total',
      'dial_chat_auth_authorization_total',
      'dial_chat_auth_logout_total',
      'dial_chat_auth_callback_duration_bucket',
      'dial_chat_auth_callback_duration_sum',
      'dial_chat_auth_callback_duration_count',
      'dial_chat_auth_refresh_duration_bucket',
      'dial_chat_auth_refresh_duration_sum',
      'dial_chat_auth_refresh_duration_count',
    ]) {
      expect(serialized).toContain(series);
    }
  });

  it('exports the underscored attribute names the queries filter on', () => {
    for (const label of [
      'dial_chat_auth_provider="keycloak"',
      'dial_chat_auth_outcome="success"',
      'dial_chat_auth_outcome="refreshed"',
      'dial_chat_auth_source="cookie"',
      'dial_chat_auth_reason="accepted"',
      'dial_chat_auth_result="cookie_cleared"',
      'dial_chat_auth_revocation="success"',
    ]) {
      expect(serialized).toContain(label);
    }
  });

  it('exposes the largest finite bucket the dashboard guard matches', () => {
    const buckets = serialized
      .split('\n')
      .filter((line) =>
        line.startsWith('dial_chat_auth_callback_duration_bucket'),
      );

    expect(
      buckets.some((line) => /le="60(\.0+)?"/.test(line)),
      `no 60s bucket in:\n${buckets.join('\n')}`,
    ).toBe(true);
  });

  it('adds no unit suffix to the duration histograms', () => {
    expect(serialized).not.toContain(
      'dial_chat_auth_callback_duration_seconds',
    );
    expect(serialized).not.toContain('dial_chat_auth_refresh_duration_seconds');
  });
});
