import {
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EnvironmentVariables } from '../../config/environment.config';
import type { DialClientService } from '../../dial/dial-client.service';
import type { UserConfigService } from '../../user-config/user-config.service';
import { ProjectsCreateService } from '../create/projects-create.service';
import { ProjectsService } from '../projects.service';
import type { ProjectsSnapshotService } from '../snapshot/projects-snapshot.service';

const USER_BUCKET = 'a1b2c3';
const PROJECT_ID = 'projects/a1b2c3/q4';
const config = {
  get: () => undefined,
} as unknown as ConfigService<EnvironmentVariables>;

const makeService = (
  result: unknown,
  removeProjectPin = vi.fn(async () => undefined),
) => {
  const deleteProjectFolder = vi.fn(async (..._args: unknown[]) => result);
  const service = new ProjectsService(
    { client: { deleteProjectFolder } } as unknown as DialClientService,
    new ProjectsCreateService(config),
    {} as ProjectsSnapshotService,
    { removeProjectPin } as unknown as UserConfigService,
  );
  return { service, deleteProjectFolder, removeProjectPin };
};

const deleted = { error: undefined, response: { status: 200 } };
const failed = (status: number) => ({
  error: { message: 'upstream' },
  response: { status },
});

describe('ProjectsService.deleteProject', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deletes with If-Match and removes the pin', async () => {
    const { service, deleteProjectFolder, removeProjectPin } =
      makeService(deleted);

    await service.deleteProject(PROJECT_ID, '"e1"', USER_BUCKET, 'token');

    const [bucket, path, init] = deleteProjectFolder.mock.calls[0] as [
      string,
      string,
      { headers: Record<string, string> },
    ];
    expect(bucket).toBe(USER_BUCKET);
    expect(path).toBe('q4');
    expect(init.headers['If-Match']).toBe('"e1"');
    expect(removeProjectPin).toHaveBeenCalledWith(
      PROJECT_ID,
      'token',
      USER_BUCKET,
    );
  });

  it('refuses a delete without If-Match before calling Core', async () => {
    const { service, deleteProjectFolder } = makeService(deleted);

    const error = await service
      .deleteProject(PROJECT_ID, undefined, USER_BUCKET, 'token')
      .catch((err: unknown) => err);

    expect((error as HttpException).getStatus()).toBe(428);
    expect((error as HttpException).getResponse()).toMatchObject({
      code: 'if-match-required',
    });
    expect(deleteProjectFolder).not.toHaveBeenCalled();
  });

  it.each(['*', '"e1", "e2"', '"e1","e2"'])(
    'treats If-Match %j as a missing precondition before calling Core',
    async (ifMatch) => {
      const { service, deleteProjectFolder } = makeService(deleted);

      const error = await service
        .deleteProject(PROJECT_ID, ifMatch, USER_BUCKET, 'token')
        .catch((err: unknown) => err);

      expect((error as HttpException).getStatus()).toBe(428);
      expect(deleteProjectFolder).not.toHaveBeenCalled();
    },
  );

  it('refuses a project outside the caller bucket before calling Core', async () => {
    const { service, deleteProjectFolder } = makeService(deleted);

    await expect(
      service.deleteProject(
        'projects/other-bucket/q4',
        '"e1"',
        USER_BUCKET,
        'token',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(deleteProjectFolder).not.toHaveBeenCalled();
  });

  it('maps a stale ETag to 409 project-changed and keeps the pin', async () => {
    const { service, removeProjectPin } = makeService(failed(412));

    const error = await service
      .deleteProject(PROJECT_ID, '"old"', USER_BUCKET, 'token')
      .catch((err: unknown) => err);

    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toMatchObject({
      code: 'project-changed',
    });
    expect(removeProjectPin).not.toHaveBeenCalled();
  });

  it('reports a missing project as not found', async () => {
    const { service } = makeService(failed(404));

    await expect(
      service.deleteProject(PROJECT_ID, '"e1"', USER_BUCKET, 'token'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('still succeeds when the pin cleanup fails', async () => {
    const { service } = makeService(
      deleted,
      vi.fn(async () => {
        throw new Error('config unavailable');
      }),
    );

    await expect(
      service.deleteProject(PROJECT_ID, '"e1"', USER_BUCKET, 'token'),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });
});
