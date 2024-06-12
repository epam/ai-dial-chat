export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./opentelemetry');
    await import('./opentelemetryTraceProvider');
    await import('./opentelemetryMetricsProvider');
  }
}
