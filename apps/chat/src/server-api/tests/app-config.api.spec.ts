import { beforeEach, describe, expect, it, vi } from 'vitest';
import { appConfigApi } from '../api-client';
import { getClientConfig } from '../app-config.api';

vi.mock('../api-client', () => ({
  appConfigApi: {
    getClientConfig: vi.fn(),
  },
}));

describe('app-config API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the shared generated client and forwards the abort signal', async () => {
    const controller = new AbortController();
    vi.mocked(appConfigApi.getClientConfig).mockResolvedValue({
      appId: 'chat-ui',
      features: {},
      config: {
        asrModelId: null,
        transcribeSizeLimitBytes: 5 * 1024 * 1024,
        fileManagerTabs: ['my_files', 'shared', 'organization'],
        overlayEnabled: false,
        overlayAllowedOrigins: [],
      },
    });

    await getClientConfig(controller.signal);

    expect(appConfigApi.getClientConfig).toHaveBeenCalledWith(
      { appId: 'chat-ui' },
      { signal: controller.signal },
    );
  });
});
