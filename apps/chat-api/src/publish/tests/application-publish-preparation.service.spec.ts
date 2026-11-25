import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationSchemasService } from '../../application-schemas/application-schemas.service';
import type { ApplicationsService } from '../../applications/applications.service';
import type { DialClientService } from '../../dial/dial-client.service';
import type { ApplicationPublishCopyService } from '../application-publish-copy.service';
import {
  ApplicationPublishPreparationService,
  type ApplicationDependencyPlan,
} from '../application-publish-preparation.service';
import { PublishDependenciesService } from '../dependencies/publish-dependencies.service';
import { ResourceDependencyType } from '../dto/resource-dependency.dto';

const BUCKET = 'bucket-123';
const ENTITY_ID = `applications/${BUCKET}/Design/Helper__1.0.0`;
const COPY = {
  id: `applications/${BUCKET}/Design/.publish-staging/Helper__1.0.0`,
  resource: { bucket: BUCKET, path: 'Design/.publish-staging/Helper__1.0.0' },
};
const SCHEMA = { $id: 'schema-1' };

const dependency = (type: ResourceDependencyType, id: string) => ({
  id,
  name: id.split('/').pop() as string,
  type,
  isPrivate: true,
});

const SKILL = dependency(ResourceDependencyType.Skill, `skills/${BUCKET}/Plan`);
const PROMPT = dependency(
  ResourceDependencyType.Prompt,
  `prompts/${BUCKET}/Greeting`,
);
const FOREIGN = dependency(
  ResourceDependencyType.Prompt,
  'prompts/other-bucket/Greeting',
);
const FILE = dependency(ResourceDependencyType.File, `files/${BUCKET}/a.txt`);
const FOLDER = dependency(
  ResourceDependencyType.File,
  `files/${BUCKET}/Helper__1.0.0/`,
);
const FOREIGN_FOLDER = dependency(
  ResourceDependencyType.File,
  'files/other-bucket/Shared/',
);

const SKILL_TARGET = `skills/public/Teams/.Helper__1.0.0.deps/${BUCKET}/Plan`;
const PROMPT_TARGET = `prompts/public/Teams/.Helper__1.0.0.deps/${BUCKET}/Greeting`;

