import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationsService } from '../../applications/applications.service';
import type { DialClientService } from '../../dial/dial-client.service';
import type { OrgUnitsService } from '../../org-units/org-units.service';
import type { ToolsetsListingService } from '../../toolsets/listing/toolsets-listing.service';
import type { ApplicationPublishPreparationService } from '../application-publish-preparation.service';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import { OrgUnitCopyErrorCode } from '../dto/org-unit-copy-error.dto';
import { OrgUnitCopyService } from '../org-unit-copy.service';

const ENTITY_ID = 'applications/b1/agent__1.0.0';
const conflictCode = (rejection: unknown): unknown => {
  const response = (rejection as ConflictException).getResponse();
  return typeof response === 'object'
    ? (response as { code?: unknown }).code
    : undefined;
};
const err = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

const STAGED_COPY = {
  id: 'applications/b1/.publish-staging/agent__1.0.0',
  resource: { bucket: 'b1', path: '.publish-staging/agent__1.0.0' },
};

const makeService = () => {
  const copyResource = vi.fn().mockResolvedValue({
    response: { status: 200 },
  });
  const getApplicationMetadata = vi
    .fn()
    .mockResolvedValue({ response: { status: 404 } });
  const getCustomApplication = vi
    .fn()
    .mockResolvedValue({ data: {}, response: { status: 200 } });
  const getToolSetMetadata = vi.fn();
  const getPromptMetadata = vi.fn();
  const listSkillMetadata = vi.fn();
  const getFileMetadata = vi.fn();
  const dialClient = {
    client: {
      copyResource,
      getApplicationMetadata,
      getCustomApplication,
      getToolSetMetadata,
      getPromptMetadata,
      listSkillMetadata,
      getFileMetadata,
    },
  } as unknown as DialClientService;
  const applicationsService = {
    resolveOwnApplication: vi
      .fn()
      .mockResolvedValue({ bucket: 'b1', path: 'agent__1.0.0' }),
    invalidateAfterWrite: vi.fn().mockResolvedValue(undefined),
  };
  const toolsetsListingService = {
    resolveToolsetResource: vi
      .fn()
      .mockResolvedValue({ bucket: 'b1', path: 'tools__1.0.0' }),
    invalidateCaches: vi.fn().mockResolvedValue(undefined),
  };
  const preparation = {
    plan: vi
      .fn()
      .mockResolvedValue({ dependencies: [], toCopy: [], targets: new Map() }),
    hasFolderInCopiedApplications: vi.fn().mockResolvedValue(false),
    stage: vi.fn().mockResolvedValue(STAGED_COPY),
    deleteCopy: vi.fn().mockResolvedValue(undefined),
  };
  const orgUnitsService = {
    findMissingWriteNamespaces: vi.fn().mockResolvedValue([]),
    isDialAdmin: vi.fn().mockResolvedValue(false),
  };
  const service = new OrgUnitCopyService(
    dialClient,
    applicationsService as unknown as ApplicationsService,
    toolsetsListingService as unknown as ToolsetsListingService,
    preparation as unknown as ApplicationPublishPreparationService,
    orgUnitsService as unknown as OrgUnitsService,
  );
  return {
    service,
    copyResource,
    getApplicationMetadata,
    getCustomApplication,
    getToolSetMetadata,
    getPromptMetadata,
    listSkillMetadata,
    getFileMetadata,
    preparation,
    orgUnitsService,
    applicationsService,
    toolsetsListingService,
  };
};

const copy = (
  service: OrgUnitCopyService,
  body: { folderPath: string; version?: string } = { folderPath: 'Acme' },
  entityType = CatalogEntityType.Application,
) =>
  service.copyIntoOrgUnit('user1', 'b1', 'token', entityType, ENTITY_ID, body);

