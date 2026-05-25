import { afterEach, describe, expect, it, vi } from 'vitest';
import { rateApi } from '../api-client';
import { rateMessage } from '../rate.api';

describe('rateMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to the generated RateApi', async () => {
    const rateSpy = vi.spyOn(rateApi, 'rateMessage').mockResolvedValue();

    await rateMessage({
      conversationId: 'bucket/conv',
      responseId: 'msg-1',
      modelId: 'gpt-4o',
      rate: 1,
    });

    expect(rateSpy).toHaveBeenCalledWith({
      rateMessageDto: {
        conversationId: 'bucket/conv',
        responseId: 'msg-1',
        modelId: 'gpt-4o',
        rate: 1,
      },
    });
  });

  it('forwards optional comment when provided', async () => {
    const rateSpy = vi.spyOn(rateApi, 'rateMessage').mockResolvedValue();
    const body = {
      conversationId: 'bucket/conv',
      responseId: 'msg-1',
      modelId: 'gpt-4o',
      rate: -1 as const,
      comment: 'Very helpful',
    };

    await rateMessage(body);

    expect(rateSpy).toHaveBeenCalledWith({
      rateMessageDto: body,
    });
  });
});
