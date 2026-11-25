import { describe, expect, it } from 'vitest';
import type { RawDeploymentDto } from '../../dto/raw-deployment.dto';
import {
  mapCatalogProperties,
  mapToDeploymentItem,
  mapToolsetAuthSettings,
  redactApplicationFunctionEnv,
} from '../deployment-mapper.util';

const raw = (overrides: Partial<RawDeploymentDto>): RawDeploymentDto =>
  ({ id: 'gpt-4o', ...overrides }) as RawDeploymentDto;

describe('mapCatalogProperties', () => {
  it('keeps the four recognized properties and drops provider', () => {
    const result = mapCatalogProperties({
      provider: 'Provider',
      vendor: 'Vendor',
      license: 'License',
      knowledgeCutoffDate: '2026-08-17',
      parameters: '100B',
    });

    expect(result).toStrictEqual({
      vendor: 'Vendor',
      license: 'License',
      knowledgeCutoffDate: '2026-08-17',
      parameters: '100B',
    });
  });

  it('returns undefined when provider is the only recognized-looking property', () => {
    expect(
      mapCatalogProperties({ provider: 'Provider', extra: 'x' }),
    ).toBeUndefined();
  });

  it('returns undefined for missing or non-object catalog properties', () => {
    expect(mapCatalogProperties(undefined)).toBeUndefined();
    expect(mapCatalogProperties('Provider')).toBeUndefined();
    expect(mapCatalogProperties(['Provider'])).toBeUndefined();
  });
});

describe('mapToDeploymentItem isFeatured', () => {
  it('marks a deployment featured by its id', () => {
    const item = mapToDeploymentItem(raw({}), new Set(['gpt-4o']), new Set());

    expect(item?.isFeatured).toBe(true);
  });

  it('marks a deployment featured by its reference when the id is not listed', () => {
    const item = mapToDeploymentItem(
      raw({ reference: 'gpt-4o-ref' }),
      new Set(['gpt-4o-ref']),
      new Set(),
    );

    expect(item?.isFeatured).toBe(true);
  });

  it('is not featured when neither id nor reference is listed', () => {
    const item = mapToDeploymentItem(
      raw({ reference: 'gpt-4o-ref' }),
      new Set(['other']),
      new Set(),
    );

    expect(item?.isFeatured).toBe(false);
  });
});

describe('mapToDeploymentItem isHidden', () => {
  const hiddenTags = new Set(['HIDDEN']);

  it('marks a deployment hidden when a description keyword is a hidden tag', () => {
    const item = mapToDeploymentItem(
      raw({ description_keywords: ['Text', 'HIDDEN'] }),
      new Set(),
      hiddenTags,
    );

    expect(item?.isHidden).toBe(true);
  });

  it('does not mark a deployment without a hidden tag', () => {
    const item = mapToDeploymentItem(
      raw({ description_keywords: ['Text'] }),
      new Set(),
      hiddenTags,
    );

    expect(item?.isHidden).toBe(false);
  });

  it('does not mark a deployment whose keywords are not an array', () => {
    const item = mapToDeploymentItem(
      raw({ description_keywords: 'HIDDEN' as unknown as string[] }),
      new Set(),
      hiddenTags,
    );

    expect(item?.isHidden).toBe(false);
  });
});

describe('mapToDeploymentItem model flags', () => {
  const map = (extra: Record<string, unknown>) =>
    mapToDeploymentItem(
      { id: 'gpt-4o', object: 'model', ...extra } as RawDeploymentDto,
      new Set(),
      new Set(),
    );

  it('forwards parallel tool calls, caching and auto caching as sent', () => {
    const item = map({
      features: {
        tools: true,
        parallel_tool_calls: false,
        cache: true,
        auto_caching: false,
      },
    });

    expect(item?.features).toMatchObject({
      tools: true,
      parallelToolCalls: false,
      cache: true,
      autoCaching: false,
    });
  });

  it('leaves the flags out when Core sends none', () => {
    const item = map({ features: { tools: true } });

    expect(item?.features).not.toHaveProperty('parallelToolCalls');
    expect(item?.features).not.toHaveProperty('cache');
    expect(item?.features).not.toHaveProperty('autoCaching');
    expect(item?.features).not.toHaveProperty('reasoningEfforts');
  });

  it('forwards the reasoning efforts that are strings', () => {
    const item = map({
      features: { reasoning_efforts: ['low', 'high', 3, null] },
    });

    expect(item?.features?.reasoningEfforts).toEqual(['low', 'high']);
  });

  it('leaves reasoning efforts out for an empty or malformed list', () => {
    expect(
      map({ features: { reasoning_efforts: [] } })?.features,
    ).not.toHaveProperty('reasoningEfforts');
    expect(
      map({ features: { reasoning_efforts: 'high' } })?.features,
    ).not.toHaveProperty('reasoningEfforts');
  });

  it('ignores non-boolean flag values', () => {
    const item = map({
      features: { parallel_tool_calls: 'yes', cache: 1, auto_caching: null },
    });

    expect(item?.features).not.toHaveProperty('parallelToolCalls');
    expect(item?.features).not.toHaveProperty('cache');
    expect(item?.features).not.toHaveProperty('autoCaching');
  });

  it('forwards the model kinds from capabilities', () => {
    const item = map({
      capabilities: {
        chat_completion: true,
        completion: false,
        embeddings: true,
        fine_tune: true,
        scale_types: ['standard'],
      },
    });

    expect(item?.modelKinds).toStrictEqual({
      chatCompletion: true,
      completion: false,
      embeddings: true,
    });
  });

  it('keeps only the kinds Core sent as booleans', () => {
    expect(
      map({ capabilities: { embeddings: true, completion: 'x' } })?.modelKinds,
    ).toStrictEqual({ embeddings: true });
  });

  it('leaves the model kinds out when capabilities are missing or malformed', () => {
    expect(map({})?.modelKinds).toBeUndefined();
    expect(map({ capabilities: 'embeddings' })?.modelKinds).toBeUndefined();
    expect(
      map({ capabilities: { fine_tune: true } })?.modelKinds,
    ).toBeUndefined();
  });
});

