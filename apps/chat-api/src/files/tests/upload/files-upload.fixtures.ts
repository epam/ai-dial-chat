import type { ConfigService } from '@nestjs/config';
import { vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';

export type SdkClient = {
  uploadFile: ReturnType<typeof vi.fn>;
};

/** Mocked `ConfigService` and `DialClientService` for building `FilesUploadService`, shared by the upload and archive-upload specs. */
export const makeUploadServiceDeps = (
  configOverrides: Record<string, unknown> = {},
) => {
  const configService = {
    get: vi.fn((key: string) => {
      if (key in configOverrides) return configOverrides[key];
      if (key === 'DIAL_CORE_URL') return 'http://dial-core';
      if (key === 'FILE_TRANSFER_TIMEOUT_MS') return 30_000;
      return undefined;
    }),
  } as unknown as ConfigService<EnvironmentVariables>;

  const sdkClient: SdkClient = {
    uploadFile: vi.fn(),
  };
  const fetchCore = vi.fn();

  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
    dialApiVersion: '2024-10-21',
    fetchCore,
  } as unknown as DialClientService;

  return { configService, dialClient, sdkClient, fetchCore };
};

/** Drains an upload request body; `delayMs` simulates a slow consumer between chunks. */
export const readBody = async (
  body: unknown,
  delayMs = 0,
): Promise<Buffer> => {
  const reader = (body as ReadableStream<Uint8Array>).getReader();
  const parts: Buffer[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(Buffer.from(value));
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  return Buffer.concat(parts);
};
