import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplicationsService } from '../../applications/applications.service';
import type { DialClientService } from '../../dial/dial-client.service';
import type { ToolsetsListingService } from '../../toolsets/listing/toolsets-listing.service';
import { CatalogEntityType } from '../dto/catalog-entity-params.dto';
import { OrgUnitCopyService } from '../org-unit-copy.service';

const ENTITY_ID = 'applications/b1/agent__1.0.0';
const err = (status: number) =>
  ({ error: {}, response: { status } as Response }) as never;

const makeService = () => {
  const copyResource = vi.fn().mockResolvedValue({
    response: { status: 200 },
  });
  const getApplicationMetadata = vi.fn();
  const getToolSetMetadata = vi.fn();
  const getPromptMetadata = vi.fn();
  const listSkillMetadata = vi.fn();
  const dialClient = {
    client: {
      copyResource,
      getApplicationMetadata,
      getToolSetMetadata,
      getPromptMetadata,
      listSkillMetadata,
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
    getUserBucket: vi.fn().mockResolvedValue('b1'),
    invalidateCaches: vi.fn().mockResolvedValue(undefined),
  };
  const service = new OrgUnitCopyService(
    dialClient,
    applicationsService as unknown as ApplicationsService,
    toolsetsListingService as unknown as ToolsetsListingService,
  );
  return {
    service,
    copyResource,
    getApplicationMetadata,
    getToolSetMetadata,
    getPromptMetadata,
    listSkillMetadata,
    applicationsService,
    toolsetsListingService,
  };
};

const copy = (
  service: OrgUnitCopyService,
  body: { folderPath: string; overwrite?: boolean } = { folderPath: 'Acme' },
  entityType = CatalogEntityType.Application,
) => service.copyIntoOrgUnit('user1', 'token', entityType, ENTITY_ID, body);

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
    expect(applicationsService.invalidateAfterWrite).toHaveBeenCalledWith(
      'user1',
      [ENTITY_ID, 'applications/public/Acme/US%20Risk/agent__1.0.0'],
      expect.any(String),
    );
  });

  it('passes overwrite through to the copy', async () => {
    const { service, copyResource } = makeService();

    await copy(service, { folderPath: 'Acme', overwrite: true });

    expect(copyResource).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({ overwrite: true }),
      }),
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

  it('reports an existing target as 409 when overwrite is not set', async () => {
    const { service, copyResource, getApplicationMetadata } = makeService();
    copyResource.mockResolvedValue(err(400));
    getApplicationMetadata.mockResolvedValue({ response: { status: 200 } });

    await expect(copy(service)).rejects.toBeInstanceOf(ConflictException);
  });

  it("maps Core's own 409 to a conflict", async () => {
    const { service, copyResource } = makeService();
    copyResource.mockResolvedValue(err(409));

    await expect(copy(service)).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not probe the destination for a conflict when overwrite is set', async () => {
    const { service, copyResource, getApplicationMetadata } = makeService();
    copyResource.mockResolvedValue(err(400));

    await expect(
      copy(service, { folderPath: 'Acme', overwrite: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(getApplicationMetadata).not.toHaveBeenCalled();
  });

  describe('toolsets', () => {
    const TOOLSET_ID = 'toolsets/b1/tools__1.0.0';
    const copyToolset = (
      service: OrgUnitCopyService,
      body: { folderPath: string; overwrite?: boolean } = {
        folderPath: 'Acme',
      },
    ) =>
      service.copyIntoOrgUnit(
        'user1',
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

    it('reports a repeated same-name copy as 409 when overwrite is not set', async () => {
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
      body: { folderPath: string; overwrite?: boolean } = {
        folderPath: 'Acme',
      },
    ) =>
      service.copyIntoOrgUnit(
        'user1',
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

    it('reports a repeated same-name copy as 409 when overwrite is not set', async () => {
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
      body: { folderPath: string; overwrite?: boolean } = {
        folderPath: 'Acme',
      },
    ) =>
      service.copyIntoOrgUnit(
        'user1',
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

      await expect(copySkill(service)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(listSkillMetadata).not.toHaveBeenCalled();
    });

    it('reports a repeated same-name copy as 409 when overwrite is not set', async () => {
      const { service, copyResource, listSkillMetadata } = makeService();
      copyResource.mockResolvedValue(err(400));
      listSkillMetadata.mockResolvedValue({ response: { status: 200 } });

      await expect(copySkill(service)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  it.each([CatalogEntityType.Project, CatalogEntityType.Model])(
    'answers 501 for the %s type until it is added',
    async (entityType) => {
      const { service, copyResource } = makeService();

      await expect(copy(service, undefined, entityType)).rejects.toBeInstanceOf(
        NotImplementedException,
      );
      expect(copyResource).not.toHaveBeenCalled();
    },
  );
});
