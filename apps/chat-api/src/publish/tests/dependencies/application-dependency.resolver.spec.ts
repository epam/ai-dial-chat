import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApplicationDependencyResolver } from '../../dependencies/application-dependency.resolver';
import { ResourceDependencyType } from '../../dto/resource-dependency.dto';

const SCHEMA = {
  $defs: {
    Skill: {
      properties: {
        type: { const: 'dial-prompt' },
        url: { 'dial:resource': true },
      },
    },
    ToolSet: {
      properties: {
        type: { const: 'dial-app' },
        deployment_id: { 'dial:resource': true },
      },
    },
  },
  properties: {
    skills: { items: { oneOf: [{ $ref: '#/$defs/Skill' }] } },
    tool_sets: { items: { oneOf: [{ $ref: '#/$defs/ToolSet' }] } },
  },
};

const CONTEXT = { accessToken: 'token-1', userSub: 'user-1' };
const ENTITY_ID = 'applications/bucket-1/My%20app__1.0.0';

describe('ApplicationDependencyResolver', () => {
  let getCustomApplication: ReturnType<typeof vi.fn>;
  let getApplicationSchema: ReturnType<typeof vi.fn>;
  let resolver: ApplicationDependencyResolver;

  const withApplication = (data: unknown) =>
    getCustomApplication.mockResolvedValue({ data, response: { status: 200 } });

  beforeEach(() => {
    getCustomApplication = vi.fn();
    getApplicationSchema = vi.fn().mockResolvedValue(SCHEMA);
    resolver = new ApplicationDependencyResolver(
      { client: { getCustomApplication } } as never,
      { getApplicationSchema } as never,
    );
  });

  it('lists a private prompt the application refers to', async () => {
    withApplication({
      application_type_schema_id: 'https://schema/quick',
      application_properties: {
        skills: [{ type: 'dial-prompt', url: 'prompts/bucket-1/Support/Hi' }],
      },
    });

    const result = await resolver.resolve(CONTEXT, ENTITY_ID);

    expect(result).toEqual([
      {
        id: 'prompts/bucket-1/Support/Hi',
        name: 'Hi',
        type: ResourceDependencyType.Prompt,
        location: 'Support',
      },
    ]);
    expect(getCustomApplication).toHaveBeenCalledWith(
      'bucket-1',
      'My%20app__1.0.0',
      expect.objectContaining({ headers: expect.anything() }),
    );
    expect(getApplicationSchema).toHaveBeenCalledWith(
      'user-1',
      'token-1',
      'https://schema/quick',
    );
  });

  it('leaves out a prompt in the public bucket', async () => {
    withApplication({
      application_type_schema_id: 'https://schema/quick',
      application_properties: {
        skills: [{ type: 'dial-prompt', url: 'prompts/public/Org/Shared' }],
      },
    });

    expect(await resolver.resolve(CONTEXT, ENTITY_ID)).toEqual([]);
  });

  it('lists a private application and a private toolset with their versions', async () => {
    withApplication({
      application_type_schema_id: 'https://schema/quick',
      application_properties: {
        tool_sets: [
          {
            type: 'dial-app',
            deployment_id: 'applications/bucket-1/Calc__1.0.0',
          },
          {
            type: 'dial-app',
            deployment_id: 'toolsets/bucket-1/Search__2.1.0',
          },
        ],
      },
    });

    const result = await resolver.resolve(CONTEXT, ENTITY_ID);

    expect(result).toEqual([
      expect.objectContaining({
        name: 'Calc',
        version: '1.0.0',
        type: ResourceDependencyType.Application,
      }),
      expect.objectContaining({
        name: 'Search',
        version: '2.1.0',
        type: ResourceDependencyType.Toolset,
      }),
    ]);
  });

  it('ignores a bare model id', async () => {
    withApplication({
      application_type_schema_id: 'https://schema/quick',
      application_properties: {
        tool_sets: [{ type: 'dial-app', deployment_id: 'gpt-4o' }],
      },
    });

    expect(await resolver.resolve(CONTEXT, ENTITY_ID)).toEqual([]);
  });

  it('returns nothing for a plain application without a schema and fetches no schema', async () => {
    withApplication({ application_properties: { skills: [] } });

    expect(await resolver.resolve(CONTEXT, ENTITY_ID)).toEqual([]);
    expect(getApplicationSchema).not.toHaveBeenCalled();
  });

  it('does not read the dependencies of a dependency', async () => {
    withApplication({
      application_type_schema_id: 'https://schema/quick',
      application_properties: {
        tool_sets: [
          {
            type: 'dial-app',
            deployment_id: 'applications/bucket-1/Calc__1.0.0',
          },
        ],
      },
    });

    await resolver.resolve(CONTEXT, ENTITY_ID);

    expect(getCustomApplication).toHaveBeenCalledOnce();
    expect(getApplicationSchema).toHaveBeenCalledOnce();
  });

  it('returns nothing for an id that is not an application resource', async () => {
    expect(await resolver.resolve(CONTEXT, 'gpt-4o')).toEqual([]);
    expect(getCustomApplication).not.toHaveBeenCalled();
  });

  it('throws when the application cannot be read', async () => {
    getCustomApplication.mockResolvedValue({
      error: {},
      response: { status: 500 },
    });

    await expect(resolver.resolve(CONTEXT, ENTITY_ID)).rejects.toThrow(
      'status 500',
    );
  });
});