describe('mapToDeploymentItem provider', () => {
  const map = (overrides: Partial<RawDeploymentDto>) =>
    mapToDeploymentItem(raw(overrides), new Set(), new Set());

  it('passes the top-level provider through as sent by DIAL Core', () => {
    const rawModel = raw({ object: 'model' }) as Record<string, unknown>;
    rawModel.provider = 'aws';

    const item = mapToDeploymentItem(
      rawModel as RawDeploymentDto,
      new Set(),
      new Set(),
    );

    expect(item?.provider).toBe('aws');
  });

  it('leaves provider undefined when DIAL Core sends none', () => {
    expect(map({ object: 'model' })?.provider).toBeUndefined();
  });

  it('leaves provider undefined for an empty or non-string value', () => {
    const empty = { ...raw({}), provider: '' } as RawDeploymentDto;
    const numeric = { ...raw({}), provider: 7 } as unknown as RawDeploymentDto;

    expect(mapToDeploymentItem(empty, new Set(), new Set())?.provider).toBe(
      undefined,
    );
    expect(mapToDeploymentItem(numeric, new Set(), new Set())?.provider).toBe(
      undefined,
    );
  });

  it('ignores a provider placed inside interface_configs', () => {
    const rawModel = {
      ...raw({ object: 'model' }),
      interface_configs: { openaiChatCompletions: { provider: 'nested' } },
    } as unknown as RawDeploymentDto;

    expect(
      mapToDeploymentItem(rawModel, new Set(), new Set())?.provider,
    ).toBeUndefined();
  });
});

describe('mapToDeploymentItem viewerUrl', () => {
  const map = (overrides: Partial<RawDeploymentDto>) =>
    mapToDeploymentItem(raw(overrides), new Set(), new Set());

  it('exposes viewer_url for an application', () => {
    const item = map({
      object: 'application',
      viewer_url: 'https://viewer.example.com/',
    });

    expect(item?.viewerUrl).toBe('https://viewer.example.com/');
  });

  it('never exposes viewer_url for a model', () => {
    const item = map({ viewer_url: 'https://viewer.example.com/' });

    expect(item?.viewerUrl).toBeUndefined();
  });

  it('omits a missing or empty viewer_url', () => {
    expect(map({ object: 'application' })?.viewerUrl).toBeUndefined();
    expect(
      map({ object: 'application', viewer_url: '' })?.viewerUrl,
    ).toBeUndefined();
  });
});

describe('redactApplicationFunctionEnv', () => {
  it('drops function.env and keeps the other function fields', () => {
    const redacted = redactApplicationFunctionEnv({
      id: 'applications/my-app',
      function: { runtime: 'python3.11', env: { API_KEY: 'secret' } },
    });

    expect(redacted).toEqual({
      id: 'applications/my-app',
      function: { runtime: 'python3.11' },
    });
  });

  it('returns the value unchanged when there is no function.env', () => {
    const value = { id: 'applications/my-app', function: { runtime: 'x' } };

    expect(redactApplicationFunctionEnv(value)).toBe(value);
    expect(redactApplicationFunctionEnv(null)).toBeNull();
  });
});

describe('mapToolsetAuthSettings', () => {
  it('forwards the client secret hint unchanged and never the secret itself', () => {
    const mapped = mapToolsetAuthSettings({
      authentication_type: 'OAUTH',
      client_id: 'client-id',
      client_secret: 'super-secret',
      client_secret_hint: 'd4c6',
      code_verifier: 'verifier',
    });

    expect(mapped?.clientSecretHint).toBe('d4c6');
    expect(mapped).not.toHaveProperty('clientSecret');
    expect(mapped).not.toHaveProperty('codeVerifier');
    expect(JSON.stringify(mapped)).not.toContain('super-secret');
  });

  it('leaves the hint absent when DIAL Core sends none', () => {
    expect(
      mapToolsetAuthSettings({ authentication_type: 'OAUTH' })
        ?.clientSecretHint,
    ).toBeUndefined();
  });
});
