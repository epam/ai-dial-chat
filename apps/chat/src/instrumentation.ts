export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // await import('./opentelemetryNew');
    // await import('./opentelemetryTraceProvider');
    // await import('./opentelemetryMetricsProvider');
    await import('./opentelemetry');
  }
}
