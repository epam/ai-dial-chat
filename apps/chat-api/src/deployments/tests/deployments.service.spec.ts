import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { EnvironmentVariables } from '../../config/environment.config';
import { DeploymentsService } from '../deployments.service';

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
        deployments as never,
      );

      const result = await service.getDeployments();
      expect(result).toEqual(deployments);
    });

    it('throws ServiceUnavailableException on network error', async () => {
      const service = makeService();
      vi.spyOn(service['client'], 'getDeployments').mockRejectedValue(
        new TypeError('fetch failed'),
      );

      await expect(service.getDeployments()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws BadGatewayException on unexpected error', async () => {
      const service = makeService();
      vi.spyOn(service['client'], 'getDeployments').mockRejectedValue({
        unexpected: true,
      });

      await expect(service.getDeployments()).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('getDeployment', () => {
    it('returns a single deployment on success', async () => {
      const service = makeService();
      const deployment = { name: 'gpt-4' };
      vi.spyOn(service['client'], 'getDeployment').mockResolvedValue(
        deployment as never,
      );

      const result = await service.getDeployment('gpt-4');
      expect(result).toEqual(deployment);
      expect(service['client'].getDeployment).toHaveBeenCalledWith('gpt-4');
    });

    it('throws NotFoundException on 404', async () => {
      const service = makeService();
      vi.spyOn(service['client'], 'getDeployment').mockRejectedValue({
        status: 404,
      });

      await expect(service.getDeployment('unknown')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
