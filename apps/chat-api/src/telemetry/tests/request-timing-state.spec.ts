import { describe, expect, it } from 'vitest';
import {
  RequestTimingState,
  RequestTimingUpstream,
} from '../request-timing-state';

const { Core, Analytics } = RequestTimingUpstream;

describe('request timing arithmetic', () => {
  it('includes zero upstream time when the request makes no upstream calls', () => {
    let now = 100;
    const timing = new RequestTimingState(() => now);
    now = 350;

    expect(timing.settle()).toEqual({
      total: 0.25,
      core: 0,
      analytics: 0,
      chat: 0.25,
    });
  });

  it('counts overlapping Core calls once and includes gaps outside Core', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    now = 100;
    const endFirst = timing.startUpstreamCall(Core);
    now = 200;
    const endSecond = timing.startUpstreamCall(Core);
    now = 300;
    endFirst();
    now = 400;
    endSecond();
    now = 500;
    const endThird = timing.startUpstreamCall(Core);
    now = 600;
    endThird();
    now = 1000;

    expect(timing.settle()).toEqual({
      total: 1,
      core: 0.4,
      analytics: 0,
      chat: 0.6,
    });
  });

  it('attributes Analytics-only time to Analytics and not to Core', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    now = 100;
    const end = timing.startUpstreamCall(Analytics);
    now = 400;
    end();
    now = 500;

    expect(timing.settle()).toEqual({
      total: 0.5,
      core: 0,
      analytics: 0.3,
      chat: 0.2,
    });
  });

  it('counts overlapping Analytics calls once', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    now = 100;
    const endSchema = timing.startUpstreamCall(Analytics);
    now = 150;
    const endQuery = timing.startUpstreamCall(Analytics);
    now = 300;
    endSchema();
    now = 350;
    endQuery();
    now = 400;
    const endLast = timing.startUpstreamCall(Analytics);
    now = 450;
    endLast();
    now = 600;

    const snapshot = timing.settle();
    expect(snapshot.analytics).toBeCloseTo(0.3);
    expect(snapshot.core).toBe(0);
    expect(snapshot.chat).toBeCloseTo(0.3);
  });

  it('counts Core and Analytics overlap in both phases but subtracts it from chat once', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    now = 100;
    const endCore = timing.startUpstreamCall(Core);
    now = 200;
    const endAnalytics = timing.startUpstreamCall(Analytics);
    now = 300;
    endCore();
    now = 400;
    endAnalytics();
    now = 1000;

    const snapshot = timing.settle();
    expect(snapshot.core).toBeCloseTo(0.2);
    expect(snapshot.analytics).toBeCloseTo(0.2);
    /* The union is 100..400, so chat is 1 − 0.3, not 1 − 0.4. */
    expect(snapshot.chat).toBeCloseTo(0.7);
    expect(snapshot.core + snapshot.analytics + snapshot.chat).toBeGreaterThan(
      snapshot.total,
    );
  });

  it('never reports negative chat time or a phase above total when upstreams cover the whole request', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    timing.startUpstreamCall(Core);
    timing.startUpstreamCall(Analytics);
    now = 500;

    const snapshot = timing.settle();
    expect(snapshot).toEqual({
      total: 0.5,
      core: 0.5,
      analytics: 0.5,
      chat: 0,
    });
  });

  it('clips active Core calls and ignores work after the response settles', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    now = 100;
    const endFirst = timing.startUpstreamCall(Core);
    now = 250;
    const endSecond = timing.startUpstreamCall(Core);
    now = 500;
    const snapshot = timing.settle();
    expect(snapshot.total).toBe(0.5);
    expect(snapshot.core).toBe(0.4);
    expect(snapshot.chat).toBeCloseTo(0.1);

    now = 1000;
    endFirst();
    endSecond();
    timing.startUpstreamCall(Core)();
    expect(timing.settle()).toBe(snapshot);
  });

  it('clips an unfinished Analytics call at settlement and ignores its later end', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    now = 200;
    const end = timing.startUpstreamCall(Analytics);
    now = 500;
    const snapshot = timing.settle();
    expect(snapshot.analytics).toBeCloseTo(0.3);
    expect(snapshot.chat).toBeCloseTo(0.2);

    now = 2000;
    end();
    expect(timing.settle()).toBe(snapshot);
    expect(snapshot.analytics).toBeCloseTo(0.3);
  });

  it('stops accruing Analytics time once a failed call ends before settlement', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    now = 100;
    const end = timing.startUpstreamCall(Analytics);
    /* The error body is cancelled here; local error mapping continues. */
    now = 150;
    end();
    now = 900;

    expect(timing.settle()).toEqual({
      total: 0.9,
      core: 0,
      analytics: 0.05,
      chat: 0.85,
    });
  });

  it('settles each upstream call at most once', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    now = 100;
    const end = timing.startUpstreamCall(Core);
    now = 200;
    end();
    now = 300;
    end();
    const endNext = timing.startUpstreamCall(Core);
    now = 400;
    endNext();
    now = 500;

    expect(timing.settle()).toEqual({
      total: 0.5,
      core: 0.2,
      analytics: 0,
      chat: 0.3,
    });
  });
});
