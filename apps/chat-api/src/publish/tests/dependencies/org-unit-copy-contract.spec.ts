import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it, vi } from 'vitest';
import type { ApplicationsService } from '../../../applications/applications.service';
import type { DialClientService } from '../../../dial/dial-client.service';
import type { OrgUnitsService } from '../../../org-units/org-units.service';
import type { ToolsetsListingService } from '../../../toolsets/listing/toolsets-listing.service';
import type { ApplicationPublishPreparationService } from '../../application-publish-preparation.service';
import { CatalogEntityType } from '../../dto/catalog-entity-params.dto';
import { ResourceDependencyType } from '../../dto/resource-dependency.dto';
import { OrgUnitCopyService } from '../../org-unit-copy.service';
import { getPublishedDependencyTargetUrl } from '../../publish-target.util';

const FIXTURES = join(__dirname, 'fixtures');

const readFixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as T;

interface CopyRequest {
  sourceUrl: string;
  destinationUrl: string;
  overwrite: boolean;
}

interface RequestsFixture {
  folderPath: string;
  requests: CopyRequest[];
}

const BUCKET = 'bucket-123';
const ENTITY_ID = `applications/${BUCKET}/Helper__1.0.0`;
const STAGED = {
  id: `applications/${BUCKET}/.publish-staging/Helper__1.0.0`,
  resource: { bucket: BUCKET, path: '.publish-staging/Helper__1.0.0' },
};

/**
 * Contract fixtures for the copies the org-unit save issues against DIAL Core
 * (design D2 and D4): the request shape follows Core's `CopyResourcesRequest`,
 * the order is icon, dependencies, application, and the paths obey the same
 * namespace rules publishing uses. They are hand-built from the Core code read
 * for this change, not recorded from a live Core.
 */
describe('Org-unit copy contract fixtures', () => {
  const fixture = readFixture<RequestsFixture>('org-unit-copy.requests.json');
  const validate = new Ajv({ strict: false }).compile(
    readFixture<Record<string, unknown>>('copy-resource.schema.json'),
  );

  const runExecutor = async (): Promise<CopyRequest[]> => {
    const copyResource = vi
      .fn()
      .mockResolvedValue({ response: { status: 200 } });
    const skillTarget = getPublishedDependencyTargetUrl(
      fixture.folderPath,
      'Helper__1.0.0',
      `skills/${BUCKET}/Plan`,
    );
    const service = new OrgUnitCopyService(
      {
        client: {
          copyResource,
          getCustomApplication: vi.fn().mockResolvedValue({
            data: { iconUrl: `files/${BUCKET}/icons/logo.png` },
            response: { status: 200 },
          }),
        },
      } as unknown as DialClientService,
      {
        resolveOwnApplication: vi
          .fn()
          .mockResolvedValue({ bucket: BUCKET, path: 'Helper__1.0.0' }),
        invalidateAfterWrite: vi.fn().mockResolvedValue(undefined),
      } as unknown as ApplicationsService,
      {} as unknown as ToolsetsListingService,
      {
        plan: vi.fn().mockResolvedValue({
          dependencies: [],
          toCopy: [
            {
              dependency: {
                id: `skills/${BUCKET}/Plan`,
                name: 'Plan',
                type: ResourceDependencyType.Skill,
              },
              sourceUrl: `skills/${BUCKET}/Plan`,
              targetUrl: skillTarget,
            },
          ],
          targets: new Map(),
        }),
        stage: vi.fn().mockResolvedValue(STAGED),
        deleteCopy: vi.fn().mockResolvedValue(undefined),
      } as unknown as ApplicationPublishPreparationService,
      {
        findMissingWriteNamespaces: vi.fn().mockResolvedValue([]),
      } as unknown as OrgUnitsService,
    );

    await service.copyIntoOrgUnit(
      'user-1',
      BUCKET,
      'token',
      CatalogEntityType.Application,
      ENTITY_ID,
      { folderPath: fixture.folderPath },
    );
    return copyResource.mock.calls.map(([call]) => call.body as CopyRequest);
  };

  it('sends exactly the requests of the fixture, in order', async () => {
    expect(await runExecutor()).toEqual(fixture.requests);
  });

  it("validates every request against Core's copy request schema and never overwrites", () => {
    for (const request of fixture.requests) {
      expect(validate(request)).toBe(true);
      expect(request.overwrite).toBe(false);
    }
  });

  it('keeps every target in the public bucket below the destination folder and in its own type', () => {
    for (const { sourceUrl, destinationUrl } of fixture.requests) {
      const type = sourceUrl.split('/')[0];
      expect(
        destinationUrl.startsWith(`${type}/public/${fixture.folderPath}/`),
      ).toBe(true);
    }
  });

  it('puts the dependency in the per-application namespace next to the application, never under it', () => {
    const [, dependency, application] = fixture.requests;
    expect(dependency.destinationUrl).toContain('/.Helper__1.0.0.deps/');
    expect(application.destinationUrl).toBe(
      'applications/public/Delivery/Teams/Helper__1.0.0',
    );
    expect(dependency.destinationUrl).not.toContain(
      `${application.destinationUrl}/`,
    );
  });

  it('shows the staging path only on the source side', () => {
    const application = fixture.requests[2];
    expect(application.sourceUrl).toContain('/.publish-staging/');
    expect(application.destinationUrl).not.toContain('.publish-staging');
  });
});
