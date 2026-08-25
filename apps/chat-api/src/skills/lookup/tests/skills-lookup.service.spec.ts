import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../../config/environment.config';
import type { DialClientService } from '../../../dial/dial-client.service';
import { SkillsLookupService } from '../skills-lookup.service';

const makeService = (listSkillMetadataResult: unknown) => {
  const sdkClient = {
    listSkillMetadata: vi.fn().mockResolvedValue(listSkillMetadataResult),
  };
  const configService = {
    get: vi.fn().mockReturnValue(undefined),
  } as unknown as ConfigService<EnvironmentVariables>;
  const dialClient = {
    client: sdkClient,
    baseUrl: 'http://dial-core',
  } as unknown as DialClientService;
  const service = new SkillsLookupService(dialClient, configService);
  return { service, sdkClient };
};

describe('SkillsLookupService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves a well-formed skill URL via a targeted listSkillMetadata call', async () => {
    const { service, sdkClient } = makeService({
      error: undefined,
      response: { status: 200 },
      data: {
        bucket: 'my-bucket',
        name: 'docs-helper',
        nodeType: 'ITEM',
        parentPath: 'team-a/',
        etag: '"abc123"',
      },
    });

    const result = await service.resolveSkillItem(
      'skills/my-bucket/team-a/docs-helper',
      'token',
    );

    expect(result).toMatchObject({
      name: 'docs-helper',
      nodeType: 'item',
      etag: '"abc123"',
    });
    expect(sdkClient.listSkillMetadata).toHaveBeenCalledWith(
      'my-bucket',
      'team-a/docs-helper',
      expect.objectContaining({ headers: { Authorization: 'Bearer token' } }),
    );
  });

  it('returns null for an itemId that is not a well-formed skill URL', async () => {
    const { service, sdkClient } = makeService(undefined);
    const result = await service.resolveSkillItem(
      'applications/my-bucket/my-app',
      'token',
    );
    expect(result).toBeNull();
    expect(sdkClient.listSkillMetadata).not.toHaveBeenCalled();
  });

  it('returns null when DIAL Core reports 404', async () => {
    const { service } = makeService({
      error: true,
      response: { status: 404 },
      data: undefined,
    });
    const result = await service.resolveSkillItem(
      'skills/my-bucket/team-a/docs-helper',
      'token',
    );
    expect(result).toBeNull();
  });

  it('propagates an upstream 5xx as an exception', async () => {
    const { service } = makeService({
      error: true,
      response: { status: 502 },
      data: undefined,
    });
    await expect(
      service.resolveSkillItem('skills/my-bucket/team-a/docs-helper', 'token'),
    ).rejects.toThrow(BadGatewayException);
  });
});
