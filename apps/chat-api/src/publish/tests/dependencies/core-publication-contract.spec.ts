import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import { describe, expect, it } from 'vitest';

const FIXTURES = join(__dirname, 'fixtures');

const readFixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(FIXTURES, name), 'utf8')) as T;

interface FixtureResource {
  action: string;
  sourceUrl: string;
  targetUrl: string;
  reviewUrl?: string;
}

interface FixturePublication {
  targetFolder: string;
  resources: FixtureResource[];
}

/**
 * Hand-built contract fixtures for the publication request this change
 * sends. They pin the Core behaviours the design relies on (see design.md D3):
 * the shapes validate against the schemas Core publishes, and the paths obey
 * the rules `PublicationService.validateResourceForAddition` applies.
 */
describe('Core publication contract fixtures', () => {
  const schema = readFixture<Record<string, unknown>>(
    'core-publication.schema.json',
  );
  const validate = new Ajv({ strict: false }).compile(schema);
  const request = readFixture<FixturePublication>(
    'create-publication.request.json',
  );
  const response = readFixture<FixturePublication>(
    'create-publication.response.json',
  );

  it('validates the request and the response against the Core schemas', () => {
    expect(validate(request)).toBe(true);
    expect(validate(response)).toBe(true);
  });

  it('keeps every target below the target folder, as Core requires', () => {
    for (const { sourceUrl, targetUrl } of request.resources) {
      const type = sourceUrl.split('/')[0];
      expect(targetUrl.startsWith(`${type}/${request.targetFolder}`)).toBe(
        true,
      );
    }
  });

  it('gives the application and a dependency application different review paths', () => {
    const suffix = (url: string, folder: string) =>
      url.slice(url.indexOf(folder) + folder.length);
    const reviewSuffixes = request.resources.map((resource) =>
      suffix(resource.targetUrl, request.targetFolder),
    );
    expect(new Set(reviewSuffixes).size).toBe(reviewSuffixes.length);
    expect(reviewSuffixes).toContain('Helper__1.0.0');
    expect(reviewSuffixes).toContain(
      '.Helper__1.0.0.deps/bucket-123/Calculator__1.0.0',
    );
  });

  it('shows the staging path only on the source side', () => {
    const [application] = request.resources;
    expect(application.sourceUrl).toContain('/.publish-staging/');
    expect(application.targetUrl).not.toContain('.publish-staging');
  });

  it('records a non-overwriting copy onto an existing target as 400', () => {
    const answer = readFixture<{ status: number; body: string }>(
      'copy-onto-existing.response.json',
    );
    expect(answer.status).toBe(400);
    expect(answer.body).toContain('destination resource already exists');
  });
});
