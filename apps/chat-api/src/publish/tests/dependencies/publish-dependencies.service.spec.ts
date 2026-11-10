import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublishDependenciesService } from '../../dependencies/publish-dependencies.service';
import { CatalogEntityType } from '../../dto/catalog-entity-params.dto';
import { ResourceDependencyType } from '../../dto/resource-dependency.dto';

const DEPENDENCY = {
  id: 'prompts/b/Hi',
  name: 'Hi',
  type: ResourceDependencyType.Prompt,
  location: '',
};

describe('PublishDependenciesService', () => {
  let resolve: ReturnType<typeof vi.fn>;
  let service: PublishDependenciesService;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resolve = vi.fn().mockResolvedValue([DEPENDENCY]);
    service = new PublishDependenciesService({ resolve } as never);
    warn = vi.spyOn(Logger.prototype, 'warn').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the application resolver result for an application', async () => {
    const result = await service.getDependencies(
      'secret-token',
      'user-1',
      CatalogEntityType.Application,
      'applications/b/App__1.0.0',
    );

    expect(result).toEqual({ dependencies: [DEPENDENCY] });
    expect(resolve).toHaveBeenCalledWith(
      { accessToken: 'secret-token', userSub: 'user-1' },
      'applications/b/App__1.0.0',
    );
  });

  it.each([
    CatalogEntityType.Toolset,
    CatalogEntityType.Prompt,
    CatalogEntityType.Skill,
    CatalogEntityType.Project,
    CatalogEntityType.Model,
  ])(
    'returns an empty list for a %s without any upstream call',
    async (type) => {
      const result = await service.getDependencies('t', 'u', type, 'x/b/y');

      expect(result).toEqual({ dependencies: [] });
      expect(resolve).not.toHaveBeenCalled();
    },
  );

  it('returns an empty list and logs a warning without the token when the resolver fails', async () => {
    resolve.mockRejectedValue(
      new Error('application read failed with status 500'),
    );

    const result = await service.getDependencies(
      'secret-token',
      'user-1',
      CatalogEntityType.Application,
      'applications/b/App__1.0.0',
    );

    expect(result).toEqual({ dependencies: [] });
    expect(warn).toHaveBeenCalledOnce();
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain('status 500');
    expect(message).not.toContain('secret-token');
  });

  it('returns an empty list when the schema fetch rejects with a non-error value', async () => {
    resolve.mockRejectedValue('boom');

    const result = await service.getDependencies(
      't',
      'u',
      CatalogEntityType.Application,
      'applications/b/App__1.0.0',
    );

    expect(result).toEqual({ dependencies: [] });
    expect(warn).toHaveBeenCalledOnce();
  });
});
