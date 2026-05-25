import { describe, expect, it } from 'vitest';
import {
  CatalogFilterService,
  capabilitiesFilter,
} from '../catalog-filter.service';
import type { CatalogItemDto } from '../dto/catalog-item.dto';

function makeModel(overrides: Partial<CatalogItemDto> = {}): CatalogItemDto {
  return {
    id: 'model-1',
    displayName: 'Model One',
    type: 'model',
    ...overrides,
  };
}

function makeApp(overrides: Partial<CatalogItemDto> = {}): CatalogItemDto {
  return {
    id: 'app-1',
    displayName: 'App One',
    type: 'application',
    ...overrides,
  };
}

describe('CatalogFilterService.parse()', () => {
  const service = new CatalogFilterService();

  it('returns empty filter when DTO has no capability filters', () => {
    expect(service.parse({} as never)).toEqual({});
  });

  it('sets requested capability exact values', () => {
    const filter = service.parse({
      'modelCapabilities.chat_completion': true,
      'modelCapabilities.embeddings': false,
    } as never);
    expect(filter).toEqual({
      capabilities: {
        chat_completion: true,
        embeddings: false,
      },
    });
  });

  it('omits capabilities when all capability fields are undefined', () => {
    const filter = service.parse({
      'modelCapabilities.chat_completion': undefined,
    } as never);
    expect(filter.capabilities).toBeUndefined();
  });
});

describe('capabilitiesFilter', () => {
  const model = makeModel({
    capabilities: {
      chat_completion: true,
      embeddings: false,
      fine_tune: false,
    },
  });
  const app = makeApp();

  it('passes when filter is empty', () => {
    expect(capabilitiesFilter(model, {})).toBe(true);
    expect(capabilitiesFilter(app, {})).toBe(true);
  });

  it('passes model when all requested capability values match', () => {
    expect(
      capabilitiesFilter(model, {
        capabilities: { chat_completion: true, embeddings: false },
      }),
    ).toBe(true);
  });

  it('fails model when a requested capability value does not match', () => {
    expect(
      capabilitiesFilter(model, {
        capabilities: { chat_completion: true, embeddings: true },
      }),
    ).toBe(false);
  });

  it('fails model when a requested capability is missing', () => {
    expect(
      capabilitiesFilter(model, {
        capabilities: { inference: false },
      }),
    ).toBe(false);
  });

  it('passes application items unchanged when capabilities filter is set', () => {
    expect(
      capabilitiesFilter(app, {
        capabilities: { chat_completion: true },
      }),
    ).toBe(true);
  });

  it('treats missing capabilities object as no capabilities', () => {
    const modelNoCaps = makeModel({ capabilities: undefined });
    expect(
      capabilitiesFilter(modelNoCaps, {
        capabilities: { chat_completion: true },
      }),
    ).toBe(false);
  });
});

describe('CatalogFilterService.apply()', () => {
  const service = new CatalogFilterService();
  const model = makeModel({
    id: 'gpt-4',
    capabilities: { chat_completion: true, embeddings: false },
  });
  const embeddingModel = makeModel({
    id: 'ada',
    capabilities: { chat_completion: false, embeddings: true },
  });
  const app = makeApp();
  const items = [model, embeddingModel, app];

  it('returns all items when filter is empty', () => {
    expect(service.apply(items, {})).toEqual(items);
  });

  it('returns empty when items array is empty', () => {
    expect(
      service.apply([], { capabilities: { chat_completion: true } }),
    ).toEqual([]);
  });

  it('filters models by requested capability values and keeps applications', () => {
    const result = service.apply(items, {
      capabilities: { chat_completion: true, embeddings: false },
    });
    expect(result).toEqual([model, app]);
  });

  it('keeps applications when capabilities filter is set', () => {
    const result = service.apply(items, {
      capabilities: { embeddings: true },
    });
    expect(result).toEqual([embeddingModel, app]);
  });
});
