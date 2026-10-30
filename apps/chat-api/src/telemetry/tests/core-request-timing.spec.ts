import { channel } from 'node:diagnostics_channel';
import { afterEach, describe, expect, it } from 'vitest';
import {
  initializeCoreRequestTiming,
  stopCoreRequestTiming,
  withCoreRequestTiming,
} from '../core-request-timing';
import {
  RequestTimingState,
  requestTimingStorage,
} from '../request-timing-state';

const created = channel('undici:request:create');
const completed = channel('undici:request:trailers');
const failed = channel('undici:request:error');

describe('Core wire timing', () => {
  afterEach(stopCoreRequestTiming);

  it('attributes the full transfer to its original request context', () => {
    initializeCoreRequestTiming();
    initializeCoreRequestTiming();
    let now = 0;
    const timing = new RequestTimingState(() => now);
    const unrelated = new RequestTimingState(() => now);
    const wireRequest = {};

    now = 100;
    requestTimingStorage.run(timing, () =>
      withCoreRequestTiming(() => {
        created.publish({ request: wireRequest });
        created.publish({ request: wireRequest });
      }),
    );
    now = 400;
    requestTimingStorage.run(unrelated, () =>
      completed.publish({ request: wireRequest }),
    );
    now = 500;

    expect(timing.settle()).toEqual({ total: 0.5, core: 0.3, chat: 0.2 });
    expect(unrelated.settle()).toEqual({ total: 0.5, core: 0, chat: 0.5 });
  });

  it('does not attribute other fetch traffic or work outside an HTTP request', () => {
    initializeCoreRequestTiming();
    let now = 0;
    const timing = new RequestTimingState(() => now);
    requestTimingStorage.run(timing, () => created.publish({ request: {} }));
    withCoreRequestTiming(() => created.publish({ request: {} }));
    now = 500;

    expect(timing.settle()).toEqual({ total: 0.5, core: 0, chat: 0.5 });
  });

  it('ends a failed transfer once even if another terminal message follows', () => {
    initializeCoreRequestTiming();
    let now = 0;
    const timing = new RequestTimingState(() => now);
    const wireRequest = {};
    now = 100;
    requestTimingStorage.run(timing, () =>
      withCoreRequestTiming(() => created.publish({ request: wireRequest })),
    );
    now = 200;
    failed.publish({ request: wireRequest });
    now = 300;
    completed.publish({ request: wireRequest });

    const result = timing.settle();
    expect(result.core).toBe(0.1);
    expect(result.chat).toBeCloseTo(0.2);
  });

  it('does not subscribe implicitly and releases subscribers on shutdown', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    const publish = () =>
      requestTimingStorage.run(timing, () =>
        withCoreRequestTiming(() => created.publish({ request: {} })),
      );
    publish();
    initializeCoreRequestTiming();
    stopCoreRequestTiming();
    publish();
    now = 500;

    expect(timing.settle()).toEqual({ total: 0.5, core: 0, chat: 0.5 });
  });

  it('preserves callback results and ignores malformed diagnostic messages', () => {
    initializeCoreRequestTiming();
    const timing = new RequestTimingState();
    const response = new Response('unaltered');
    expect(
      requestTimingStorage.run(timing, () =>
        withCoreRequestTiming(() => {
          created.publish(null);
          created.publish({ request: 'invalid' });
          completed.publish(undefined);
          return response;
        }),
      ),
    ).toBe(response);
    expect(timing.settle().core).toBe(0);
  });
});