describe('OrgUnitCopyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies an own application into the public org-unit folder and clears its caches', async () => {
    const { service, copyResource, applicationsService } = makeService();

    const result = await copy(service, { folderPath: 'Acme/US Risk' });

    expect(result).toEqual({
      id: 'applications/public/Acme/US%20Risk/agent__1.0.0',
    });
    expect(copyResource).toHaveBeenCalledWith({
      headers: { Authorization: 'Bearer token' },
      body: {
        sourceUrl: ENTITY_ID,
        destinationUrl: 'applications/public/Acme/US%20Risk/agent__1.0.0',
        overwrite: false,
      },
    });
    expect(applicationsService.resolveOwnApplication).toHaveBeenCalledWith(
      { Authorization: 'Bearer token' },
      ENTITY_ID,
      'b1',
    );
    expect(applicationsService.invalidateAfterWrite).toHaveBeenCalledWith(
      'user1',
      [ENTITY_ID, 'applications/public/Acme/US%20Risk/agent__1.0.0'],
      expect.any(String),
    );
  });

  it('rejects an entity outside the caller bucket and never calls Core', async () => {
    const { service, copyResource, applicationsService } = makeService();
    applicationsService.resolveOwnApplication.mockRejectedValue(
      new ForbiddenException(),
    );

    await expect(copy(service)).rejects.toBeInstanceOf(ForbiddenException);
    expect(copyResource).not.toHaveBeenCalled();
  });

  it.each([
    [403, ForbiddenException],
    [404, NotFoundException],
    [500, BadGatewayException],
  ])('maps a Core %i to %p and clears nothing', async (status, type) => {
    const { service, copyResource, applicationsService } = makeService();
    copyResource.mockResolvedValue(err(status));

    await expect(copy(service)).rejects.toBeInstanceOf(type);
    expect(applicationsService.invalidateAfterWrite).not.toHaveBeenCalled();
  });

  it("maps Core's own 409 to a conflict", async () => {
    const { service, copyResource, applicationsService } = makeService();
    copyResource.mockResolvedValue(err(409));

    await expect(copy(service)).rejects.toBeInstanceOf(ConflictException);
    expect(applicationsService.invalidateAfterWrite).not.toHaveBeenCalled();
  });

  it('reports an existing target as 409', async () => {
    const { service, copyResource, getApplicationMetadata } = makeService();
    copyResource.mockResolvedValue(err(400));
    getApplicationMetadata.mockResolvedValue({ response: { status: 200 } });

    await expect(copy(service)).rejects.toBeInstanceOf(ConflictException);
  });

  describe('publish mode (version)', () => {
    it('names an application copy like a publication of that version', async () => {
      const { service, copyResource } = makeService();

      const result = await copy(service, {
        folderPath: 'Delivery/Teams',
        version: '2.0',
      });

      expect(result).toEqual({
        id: 'applications/public/Delivery/Teams/agent__2.0',
      });
      expect(copyResource).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
        body: {
          sourceUrl: ENTITY_ID,
          destinationUrl: 'applications/public/Delivery/Teams/agent__2.0',
          overwrite: false,
        },
      });
    });

    it('keeps the stored name of a prompt, which has no version in its name', async () => {
      const { service, copyResource } = makeService();

      const result = await service.copyIntoOrgUnit(
        'user1',
        'b1',
        'token',
        CatalogEntityType.Prompt,
        'prompts/b1/Work/Summarize',
        { folderPath: 'Acme', version: '2.0' },
      );

      expect(result).toEqual({ id: 'prompts/public/Acme/Summarize' });
      expect(copyResource).toHaveBeenCalledOnce();
    });

    it('keeps an application name that has no version suffix', async () => {
      const { service, applicationsService } = makeService();
      applicationsService.resolveOwnApplication.mockResolvedValue({
        bucket: 'b1',
        path: 'plain',
      });

      const result = await copy(service, {
        folderPath: 'Acme',
        version: '2.0',
      });

      expect(result).toEqual({ id: 'applications/public/Acme/plain' });
    });

    it('gives the pre-check 409 the taken-target code', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue({
        dependencies: [{ id: 'skills/b1/Plan', name: 'Plan', type: 'skill' }],
        toCopy: [],
        targets: new Map(),
      });
      made.getApplicationMetadata.mockResolvedValue({
        response: { status: 200 },
      });

      const rejection = await copy(made.service, {
        folderPath: 'Acme',
        version: '2.0',
      }).catch((e: unknown) => e);

      expect(rejection).toBeInstanceOf(ConflictException);
      expect(conflictCode(rejection)).toBe('target-exists');
    });

    it('gives a Core 409 the code when a read of the target confirms it', async () => {
      const { service, copyResource, getApplicationMetadata } = makeService();
      copyResource.mockResolvedValue(err(409));
      getApplicationMetadata.mockResolvedValue({ response: { status: 200 } });

      const rejection = await copy(service).catch((e: unknown) => e);

      expect(conflictCode(rejection)).toBe('target-exists');
    });

    it('gives the 409 for an existing target the code in a plain copy too', async () => {
      const { service, copyResource, getApplicationMetadata } = makeService();
      copyResource.mockResolvedValue(err(400));
      getApplicationMetadata.mockResolvedValue({ response: { status: 200 } });

      const rejection = await copy(service).catch((e: unknown) => e);

      expect(conflictCode(rejection)).toBe('target-exists');
      /* The transfer already confirmed the target; no second probe follows. */
      expect(getApplicationMetadata).toHaveBeenCalledOnce();
    });

    it('derives the dependency folder, icon target and staged write from the versioned name', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue({
        dependencies: [{ id: 'skills/b1/Plan', name: 'Plan', type: 'skill' }],
        toCopy: [],
        targets: new Map(),
      });
      made.getCustomApplication.mockResolvedValue({
        data: { iconUrl: 'files/b1/icons/logo.png' },
        response: { status: 200 },
      });

      await copy(made.service, { folderPath: 'Acme/Teams', version: '2.0' });

      expect(made.preparation.plan).toHaveBeenCalledWith(
        'user1',
        'token',
        'b1',
        ENTITY_ID,
        'Acme/Teams',
        'agent__2.0',
        true,
      );
      const destinations = made.copyResource.mock.calls.map(
        ([call]) => call.body.destinationUrl as string,
      );
      expect(destinations).toEqual([
        'files/public/Acme/Teams/agent__2.0/logo.png',
        'applications/public/Acme/Teams/agent__2.0',
      ]);
    });
  });

  describe('toolsets', () => {
    const TOOLSET_ID = 'toolsets/b1/tools__1.0.0';
    const copyToolset = (
      service: OrgUnitCopyService,
      body: { folderPath: string } = {
        folderPath: 'Acme',
      },
    ) =>
      service.copyIntoOrgUnit(
        'user1',
        'b1',
        'token',
        CatalogEntityType.Toolset,
        TOOLSET_ID,
        body,
      );

    it('copies an own toolset into the public org-unit folder and clears its caches', async () => {
      const { service, copyResource, toolsetsListingService } = makeService();

      const result = await copyToolset(service, { folderPath: 'Acme/Teams' });

      expect(result).toEqual({ id: 'toolsets/public/Acme/Teams/tools__1.0.0' });
      expect(copyResource).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
        body: {
          sourceUrl: 'toolsets/b1/tools__1.0.0',
          destinationUrl: 'toolsets/public/Acme/Teams/tools__1.0.0',
          overwrite: false,
        },
      });
      expect(toolsetsListingService.invalidateCaches).toHaveBeenCalledWith(
        'user1',
        TOOLSET_ID,
      );
    });

    it('rejects a toolset outside the caller bucket and never calls Core', async () => {
      const { service, copyResource, toolsetsListingService } = makeService();
      toolsetsListingService.resolveToolsetResource.mockResolvedValue({
        bucket: 'other',
        path: 'tools__1.0.0',
      });

      await expect(copyToolset(service)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(copyResource).not.toHaveBeenCalled();
    });

    it('reports a repeated same-name copy as 409', async () => {
      const { service, copyResource, getToolSetMetadata } = makeService();
      copyResource.mockResolvedValue(err(400));
      getToolSetMetadata.mockResolvedValue({ response: { status: 200 } });

      await expect(copyToolset(service)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it("passes Core's 403 through and clears nothing", async () => {
      const { service, copyResource, toolsetsListingService } = makeService();
      copyResource.mockResolvedValue(err(403));

      await expect(copyToolset(service)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(toolsetsListingService.invalidateCaches).not.toHaveBeenCalled();
    });

    it('does not fail the copy when clearing the caches fails', async () => {
      const { service, toolsetsListingService } = makeService();
      toolsetsListingService.invalidateCaches.mockRejectedValue(
        new Error('redis down'),
      );

      await expect(copyToolset(service)).resolves.toEqual({
        id: 'toolsets/public/Acme/tools__1.0.0',
      });
    });
  });

  describe('prompts', () => {
    const PROMPT_ID = 'prompts/b1/Work/Summarize';
    const copyPrompt = (
      service: OrgUnitCopyService,
      entityId = PROMPT_ID,
      body: { folderPath: string } = {
        folderPath: 'Acme',
      },
    ) =>
      service.copyIntoOrgUnit(
        'user1',
        'b1',
        'token',
        CatalogEntityType.Prompt,
        entityId,
        body,
      );

    it('copies an own prompt into the public org-unit folder', async () => {
      const { service, copyResource } = makeService();

      const result = await copyPrompt(service);

      expect(result).toEqual({ id: 'prompts/public/Acme/Summarize' });
      expect(copyResource).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
        body: {
          sourceUrl: 'prompts/b1/Work/Summarize',
          destinationUrl: 'prompts/public/Acme/Summarize',
          overwrite: false,
        },
      });
    });

    it('rejects a prompt outside the caller bucket and never calls Core', async () => {
      const { service, copyResource } = makeService();

      await expect(
        copyPrompt(service, 'prompts/other/Work/Summarize'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(copyResource).not.toHaveBeenCalled();
    });

    it('rejects an id that is not a full prompt path', async () => {
      const { service, copyResource } = makeService();

      await expect(copyPrompt(service, 'Summarize')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(copyResource).not.toHaveBeenCalled();
    });

    it('reports a repeated same-name copy as 409', async () => {
      const { service, copyResource, getPromptMetadata } = makeService();
      copyResource.mockResolvedValue(err(400));
      getPromptMetadata.mockResolvedValue({ response: { status: 200 } });

      await expect(copyPrompt(service)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('skills', () => {
    const SKILL_ID = 'skills/b1/team-a/my-skill';
    const copySkill = (
      service: OrgUnitCopyService,
      entityId = SKILL_ID,
      body: { folderPath: string } = {
        folderPath: 'Acme',
      },
    ) =>
      service.copyIntoOrgUnit(
        'user1',
        'b1',
        'token',
        CatalogEntityType.Skill,
        entityId,
        body,
      );

    it('copies an own skill into the public org-unit folder', async () => {
      const { service, copyResource } = makeService();

      const result = await copySkill(service);

      expect(result).toEqual({ id: 'skills/public/Acme/my-skill' });
      expect(copyResource).toHaveBeenCalledWith({
        headers: { Authorization: 'Bearer token' },
        body: {
          sourceUrl: 'skills/b1/team-a/my-skill',
          destinationUrl: 'skills/public/Acme/my-skill',
          overwrite: false,
        },
      });
    });

    it('rejects a skill outside the caller bucket and never calls Core', async () => {
      const { service, copyResource } = makeService();

      await expect(
        copySkill(service, 'skills/other/my-skill'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(copyResource).not.toHaveBeenCalled();
    });

    it('rejects an id that is not a full skill path', async () => {
      const { service, copyResource } = makeService();

      await expect(copySkill(service, 'my-skill')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(copyResource).not.toHaveBeenCalled();
    });

    it('passes the 409 Core gives for a name equal to a unit folder name through', async () => {
      const { service, copyResource, listSkillMetadata } = makeService();
      copyResource.mockResolvedValue(err(409));
      listSkillMetadata.mockResolvedValue({ response: { status: 404 } });

      const rejection = await copySkill(service).catch((e: unknown) => e);

      expect(rejection).toBeInstanceOf(ConflictException);
      expect(conflictCode(rejection)).toBeUndefined();
    });

    it('reports a repeated same-name copy as 409', async () => {
      const { service, copyResource, listSkillMetadata } = makeService();
      copyResource.mockResolvedValue(err(400));
      listSkillMetadata.mockResolvedValue({ response: { status: 200 } });

      await expect(copySkill(service)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  it.each([CatalogEntityType.Project, CatalogEntityType.Model])(
    'answers 400 for the %s type, which has no org-unit copy',
    async (entityType) => {
      const { service, copyResource } = makeService();

      await expect(copy(service, undefined, entityType)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(copyResource).not.toHaveBeenCalled();
    },
  );

  describe('applications with dependencies and an icon', () => {
    const APP_TARGET = 'applications/public/Acme/Teams/agent__1.0.0';
    const ICON = 'files/b1/icons/logo.png';
    const ICON_TARGET = 'files/public/Acme/Teams/agent__1.0.0/logo.png';
    const dependency = (type: string, name: string) => ({
      dependency: { id: `${type}s/b1/${name}`, name, type },
      sourceUrl: `${type}s/b1/${name}`,
      targetUrl: `${type}s/public/Acme/Teams/.agent__1.0.0.deps/b1/${name}`,
    });
    const SKILL = dependency('skill', 'Plan');
    const PROMPT = dependency('prompt', 'Greeting');
    const TOOLSET = dependency('toolset', 'Tools');
    const APPLICATION = dependency('application', 'Helper');
    const planOf = (...toCopy: (typeof SKILL)[]) => ({
      dependencies: toCopy.map((item) => item.dependency),
      toCopy,
      targets: new Map(),
    });
    const run = (service: OrgUnitCopyService) =>
      copy(service, { folderPath: 'Acme/Teams' });
    const copied = (made: ReturnType<typeof makeService>) =>
      made.copyResource.mock.calls.map(
        ([call]) => call.body.destinationUrl as string,
      );

    it('copies the icon, each dependency and then the staged application, and deletes the staging copy', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(SKILL, PROMPT));
      made.getCustomApplication.mockResolvedValue({
        data: { iconUrl: ICON },
        response: { status: 200 },
      });

      const result = await run(made.service);

      expect(result).toEqual({ id: APP_TARGET });
      expect(copied(made)).toEqual([
        ICON_TARGET,
        SKILL.targetUrl,
        PROMPT.targetUrl,
        APP_TARGET,
      ]);
      expect(made.copyResource.mock.calls[3][0].body.sourceUrl).toBe(
        STAGED_COPY.id,
      );
      expect(made.preparation.stage).toHaveBeenCalledWith(
        'user1',
        'token',
        'b1',
        ENTITY_ID,
        expect.anything(),
        ICON_TARGET,
      );
      expect(made.preparation.deleteCopy).toHaveBeenCalledWith(
        'user1',
        'token',
        STAGED_COPY,
      );
      expect(
        made.orgUnitsService.findMissingWriteNamespaces,
      ).toHaveBeenCalledWith('user1', 'token', 'Acme/Teams', [
        'applications',
        'skills',
        'prompts',
        'files',
      ]);
    });

    it('reuses a dependency that is already there and still writes the application', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue({
        dependencies: [SKILL.dependency],
        toCopy: [],
        targets: new Map(),
      });

      await run(made.service);

      expect(copied(made)).toEqual([APP_TARGET]);
      expect(made.preparation.stage).toHaveBeenCalledTimes(1);
    });

    it('reuses a dependency whose target appeared since the plan and still writes the application', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(PROMPT));
      made.copyResource
        .mockResolvedValueOnce(err(409))
        .mockResolvedValue({ response: { status: 200 } });
      made.getPromptMetadata.mockResolvedValue({ response: { status: 200 } });

      await expect(run(made.service)).resolves.toEqual({ id: APP_TARGET });

      expect(copied(made)).toEqual([PROMPT.targetUrl, APP_TARGET]);
    });

    it('fails when a dependency copy conflicts with nothing at its target', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(PROMPT));
      made.copyResource.mockResolvedValueOnce(err(409));
      made.getPromptMetadata.mockResolvedValue({ response: { status: 404 } });

      await expect(run(made.service)).rejects.toBeInstanceOf(ConflictException);

      expect(copied(made)).toEqual([PROMPT.targetUrl]);
      expect(made.preparation.deleteCopy).toHaveBeenCalledOnce();
    });

    it('takes the single copy for an application without dependencies or icon', async () => {
      const made = makeService();

      await run(made.service);

      expect(copied(made)).toEqual([APP_TARGET]);
      expect(made.copyResource.mock.calls[0][0].body.sourceUrl).toBe(ENTITY_ID);
      expect(made.preparation.stage).not.toHaveBeenCalled();
      expect(
        made.orgUnitsService.findMissingWriteNamespaces,
      ).not.toHaveBeenCalled();
    });

    it('writes the application without an icon when files are not writable', async () => {
      const made = makeService();
      made.getCustomApplication.mockResolvedValue({
        data: { iconUrl: ICON },
        response: { status: 200 },
      });
      made.orgUnitsService.findMissingWriteNamespaces.mockResolvedValue([
        'files',
      ]);

      await expect(run(made.service)).resolves.toEqual({ id: APP_TARGET });

      expect(copied(made)).toEqual([APP_TARGET]);
      expect(made.preparation.stage.mock.calls[0][5]).toBeNull();
    });

    it('drops the icon and goes on when copying it fails', async () => {
      const made = makeService();
      made.getCustomApplication.mockResolvedValue({
        data: { iconUrl: ICON },
        response: { status: 200 },
      });
      made.copyResource
        .mockResolvedValueOnce(err(403))
        .mockResolvedValue({ response: { status: 200 } });

      await expect(run(made.service)).resolves.toEqual({ id: APP_TARGET });

      expect(made.preparation.stage.mock.calls[0][5]).toBeNull();
      expect(copied(made)).toEqual([ICON_TARGET, APP_TARGET]);
    });

    it('reuses an icon that is already there when its copy conflicts', async () => {
      const made = makeService();
      made.getCustomApplication.mockResolvedValue({
        data: { iconUrl: ICON },
        response: { status: 200 },
      });
      made.copyResource
        .mockResolvedValueOnce(err(409))
        .mockResolvedValue({ response: { status: 200 } });
      made.getFileMetadata.mockResolvedValue({ response: { status: 200 } });

      await expect(run(made.service)).resolves.toEqual({ id: APP_TARGET });

      expect(made.preparation.stage.mock.calls[0][5]).toBe(ICON_TARGET);
    });

    it('drops the icon when its copy conflicts with nothing at the target', async () => {
      const made = makeService();
      made.getCustomApplication.mockResolvedValue({
        data: { iconUrl: ICON },
        response: { status: 200 },
      });
      made.copyResource
        .mockResolvedValueOnce(err(409))
        .mockResolvedValue({ response: { status: 200 } });
      made.getFileMetadata.mockResolvedValue({ response: { status: 404 } });

      await expect(run(made.service)).resolves.toEqual({ id: APP_TARGET });

      expect(made.preparation.stage.mock.calls[0][5]).toBeNull();
    });

    it('answers 403 naming the namespace and copies nothing when a dependency namespace is missing', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(TOOLSET));
      made.orgUnitsService.findMissingWriteNamespaces.mockResolvedValue([
        'toolsets',
      ]);

      const failure = run(made.service);

      await expect(failure).rejects.toBeInstanceOf(ForbiddenException);
      await expect(failure).rejects.toThrow('toolsets');
      expect(made.copyResource).not.toHaveBeenCalled();
      expect(made.preparation.stage).not.toHaveBeenCalled();
    });

    it('plans strictly and writes nothing when the dependencies cannot be read', async () => {
      const made = makeService();
      made.preparation.plan.mockRejectedValue(
        new BadGatewayException('schema read failed'),
      );

      await expect(run(made.service)).rejects.toBeInstanceOf(
        BadGatewayException,
      );

      expect(made.preparation.plan.mock.calls[0][6]).toBe(true);
      expect(made.copyResource).not.toHaveBeenCalled();
      expect(made.preparation.stage).not.toHaveBeenCalled();
    });

    it('lets Core decide when the rights are unknown', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(SKILL));
      made.orgUnitsService.findMissingWriteNamespaces.mockResolvedValue(
        undefined,
      );

      await expect(run(made.service)).resolves.toEqual({ id: APP_TARGET });
      expect(copied(made)).toEqual([SKILL.targetUrl, APP_TARGET]);
    });

    it('stops at a failing dependency copy, keeps the earlier copies and deletes the staging copy', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(SKILL, TOOLSET));
      made.copyResource
        .mockResolvedValueOnce({ response: { status: 200 } })
        .mockResolvedValueOnce(err(403));

      await expect(run(made.service)).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      expect(copied(made)).toEqual([SKILL.targetUrl, TOOLSET.targetUrl]);
      expect(made.preparation.deleteCopy).toHaveBeenCalledTimes(1);
    });

    it('completes a retry: a dependency that now exists is reused', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(PROMPT, SKILL));
      made.copyResource
        .mockResolvedValueOnce(err(400))
        .mockResolvedValue({ response: { status: 200 } });
      made.getPromptMetadata.mockResolvedValue({ response: { status: 200 } });

      await expect(run(made.service)).resolves.toEqual({ id: APP_TARGET });

      expect(copied(made)).toEqual([
        PROMPT.targetUrl,
        SKILL.targetUrl,
        APP_TARGET,
      ]);
    });

    it('answers 409 before any copy when the application target already exists', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(SKILL));
      made.getCustomApplication.mockResolvedValue({
        data: { iconUrl: ICON },
        response: { status: 200 },
      });
      made.getApplicationMetadata.mockResolvedValue({
        response: { status: 200 },
      });

      await expect(run(made.service)).rejects.toBeInstanceOf(ConflictException);

      expect(made.getApplicationMetadata).toHaveBeenCalledWith(
        'public',
        'Acme/Teams/agent__1.0.0',
        expect.anything(),
      );
      expect(made.copyResource).not.toHaveBeenCalled();
      expect(made.preparation.stage).not.toHaveBeenCalled();
      expect(
        made.orgUnitsService.findMissingWriteNamespaces,
      ).not.toHaveBeenCalled();
    });

    it('answers 409 and deletes the staging copy when the target appears after the check', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(SKILL));
      made.getApplicationMetadata
        .mockResolvedValueOnce({ response: { status: 404 } })
        .mockResolvedValue({ response: { status: 200 } });
      made.copyResource
        .mockResolvedValueOnce({ response: { status: 200 } })
        .mockResolvedValueOnce(err(400));

      await expect(run(made.service)).rejects.toBeInstanceOf(ConflictException);
      expect(made.preparation.deleteCopy).toHaveBeenCalledOnce();
    });

    it('resolves the full application id from a bare name before planning and staging', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(SKILL));

      await made.service.copyIntoOrgUnit(
        'user1',
        'b1',
        'token',
        CatalogEntityType.Application,
        'agent__1.0.0',
        { folderPath: 'Acme/Teams' },
      );

      expect(made.preparation.plan.mock.calls[0][3]).toBe(ENTITY_ID);
      expect(made.preparation.stage.mock.calls[0][3]).toBe(ENTITY_ID);
      expect(made.getCustomApplication).toHaveBeenCalledWith(
        'b1',
        'agent__1.0.0',
        expect.anything(),
      );
      expect(copied(made)).toEqual([SKILL.targetUrl, APP_TARGET]);
    });

    it('deletes the staging copy when the check or the staging itself fails', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(SKILL));
      made.preparation.stage.mockRejectedValue(new ForbiddenException());

      await expect(run(made.service)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(made.copyResource).not.toHaveBeenCalled();
    });

    it('clears the caches of copied application and toolset dependencies only', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(
        planOf(APPLICATION, TOOLSET, SKILL),
      );

      await run(made.service);

      expect(
        made.applicationsService.invalidateAfterWrite,
      ).toHaveBeenCalledWith(
        'user1',
        [APPLICATION.dependency.id, APPLICATION.targetUrl],
        expect.any(String),
      );
      expect(made.toolsetsListingService.invalidateCaches).toHaveBeenCalledWith(
        'user1',
        TOOLSET.dependency.id,
      );
      expect(
        made.applicationsService.invalidateAfterWrite,
      ).toHaveBeenCalledTimes(2);
      expect(
        made.toolsetsListingService.invalidateCaches,
      ).toHaveBeenCalledTimes(1);
    });

    it('does not fail the response when clearing a dependency cache fails', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planOf(APPLICATION, TOOLSET));
      made.applicationsService.invalidateAfterWrite
        .mockResolvedValueOnce(undefined)
        .mockRejectedValue(new Error('redis down'));
      made.toolsetsListingService.invalidateCaches.mockRejectedValue(
        new Error('redis down'),
      );

      await expect(run(made.service)).resolves.toEqual({ id: APP_TARGET });
    });
  });
});

