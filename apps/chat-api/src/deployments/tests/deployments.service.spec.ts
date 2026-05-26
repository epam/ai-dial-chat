import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { DeploymentsService } from '../deployments.service';

const okResponse = (data: unknown) =>
  ({ data, response: {} as Response }) as never;

const errResponse = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

function makeService() {
  const configService = {
    get: vi.fn().mockReturnValue('http://dial-core'),
  } as unknown as ConfigService<EnvironmentVariables>;
  const cacheManager = {
    get: vi.fn().mockResolvedValue(undefined),
    set: vi.fn().mockResolvedValue(undefined),
  };
  const service = new DeploymentsService(configService, cacheManager as never);
  return { service, cacheManager };
}

describe('DeploymentsService', () => {
  describe('getDeployments', () => {
    it('returns deployment list on success', async () => {
      const { service } = makeService();
      const deployments = [{ name: 'gpt-4' }];
      vi.spyOn(service['client'], 'getDeployments').mockResolvedValue(
        okResponse(deployments),
      );

      const result = await service.getDeployments('token');
      expect(result).toEqual(deployments);
    });

    it('forwards Authorization header', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['client'], 'getDeployments')
        .mockResolvedValue(okResponse([]));

      await service.getDeployments('my-token');
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getDeployments').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.getDeployments('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getDeployments').mockResolvedValue(
        errResponse(403),
      );
      await expect(service.getDeployments('token')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getDeployments').mockResolvedValue(
        errResponse(500),
      );
      await expect(service.getDeployments('token')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getDeployments').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.getDeployments('token')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getDeployment', () => {
    it('returns a single deployment on success', async () => {
      const { service } = makeService();
      const deployment = { name: 'gpt-4' };
      const spy = vi
        .spyOn(service['client'], 'getDeployment')
        .mockResolvedValue(okResponse(deployment));

      const result = await service.getDeployment('gpt-4', 'token');
      expect(result).toEqual(deployment);
      expect(spy).toHaveBeenCalledWith(
        'gpt-4',
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer token' }),
        }),
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getDeployment').mockResolvedValue(
        errResponse(404),
      );
      await expect(service.getDeployment('unknown', 'token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getDeployment').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.getDeployment('gpt-4', 'token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getDeployment').mockResolvedValue(
        errResponse(502),
      );
      await expect(service.getDeployment('gpt-4', 'token')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'getDeployment').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.getDeployment('gpt-4', 'token')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('getDeploymentConfiguration', () => {
    const schema = { type: 'object', title: 'StatGPT Config', properties: {} };

    it('returns configuration schema from upstream on cache miss', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'configurationDeployment').mockResolvedValue(
        okResponse(schema),
      );

      const result = await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'token',
      );
      expect(result).toEqual(schema);
    });

    it('forwards Authorization header to DIAL Core', async () => {
      const { service } = makeService();
      const spy = vi
        .spyOn(service['client'], 'configurationDeployment')
        .mockResolvedValue(okResponse(schema));

      await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'my-token',
      );
      expect(spy).toHaveBeenCalledWith(
        'statgpt',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('returns cached value and skips upstream on cache hit', async () => {
      const { service, cacheManager } = makeService();
      cacheManager.get.mockResolvedValue(schema);
      const spy = vi.spyOn(service['client'], 'configurationDeployment');

      const result = await service.getDeploymentConfiguration(
        'statgpt',
        'user-123',
        'token',
      );
      expect(result).toEqual(schema);
      expect(spy).not.toHaveBeenCalled();
    });

    it('stores result in cache with 60 s TTL on success', async () => {
      const { service, cacheManager } = makeService();
      vi.spyOn(service['client'], 'configurationDeployment').mockResolvedValue(
        okResponse(schema),
      );

      await service.getDeploymentConfiguration('statgpt', 'user-123', 'token');
      expect(cacheManager.set).toHaveBeenCalledWith(
        'deployments:configuration:user-123:statgpt',
        schema,
        60 * 1000,
      );
    });

    it('throws NotFoundException on upstream 404', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'configurationDeployment').mockResolvedValue(
        errResponse(404),
      );
      await expect(
        service.getDeploymentConfiguration('unknown', 'user-123', 'token'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'configurationDeployment').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(
        service.getDeploymentConfiguration('statgpt', 'user-123', 'token'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const { service } = makeService();
      vi.spyOn(service['client'], 'configurationDeployment').mockResolvedValue(
        errResponse(502),
      );
      await expect(
        service.getDeploymentConfiguration('statgpt', 'user-123', 'token'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
