import { channel } from 'node:diagnostics_channel';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RequestTimingState,
  requestTimingStorage,
} from '../request-timing-state';
import {
  initializeUpstreamRequestTiming,
  stopUpstreamRequestTiming,
  withAnalyticsRequestTiming,
  withCoreRequestTiming,
} from '../upstream-request-timing';

const created = channel('undici:request:create');
const completed = channel('undici:request:trailers');
const failed = channel('undici:request:error');

describe('upstream wire timing', () => {
  afterEach(stopUpstreamRequestTiming);

  it('attributes the full transfer to its original request context', () => {
    initializeUpstreamRequestTiming();
    initializeUpstreamRequestTiming();
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

    expect(timing.settle()).toEqual({
      total: 0.5,
      core: 0.3,
      analytics: 0,
      chat: 0.2,
    });
    expect(unrelated.settle()).toEqual({
      total: 0.5,
      core: 0,
      analytics: 0,
      chat: 0.5,
    });
  });

  it('does not attribute other fetch traffic or work outside an HTTP request', () => {
    initializeUpstreamRequestTiming();
    let now = 0;
    const timing = new RequestTimingState(() => now);
    requestTimingStorage.run(timing, () => created.publish({ request: {} }));
    withCoreRequestTiming(() => created.publish({ request: {} }));
    now = 500;

    expect(timing.settle()).toEqual({
      total: 0.5,
      core: 0,
      analytics: 0,
      chat: 0.5,
    });
  });

  it('ends a failed transfer once even if another terminal message follows', () => {
    initializeUpstreamRequestTiming();
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

  it('attributes an Analytics-marked transfer to Analytics only', () => {
    initializeUpstreamRequestTiming();
    let now = 0;
    const timing = new RequestTimingState(() => now);
    const wireRequest = {};
    now = 100;
    requestTimingStorage.run(timing, () =>
      withAnalyticsRequestTiming(() =>
        created.publish({ request: wireRequest }),
      ),
    );
    now = 350;
    completed.publish({ request: wireRequest });
    now = 500;

    expect(timing.settle()).toEqual({
      total: 0.5,
      core: 0,
      analytics: 0.25,
      chat: 0.25,
    });
  });

  it('ends an Analytics transfer on a request error, such as a cancelled body', () => {
    initializeUpstreamRequestTiming();
    let now = 0;
    const timing = new RequestTimingState(() => now);
    const wireRequest = {};
    now = 100;
    requestTimingStorage.run(timing, () =>
      withAnalyticsRequestTiming(() =>
        created.publish({ request: wireRequest }),
      ),
    );
    now = 150;
    failed.publish({ request: wireRequest });
    now = 500;

    const result = timing.settle();
    expect(result.analytics).toBeCloseTo(0.05);
    expect(result.chat).toBeCloseTo(0.45);
  });

  it('attributes a transfer to the innermost marker when markers nest', () => {
    initializeUpstreamRequestTiming();
    let now = 0;
    const timing = new RequestTimingState(() => now);
    const wireRequest = {};
    now = 100;
    requestTimingStorage.run(timing, () =>
      withCoreRequestTiming(() =>
        withAnalyticsRequestTiming(() =>
          created.publish({ request: wireRequest }),
        ),
      ),
    );
    now = 300;
    completed.publish({ request: wireRequest });
    now = 500;

    expect(timing.settle()).toEqual({
      total: 0.5,
      core: 0,
      analytics: 0.2,
      chat: 0.3,
    });
  });

  it('does not subscribe implicitly and releases subscribers on shutdown', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    const publish = () =>
      requestTimingStorage.run(timing, () =>
        withCoreRequestTiming(() => created.publish({ request: {} })),
      );
    publish();
    initializeUpstreamRequestTiming();
    stopUpstreamRequestTiming();
    publish();
    now = 500;

    expect(timing.settle()).toEqual({
      total: 0.5,
      core: 0,
      analytics: 0,
      chat: 0.5,
    });
  });

  it('preserves callback results and ignores malformed diagnostic messages', () => {
    initializeUpstreamRequestTiming();
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