const makeService = (
  found: unknown[],
  existing: Record<string, boolean> = {},
) => {
  const client = {
    getSkillMetadata: vi.fn(),
    listSkillMetadata: vi.fn().mockImplementation(async (_b, path: string) => ({
      response: { status: existing[`skills/public/${path}`] ? 200 : 404 },
    })),
    getPromptMetadata: vi.fn().mockImplementation(async (_b, path: string) => ({
      response: { status: existing[`prompts/public/${path}`] ? 200 : 404 },
    })),
  };
  const dependenciesService = {
    getDependencies: vi.fn().mockResolvedValue({ dependencies: found }),
    getDependenciesStrict: vi.fn().mockResolvedValue({ dependencies: found }),
  };
  const copyService = {
    create: vi.fn().mockImplementation(async (_s, _t, _o, rewrite) => {
      await rewrite({
        application_type_schema_id: 'schema-1',
        application_properties: { skill: SKILL.id },
        iconUrl: `files/${BUCKET}/icon.png`,
      });
      return COPY;
    }),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  const applicationsService = {
    resolveOwnApplication: vi
      .fn()
      .mockResolvedValue({ bucket: BUCKET, path: 'Design/Helper__1.0.0' }),
  };
  const schemasService = {
    getApplicationSchema: vi.fn().mockResolvedValue(SCHEMA),
  };
  const service = new ApplicationPublishPreparationService(
    { client } as unknown as DialClientService,
    dependenciesService as unknown as PublishDependenciesService,
    copyService as unknown as ApplicationPublishCopyService,
    applicationsService as unknown as ApplicationsService,
    schemasService as unknown as ApplicationSchemasService,
  );
  return { service, copyService, dependenciesService, applicationsService };
};

const prepareArgs = ['user-1', 'token', BUCKET, ENTITY_ID, 'Teams'] as const;

describe('ApplicationPublishPreparationService', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('plan', () => {
    it('keeps own non-file dependencies, targets each one and marks existing targets', async () => {
      const { service } = makeService([SKILL, PROMPT, FOREIGN, FILE], {
        [PROMPT_TARGET]: true,
      });

      const plan = await service.plan(...prepareArgs, 'Helper__1.0.0');

      expect(plan?.dependencies).toEqual([SKILL, PROMPT]);
      expect(plan?.toCopy).toEqual([
        { dependency: SKILL, sourceUrl: SKILL.id, targetUrl: SKILL_TARGET },
      ]);
      expect([...(plan?.targets ?? [])]).toEqual([
        [SKILL.id, SKILL_TARGET],
        [PROMPT.id, PROMPT_TARGET],
      ]);
    });

    it('returns an empty plan when nothing is publishable', async () => {
      const { service } = makeService([FOREIGN, FILE]);

      const plan = await service.plan(...prepareArgs, 'Helper__1.0.0');

      expect(plan).toEqual({
        dependencies: [],
        toCopy: [],
        targets: new Map(),
        hasFolderReference: false,
      });
    });

    it('reports a folder reference even when no other dependency is publishable', async () => {
      const { service } = makeService([FOLDER]);

      const plan = await service.plan(...prepareArgs, 'Helper__1.0.0');

      expect(plan?.hasFolderReference).toBe(true);
      expect(plan?.dependencies).toEqual([]);
    });

    it('reports a folder reference next to publishable dependencies and in another bucket', async () => {
      const { service } = makeService([SKILL, FOREIGN_FOLDER]);

      const plan = await service.plan(...prepareArgs, 'Helper__1.0.0');

      expect(plan?.hasFolderReference).toBe(true);
      expect(plan?.dependencies).toEqual([SKILL]);
    });

    it('does not report a plain file reference as a folder', async () => {
      const { service } = makeService([SKILL, FILE]);

      const plan = await service.plan(...prepareArgs, 'Helper__1.0.0');

      expect(plan?.hasFolderReference).toBe(false);
    });

    it("returns undefined for another user's application without reading anything", async () => {
      const { service, dependenciesService } = makeService([SKILL]);

      const plan = await service.plan(
        'user-1',
        'token',
        'someone-else',
        ENTITY_ID,
        'Teams',
        'Helper__1.0.0',
      );

      expect(plan).toBeUndefined();
      expect(dependenciesService.getDependencies).not.toHaveBeenCalled();
    });
  });

  describe('a dependency read that fails', () => {
    const failingResolver = () =>
      new PublishDependenciesService({
        resolve: vi.fn().mockRejectedValue(new Error('schema read failed')),
      } as never);
    const build = () => {
      const made = makeService([]);
      const service = new ApplicationPublishPreparationService(
        {
          client: {
            getPromptMetadata: vi.fn(),
            listSkillMetadata: vi.fn(),
          },
        } as unknown as DialClientService,
        failingResolver(),
        made.copyService as unknown as ApplicationPublishCopyService,
        made.applicationsService as unknown as ApplicationsService,
        {} as unknown as ApplicationSchemasService,
      );
      return { ...made, service };
    };

    it('is read as no dependencies on the publish path, which then publishes the application as it is', async () => {
      vi.spyOn(Logger.prototype, 'warn').mockReturnValue(undefined);
      const { service, copyService } = build();

      expect(
        await service.prepare(...prepareArgs, 'Helper__1.0.0'),
      ).toBeUndefined();
      expect(copyService.create).not.toHaveBeenCalled();
    });

    it('reaches the caller when the plan is strict', async () => {
      const { service, copyService } = build();

      await expect(
        service.plan(...prepareArgs, 'Helper__1.0.0', true),
      ).rejects.toThrow('schema read failed');
      expect(copyService.create).not.toHaveBeenCalled();
    });

    it('uses the strict read only when asked to', async () => {
      const { service, dependenciesService } = makeService([SKILL]);

      await service.plan(...prepareArgs, 'Helper__1.0.0');
      expect(dependenciesService.getDependenciesStrict).not.toHaveBeenCalled();

      await service.plan(...prepareArgs, 'Helper__1.0.0', true);
      expect(dependenciesService.getDependenciesStrict).toHaveBeenCalledTimes(
        1,
      );
    });
  });

  describe('stage', () => {
    it('rewrites the schema references to the plan targets and leaves the icon alone by default', async () => {
      const { service, copyService } = makeService([SKILL]);
      const plan = await service.plan(...prepareArgs, 'Helper__1.0.0');

      const copy = await service.stage(
        'user-1',
        'token',
        BUCKET,
        ENTITY_ID,
        plan as ApplicationDependencyPlan,
      );

      expect(copy).toBe(COPY);
      const rewrite = copyService.create.mock.calls[0][3];
      const body = await rewrite({
        application_type_schema_id: 'schema-1',
        application_properties: {},
        iconUrl: 'files/x',
      });
      expect(body.iconUrl).toBe('files/x');
    });

    it('sets the icon when given a url and removes it when given null', async () => {
      const { service, copyService } = makeService([]);
      const plan = (await service.plan(
        ...prepareArgs,
        'Helper__1.0.0',
      )) as ApplicationDependencyPlan;
      const source = { displayName: 'A', iconUrl: 'files/old', icon_url: 'x' };

      await service.stage(
        'u',
        't',
        BUCKET,
        ENTITY_ID,
        plan,
        'files/public/new',
      );
      await service.stage('u', 't', BUCKET, ENTITY_ID, plan, null);

      const setIcon = await copyService.create.mock.calls[0][3](source);
      const removeIcon = await copyService.create.mock.calls[1][3](source);
      expect(setIcon).toEqual({
        displayName: 'A',
        iconUrl: 'files/public/new',
      });
      expect(removeIcon).toEqual({ displayName: 'A' });
    });
  });

  describe('prepare', () => {
    it('returns what plan and stage produce when called separately', async () => {
      const { service } = makeService([SKILL, PROMPT], {
        [PROMPT_TARGET]: true,
      });

      const prepared = await service.prepare(...prepareArgs, 'Helper__1.0.0');
      const plan = (await service.plan(
        ...prepareArgs,
        'Helper__1.0.0',
      )) as ApplicationDependencyPlan;
      const copy = await service.stage(
        'user-1',
        'token',
        BUCKET,
        ENTITY_ID,
        plan,
      );

      expect(prepared).toEqual({
        copy,
        dependencyResources: [
          { action: 'ADD', sourceUrl: SKILL.id, targetUrl: SKILL_TARGET },
        ],
        publishedDependencies: [SKILL],
        reusedCount: 1,
      });
    });

    it('returns undefined without staging when there is no dependency', async () => {
      const { service, copyService, applicationsService } = makeService([
        FOREIGN,
      ]);

      expect(
        await service.prepare(...prepareArgs, 'Helper__1.0.0'),
      ).toBeUndefined();
      expect(copyService.create).not.toHaveBeenCalled();
      expect(applicationsService.resolveOwnApplication).not.toHaveBeenCalled();
    });

    it('cleanup deletes the staged copy', async () => {
      const { service, copyService } = makeService([SKILL]);
      const prepared = await service.prepare(...prepareArgs, 'Helper__1.0.0');
      if (prepared == null) throw new Error('expected a prepared publication');

      await service.cleanup('user-1', 'token', prepared);

      expect(copyService.delete).toHaveBeenCalledWith('user-1', 'token', COPY);
    });
  });
});