describe('OrgUnitCopyService folder reference', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const withFolderReference = (
    made: ReturnType<typeof makeService>,
    plan: Record<string, unknown> = {},
  ) =>
    made.preparation.plan.mockResolvedValue({
      dependencies: [],
      toCopy: [],
      targets: new Map(),
      hasFolderReference: true,
      ...plan,
    });
  const refusalOf = async (promise: Promise<unknown>) => {
    const rejection = await promise.then(
      () => undefined,
      (error: unknown) => error,
    );
    return rejection as UnprocessableEntityException;
  };

  it('refuses a folder-reference application for a caller who is not a DIAL admin, copying nothing', async () => {
    const made = makeService();
    withFolderReference(made);

    const refusal = await refusalOf(copy(made.service));

    expect(refusal).toBeInstanceOf(UnprocessableEntityException);
    expect(refusal.getResponse()).toMatchObject({
      statusCode: 422,
      code: OrgUnitCopyErrorCode.FolderReferenceNeedsRequest,
    });
    expect(made.orgUnitsService.isDialAdmin).toHaveBeenCalledWith(
      'user1',
      'token',
    );
    expect(made.copyResource).not.toHaveBeenCalled();
    expect(made.preparation.stage).not.toHaveBeenCalled();
    expect(made.getCustomApplication).not.toHaveBeenCalled();
    expect(
      made.orgUnitsService.findMissingWriteNamespaces,
    ).not.toHaveBeenCalled();
  });

  it('refuses before the single copy of an application whose only reference is the folder', async () => {
    const made = makeService();
    withFolderReference(made);

    await expect(copy(made.service)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );

    expect(made.copyResource).not.toHaveBeenCalled();
  });

  it('refuses before a taken-name or rights answer', async () => {
    const made = makeService();
    withFolderReference(made, {
      dependencies: [{ type: 'skill', id: 'skills/b1/Plan' }],
    });
    made.getApplicationMetadata.mockResolvedValue({
      response: { status: 200 },
    });
    made.orgUnitsService.findMissingWriteNamespaces.mockResolvedValue([
      'skills',
    ]);

    await expect(copy(made.service)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
  });

  it('lets a DIAL admin write a folder-reference application as before', async () => {
    const made = makeService();
    withFolderReference(made);
    made.orgUnitsService.isDialAdmin.mockResolvedValue(true);

    await expect(copy(made.service)).resolves.toEqual({
      id: 'applications/public/Acme/agent__1.0.0',
    });

    expect(made.copyResource).toHaveBeenCalledTimes(1);
  });

  it('leaves the answer to DIAL Core when the rights cannot be read or org units are off', async () => {
    const made = makeService();
    withFolderReference(made);
    made.orgUnitsService.isDialAdmin.mockResolvedValue(undefined);

    await expect(copy(made.service)).resolves.toEqual({
      id: 'applications/public/Acme/agent__1.0.0',
    });

    expect(made.copyResource).toHaveBeenCalledTimes(1);
  });

  it('does not ask for admin rights when the application refers to no folder', async () => {
    const made = makeService();

    await copy(made.service);

    expect(made.orgUnitsService.isDialAdmin).not.toHaveBeenCalled();
  });

  describe('a dependency that refers to a folder', () => {
    const planWith = (type: string, name: string) => {
      const item = {
        dependency: { id: `${type}s/b1/${name}`, name, type },
        sourceUrl: `${type}s/b1/${name}`,
        targetUrl: `${type}s/public/Acme/.agent__1.0.0.deps/b1/${name}`,
      };
      return {
        dependencies: [item.dependency],
        toCopy: [item],
        targets: new Map(),
        hasFolderReference: false,
      };
    };
    const withNestedFolder = (made: ReturnType<typeof makeService>) => {
      made.preparation.plan.mockResolvedValue(
        planWith('application', 'Helper'),
      );
      made.preparation.hasFolderInCopiedApplications.mockResolvedValue(true);
    };

    it('refuses a caller who is not a DIAL admin before anything is written', async () => {
      const made = makeService();
      withNestedFolder(made);

      const refusal = await refusalOf(copy(made.service));

      expect(refusal).toBeInstanceOf(UnprocessableEntityException);
      expect(refusal.getResponse()).toMatchObject({
        statusCode: 422,
        code: OrgUnitCopyErrorCode.FolderReferenceNeedsRequest,
      });
      expect(made.copyResource).not.toHaveBeenCalled();
      expect(made.preparation.stage).not.toHaveBeenCalled();
      expect(made.getCustomApplication).not.toHaveBeenCalled();
      expect(
        made.orgUnitsService.findMissingWriteNamespaces,
      ).not.toHaveBeenCalled();
    });

    it('lets a DIAL admin copy the application and its dependency without reading the dependency', async () => {
      const made = makeService();
      withNestedFolder(made);
      made.orgUnitsService.isDialAdmin.mockResolvedValue(true);

      await expect(copy(made.service)).resolves.toBeDefined();

      expect(
        made.preparation.hasFolderInCopiedApplications,
      ).not.toHaveBeenCalled();
      expect(made.preparation.stage).toHaveBeenCalledOnce();
    });

    it('leaves the answer to DIAL Core when the rights cannot be read', async () => {
      const made = makeService();
      withNestedFolder(made);
      made.orgUnitsService.isDialAdmin.mockResolvedValue(undefined);

      await expect(copy(made.service)).resolves.toBeDefined();

      expect(
        made.preparation.hasFolderInCopiedApplications,
      ).not.toHaveBeenCalled();
    });

    it('copies normally when no dependency refers to a folder and asks for admin rights once', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(
        planWith('application', 'Helper'),
      );

      await expect(copy(made.service)).resolves.toBeDefined();

      expect(made.orgUnitsService.isDialAdmin).toHaveBeenCalledOnce();
      expect(
        made.preparation.hasFolderInCopiedApplications,
      ).toHaveBeenCalledWith(
        'user1',
        'token',
        expect.objectContaining({
          toCopy: [
            expect.objectContaining({ sourceUrl: 'applications/b1/Helper' }),
          ],
        }),
      );
      expect(made.preparation.stage).toHaveBeenCalledOnce();
    });

    it('asks for admin rights once when the application and a dependency both qualify', async () => {
      const made = makeService();
      withFolderReference(made, {
        ...planWith('application', 'Helper'),
        hasFolderReference: true,
      });

      await refusalOf(copy(made.service));

      expect(made.orgUnitsService.isDialAdmin).toHaveBeenCalledOnce();
      expect(
        made.preparation.hasFolderInCopiedApplications,
      ).not.toHaveBeenCalled();
    });

    it('checks a plan that mixes a toolset with an application dependency', async () => {
      const made = makeService();
      const toolset = planWith('toolset', 'Tools');
      const application = planWith('application', 'Helper');
      made.preparation.plan.mockResolvedValue({
        ...application,
        dependencies: [...toolset.dependencies, ...application.dependencies],
        toCopy: [...toolset.toCopy, ...application.toCopy],
      });
      made.preparation.hasFolderInCopiedApplications.mockResolvedValue(true);

      await expect(refusalOf(copy(made.service))).resolves.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(made.orgUnitsService.isDialAdmin).toHaveBeenCalledOnce();
    });

    it('reads nothing when no application dependency is copied', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(planWith('toolset', 'Tools'));

      await copy(made.service);

      expect(made.orgUnitsService.isDialAdmin).not.toHaveBeenCalled();
      expect(
        made.preparation.hasFolderInCopiedApplications,
      ).not.toHaveBeenCalled();
    });

    it('fails and writes nothing when the dependency cannot be read', async () => {
      const made = makeService();
      made.preparation.plan.mockResolvedValue(
        planWith('application', 'Helper'),
      );
      made.preparation.hasFolderInCopiedApplications.mockRejectedValue(
        new Error('application read failed with status 403'),
      );

      await expect(copy(made.service)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );

      expect(made.copyResource).not.toHaveBeenCalled();
      expect(made.preparation.stage).not.toHaveBeenCalled();
    });
  });

  it('does not apply to other entity types', async () => {
    const made = makeService();
    withFolderReference(made);

    await copy(made.service, { folderPath: 'Acme' }, CatalogEntityType.Toolset);

    expect(made.preparation.plan).not.toHaveBeenCalled();
    expect(made.orgUnitsService.isDialAdmin).not.toHaveBeenCalled();
  });
});
