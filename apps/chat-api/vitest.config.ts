import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/chat-api',
  oxc: {
    decorator: {
      legacy: true,
      emitDecoratorMetadata: true,
    },
  },
  test: {
    watch: false,
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test-setup.ts'],
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    reporters: ['default'],
    /*
     * `npm exec nx test chat-api` (unlike a bare `vitest run`) auto-loads `apps/chat-api/.env`
     * (Nx's `NX_LOAD_DOT_ENV_FILES`). That file is a developer-machine-only, git-ignored config
     * for running the app locally against a real collector, and can legitimately contain
     * `OTEL_SDK_DISABLED=false` plus `OTEL_TRACES_EXPORTER`/`OTEL_METRICS_EXPORTER`/etc. When
     * those env vars are present, Vitest's own built-in OpenTelemetry test-run tracing
     * (https://vitest.dev/guide/open-telemetry) activates in every worker process and calls the
     * real `@opentelemetry/api` `setGlobal*` functions *before any spec's own `beforeAll` runs* —
     * so a spec that calls `metrics.setGlobalMeterProvider(...)` to install its own in-memory
     * provider finds the slot already taken and `registerGlobal()` silently no-ops (returns
     * `false`, only logs via `diag.error`), making `telemetry/tests/prometheus-endpoint.spec.ts`
     * (and any other spec under `telemetry/tests/` or `metrics.interceptor.spec.ts`) fail
     * nondeterministically depending on the developer's local `.env` contents. Reproduced via
     * `npm exec nx test chat-api`; confirmed by tracing `@opentelemetry/api`'s global registry
     * contents at the start of `prometheus-endpoint.spec.ts`'s `beforeAll` and by observing the
     * suite go green after temporarily removing `apps/chat-api/.env`.
     *
     * `test.env` overrides whatever the host process/Nx already loaded for every worker, so this
     * makes the suite deterministic regardless of what an individual developer's `.env` contains.
     */
    env: {
      OTEL_SDK_DISABLED: 'true',
    },
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
});
