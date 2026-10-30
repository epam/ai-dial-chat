import type { Logger } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DialClientService } from '../../dial/dial-client.service';
import { ClientDataJsonFile } from '../client-data-json-file';

vi.mock('../../common/dial/dial-error.mapper', () => ({
  handleDialSdkError: vi.fn(),
}));

describe('ClientDataJsonFile.write', () => {
  it('logs at most the first 200 characters of a DIAL Core error body', async () => {
    const longBody = 'x'.repeat(5000);
    const dialClient = {
      client: {
        uploadFile: vi.fn().mockResolvedValue({
          error: 'boom',
          response: { status: 500, text: async () => longBody },
        }),
      },
    } as unknown as DialClientService;
    const logger = { error: vi.fn(), warn: vi.fn() } as unknown as Logger;

    await new ClientDataJsonFile(dialClient, logger, 'a file', 'ctx').write(
      '.client_data/.a.json',
      {},
      'token',
      'bucket',
    );

    const [message] = vi.mocked(logger.error).mock.calls[0] as [string];
    expect(message).toContain('DIAL Core 500');
    expect(message).toContain('x'.repeat(200));
    expect(message).not.toContain('x'.repeat(201));
  });
});
