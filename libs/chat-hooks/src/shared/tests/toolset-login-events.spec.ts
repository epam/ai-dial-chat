import { describe, expect, it, vi } from 'vitest';
import {
  emitToolsetLoginSuccess,
  subscribeToolsetLoginSuccess,
} from '../toolset-login-events';

describe('emitToolsetLoginSuccess / subscribeToolsetLoginSuccess', () => {
  it('delivers the detail payload to a subscribed listener', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToolsetLoginSuccess<string>(listener);

    emitToolsetLoginSuccess<string>({
      toolsetId: 'toolsets/bucket/x__1.0',
      credentialsLevel: 'user',
    });

    expect(listener).toHaveBeenCalledWith({
      toolsetId: 'toolsets/bucket/x__1.0',
      credentialsLevel: 'user',
    });
    unsubscribe();
  });

  it('stops delivering events once unsubscribed', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToolsetLoginSuccess<string>(listener);
    unsubscribe();

    emitToolsetLoginSuccess<string>({
      toolsetId: 'toolsets/bucket/x__1.0',
      credentialsLevel: 'global',
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('notifies multiple independent listeners', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribeFirst = subscribeToolsetLoginSuccess<string>(first);
    const unsubscribeSecond = subscribeToolsetLoginSuccess<string>(second);

    emitToolsetLoginSuccess<string>({
      toolsetId: 'toolsets/bucket/x__1.0',
      credentialsLevel: 'user',
    });

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
    unsubscribeFirst();
    unsubscribeSecond();
  });
});
