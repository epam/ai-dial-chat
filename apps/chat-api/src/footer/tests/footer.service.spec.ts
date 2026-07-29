import {
  BadGatewayException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import { FooterService } from '../footer.service';

function makeService(
  envOverrides: Partial<EnvironmentVariables> = {},
): FooterService {
  const configValues: Partial<EnvironmentVariables> = {
    AZURE_FUNCTIONS_API_HOST: 'https://functions.example.com',
    REQUEST_API_KEY_CODE: 'req-code',
    REPORT_ISSUE_CODE: 'issue-code',
    ...envOverrides,
  };

  const configService = {
    get: vi.fn((key: keyof EnvironmentVariables) => configValues[key]),
  };

  return new FooterService(configService as never);
}

const apiKeyBody = {
  project_id: 'My Project',
  project_stream: 'Stream A',
  project_lead: 'lead@example.com',
  business_reason: 'Need access.',
  project_end: '31/12/2025',
  access_scenario: 'Daily usage.',
  workload_pattern: 'Light load.',
};

const issueBody = {
  title: 'Something broken',
  description: 'Details here.',
};

describe('FooterService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestApiKey', () => {
    it('posts to the Azure Function and resolves when upstream returns 200', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200 }),
      );

      await expect(
        service.requestApiKey(apiKeyBody, 'user@example.com'),
      ).resolves.toBeUndefined();

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(url).toBe(
        'https://functions.example.com/api/request?code=req-code',
      );
      const sent = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(sent.requester_email).toBe('user@example.com');
      expect(sent.project_id).toBe('My Project');
    });

    it('throws ServiceUnavailableException when AZURE_FUNCTIONS_API_HOST is absent', async () => {
      const service = makeService({ AZURE_FUNCTIONS_API_HOST: undefined });

      await expect(
        service.requestApiKey(apiKeyBody, 'user@example.com'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when REQUEST_API_KEY_CODE is absent', async () => {
      const service = makeService({ REQUEST_API_KEY_CODE: undefined });

      await expect(
        service.requestApiKey(apiKeyBody, 'user@example.com'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws BadGatewayException when upstream fetch rejects', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('network failure')),
      );

      await expect(
        service.requestApiKey(apiKeyBody, 'user@example.com'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException when upstream returns non-2xx status', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 500 }),
      );

      await expect(
        service.requestApiKey(apiKeyBody, 'user@example.com'),
      ).rejects.toThrow(BadGatewayException);
    });
  });

  describe('reportIssue', () => {
    it('posts to the Azure Function and resolves when upstream returns 200', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: true, status: 200 }),
      );

      await expect(
        service.reportIssue(issueBody, 'user@example.com'),
      ).resolves.toBeUndefined();

      expect(fetch).toHaveBeenCalledOnce();
      const [url, init] = vi.mocked(fetch).mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(url).toBe(
        'https://functions.example.com/api/issue?code=issue-code',
      );
      const sent = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(sent.email).toBe('user@example.com');
      expect(sent.title).toBe('Something broken');
    });

    it('throws ServiceUnavailableException when AZURE_FUNCTIONS_API_HOST is absent', async () => {
      const service = makeService({ AZURE_FUNCTIONS_API_HOST: undefined });

      await expect(
        service.reportIssue(issueBody, 'user@example.com'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws ServiceUnavailableException when REPORT_ISSUE_CODE is absent', async () => {
      const service = makeService({ REPORT_ISSUE_CODE: undefined });

      await expect(
        service.reportIssue(issueBody, 'user@example.com'),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('throws BadGatewayException when upstream fetch rejects', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('network failure')),
      );

      await expect(
        service.reportIssue(issueBody, 'user@example.com'),
      ).rejects.toThrow(BadGatewayException);
    });

    it('throws BadGatewayException when upstream returns non-2xx status', async () => {
      const service = makeService();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({ ok: false, status: 503 }),
      );

      await expect(
        service.reportIssue(issueBody, 'user@example.com'),
      ).rejects.toThrow(BadGatewayException);
    });
  });
});
