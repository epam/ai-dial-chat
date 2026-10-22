import {
  BadGatewayException,
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DeploymentsService } from '../../deployments/deployments.service';
import type { DialClientService } from '../../dial/dial-client.service';
import type { SkillsLookupService } from '../../skills/lookup/skills-lookup.service';
import type { ToolsetsService } from '../../toolsets/toolsets.service';
import { ShareInvitationService } from '../invitation/share-invitation.service';
import { ShareController } from '../share.controller';
import { ShareService } from '../share.service';

const makeInvitationService = () => {
  const dialClient = {
    client: { deleteInvitation: vi.fn() },
  } as unknown as DialClientService;
  const service = new ShareInvitationService(
    dialClient,
    {
      get: vi.fn(() => 'https://chat.example.com'),
    } as unknown as ConfigService<EnvironmentVariables, true>,
    {} as DeploymentsService,
    {} as ToolsetsService,
    {} as SkillsLookupService,
  );
  return { service, dialClient };
};

describe('ShareInvitationService.withdrawInvitation', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('withdraws the invitation with the session token', async () => {
    const { service, dialClient } = makeInvitationService();
    vi.mocked(dialClient.client.deleteInvitation).mockResolvedValue({
      data: undefined,
      response: { status: 200 },
    } as never);

    await service.withdrawInvitation('token', 'inv-1');

    expect(dialClient.client.deleteInvitation).toHaveBeenCalledWith('inv-1', {
      headers: { Authorization: 'Bearer token' },
    });
  });

  it('treats an invitation that is already gone as withdrawn', async () => {
    const { service, dialClient } = makeInvitationService();
    vi.mocked(dialClient.client.deleteInvitation).mockResolvedValue({
      error: {},
      response: { status: 404 },
    } as never);
    await expect(
      service.withdrawInvitation('token', 'inv-1'),
    ).resolves.toBeUndefined();
  });

  it('surfaces any other Core failure', async () => {
    const { service, dialClient } = makeInvitationService();
    vi.mocked(dialClient.client.deleteInvitation).mockResolvedValue({
      error: {},
      response: { status: 500 },
    } as never);
    await expect(
      service.withdrawInvitation('token', 'inv-1'),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});

describe('ShareController DELETE invitations/:invitationId (integration)', () => {
  let app: INestApplication;
  const withdrawInvitation = vi.fn();

  beforeEach(async () => {
    withdrawInvitation.mockReset().mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ShareController],
      providers: [{ provide: ShareService, useValue: { withdrawInvitation } }],
    }).compile();
    app = module.createNestApplication();
    app.use(
      (
        req: Express.Request & { user?: unknown },
        _res: unknown,
        next: () => void,
      ) => {
        req.user = { at: 'token', sub: 'u1', bucket: 'b1' };
        next();
      },
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('withdraws the invitation and answers 204', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/share/invitations/inv-1')
      .expect(204);
    expect(withdrawInvitation).toHaveBeenCalledWith('token', 'inv-1');
  });

  it('refuses an invitation id outside the allowed characters', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/share/invitations/..%2Fx')
      .expect(400);
    expect(withdrawInvitation).not.toHaveBeenCalled();
  });
});
