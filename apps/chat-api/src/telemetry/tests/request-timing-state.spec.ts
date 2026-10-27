import { describe, expect, it } from 'vitest';
import { RequestTimingState } from '../request-timing-state';

describe('request timing arithmetic', () => {
  it('includes zero Core time when the request makes no Core calls', () => {
    let now = 100;
    const timing = new RequestTimingState(() => now);
    now = 350;

    expect(timing.settle()).toEqual({ total: 0.25, core: 0, chat: 0.25 });
  });

  it('counts overlapping Core calls once and includes gaps outside Core', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    now = 100;
    const endFirst = timing.startCoreCall();
    now = 200;
    const endSecond = timing.startCoreCall();
    now = 300;
    endFirst();
    now = 400;
    endSecond();
    now = 500;
    const endThird = timing.startCoreCall();
    now = 600;
    endThird();
    now = 1000;

    expect(timing.settle()).toEqual({ total: 1, core: 0.4, chat: 0.6 });
  });

  it('clips active Core calls and ignores work after the response settles', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    now = 100;
    const endFirst = timing.startCoreCall();
    now = 250;
    const endSecond = timing.startCoreCall();
    now = 500;
    const snapshot = timing.settle();
    expect(snapshot.total).toBe(0.5);
    expect(snapshot.core).toBe(0.4);
    expect(snapshot.chat).toBeCloseTo(0.1);

    now = 1000;
    endFirst();
    endSecond();
    timing.startCoreCall()();
    expect(timing.settle()).toBe(snapshot);
  });

  it('settles each Core call at most once', () => {
    let now = 0;
    const timing = new RequestTimingState(() => now);
    now = 100;
    const end = timing.startCoreCall();
    now = 200;
    end();
    now = 300;
    end();
    const endNext = timing.startCoreCall();
    now = 400;
    endNext();
    now = 500;

    expect(timing.settle()).toEqual({ total: 0.5, core: 0.2, chat: 0.3 });
  });
});
