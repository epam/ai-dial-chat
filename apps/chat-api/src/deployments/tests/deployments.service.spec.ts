import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
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
  return new DeploymentsService(configService);
}

describe('DeploymentsService', () => {
  describe('getDeployments', () => {
    it('returns deployment list on success', async () => {
      const service = makeService();
      const deployments = [{ name: 'gpt-4' }];
      vi.spyOn(service['client'], 'getDeployments').mockResolvedValue(
        okResponse(deployments),
      );

      const result = await service.getDeployments('token');
      expect(result).toEqual(deployments);
    });

    it('forwards Authorization header', async () => {
      const service = makeService();
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
      const service = makeService();
      vi.spyOn(service['client'], 'getDeployments').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.getDeployments('token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws ForbiddenException on upstream 403', async () => {
      const service = makeService();
      vi.spyOn(service['client'], 'getDeployments').mockResolvedValue(
        errResponse(403),
      );
      await expect(service.getDeployments('token')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const service = makeService();
      vi.spyOn(service['client'], 'getDeployments').mockResolvedValue(
        errResponse(500),
      );
      await expect(service.getDeployments('token')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const service = makeService();
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
      const service = makeService();
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
      const service = makeService();
      vi.spyOn(service['client'], 'getDeployment').mockResolvedValue(
        errResponse(404),
      );
      await expect(service.getDeployment('unknown', 'token')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws UnauthorizedException on upstream 401', async () => {
      const service = makeService();
      vi.spyOn(service['client'], 'getDeployment').mockResolvedValue(
        errResponse(401),
      );
      await expect(service.getDeployment('gpt-4', 'token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadGatewayException on upstream 5xx', async () => {
      const service = makeService();
      vi.spyOn(service['client'], 'getDeployment').mockResolvedValue(
        errResponse(502),
      );
      await expect(service.getDeployment('gpt-4', 'token')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const service = makeService();
      vi.spyOn(service['client'], 'getDeployment').mockRejectedValue(
        new TypeError('fetch failed'),
      );
      await expect(service.getDeployment('gpt-4', 'token')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
