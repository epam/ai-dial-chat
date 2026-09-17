import type {
  CatalogItem,
  CatalogItemDetailsFetchResult,
} from '@epam/ai-dial-catalog';
import type {
  SkillFileListResponseDto,
  SkillMetadataItemDto,
} from '@epam/ai-dial-chat-api-client';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  SkillDetailsApi,
  UseSkillItemDetailsOptions,
} from '../useSkillItemDetails';
import { useSkillItemDetails } from '../useSkillItemDetails';

/* ── Helpers ─────────────────────────────────────────────────────────────── */

const makeItem = (id: string): CatalogItem => ({
  id,
  type: CatalogEntityType.Skill,
  name: 'Test item',
  version: '',
  lastUsed: 'never',
  description: '',
  folder: [],
  topics: [],
});

/** Produces a fake fetch `Response` whose bytes match `text`. */
const makeTextResponse = (text: string): Response => {
  const bytes = new TextEncoder().encode(text);
  return {
    ok: true,
    status: 200,
    headers: {
      get: (name: string) =>
        name.toLowerCase() === 'content-length'
          ? String(bytes.byteLength)
          : null,
    },
    arrayBuffer: () => Promise.resolve(bytes.buffer as ArrayBuffer),
  } as unknown as Response;
};

const SKILL_BUCKET = 'my-bucket';
const SKILL_PATH = 'my-skill';
const SKILL_ID = `skills/${SKILL_BUCKET}/${SKILL_PATH}`;
const MANIFEST_TEXT = '---\ndescription: My skill\n---\nBody text';

/* The SKILL.md file-listing entry's own author/updatedAt must never leak
 * into the Overview — these values are intentionally different from every
 * other fixture's provenance so a leak would be caught. */
const FILE_LIST: SkillFileListResponseDto = {
  bucket: SKILL_BUCKET,
  path: SKILL_PATH,
  items: [
    {
      name: 'SKILL.md',
      path: `${SKILL_PATH}/SKILL.md`,
      url: `skills/${SKILL_BUCKET}/${SKILL_PATH}/SKILL.md`,
      bucket: SKILL_BUCKET,
      nodeType: 'item' as never,
      author: 'file-level-author@example.com',
      updatedAt: 111,
    },
  ],
};

const SPARSE_LISTING_ENTRY: SkillMetadataItemDto = {
  name: 'my-skill',
  path: SKILL_PATH,
  url: SKILL_ID,
  bucket: SKILL_BUCKET,
  nodeType: 'item' as never,
  /* No author/updatedAt — mirrors a shared skill's sparse catalog entry. */
};

const AUTHORITATIVE_METADATA: SkillMetadataItemDto = {
  name: 'my-skill',
  path: SKILL_PATH,
  url: SKILL_ID,
  bucket: SKILL_BUCKET,
  nodeType: 'item' as never,
  author: 'jane.doe@example.com',
  updatedAt: 1752100000000,
};

const OVERVIEW_LABELS: UseSkillItemDetailsOptions['skillOverviewLabels'] = {
  whenToUseLabel: 'When to use',
  allowedToolsLabel: 'Allowed tools',
  bundledResourcesLabel: 'Bundled resources',
  specificationSectionTitle: 'Specification',
  authorLabel: 'Author',
  updatedLabel: 'Updated',
  fileCountLabel: 'File count',
  detailsSectionTitle: 'Details',
};

const makeApi = (overrides?: Partial<SkillDetailsApi>): SkillDetailsApi => ({
  downloadSkillFile: vi.fn().mockResolvedValue(makeTextResponse(MANIFEST_TEXT)),
  listSkillFiles: vi.fn().mockResolvedValue(FILE_LIST),
  getSkillMetadata: vi.fn().mockResolvedValue(AUTHORITATIVE_METADATA),
  ...overrides,
});

const makeOptions = (
  api: SkillDetailsApi,
  skills: SkillMetadataItemDto[] = [],
): UseSkillItemDetailsOptions => ({
  api,
  skills,
  skillOverviewLabels: OVERVIEW_LABELS,
});

const findSpec = (
  details: CatalogItemDetailsFetchResult | undefined,
  label: string,
): string | boolean | undefined =>
  details?.overview?.sections
    .flatMap((section) => section.specs)
    .find((spec) => spec.label === label)?.value;

/* ── Tests ────────────────────────────────────────────────────────────────── */

describe('useSkillItemDetails', () => {
  it('sources Author/Updated from the metadata response when all three requests fulfill', async () => {
    const api = makeApi();
    const { result } = renderHook(() => useSkillItemDetails(makeOptions(api)));

    const details = await result.current.onFetchSkillDetails(
      makeItem(SKILL_ID),
    );

    expect(findSpec(details, 'Author')).toBe('jane.doe@example.com');
    expect(findSpec(details, 'Updated')).toBeTruthy();
  });

  it('populates Overview rows from metadata even when the listing entry is sparse', async () => {
    const api = makeApi();
    const { result } = renderHook(() =>
      useSkillItemDetails(makeOptions(api, [SPARSE_LISTING_ENTRY])),
    );

    const details = await result.current.onFetchSkillDetails(
      makeItem(SKILL_ID),
    );

    expect(findSpec(details, 'Author')).toBe('jane.doe@example.com');
  });

  it('falls back to the listing entry when the metadata request rejects, keeping manifest and file count', async () => {
    const listingEntry: SkillMetadataItemDto = {
      ...SPARSE_LISTING_ENTRY,
      author: 'listing-author@example.com',
      updatedAt: 999,
    };
    const api = makeApi({
      getSkillMetadata: vi.fn().mockRejectedValue(new Error('network')),
    });
    const { result } = renderHook(() =>
      useSkillItemDetails(makeOptions(api, [listingEntry])),
    );

    const details = await result.current.onFetchSkillDetails(
      makeItem(SKILL_ID),
    );

    expect(findSpec(details, 'Author')).toBe('listing-author@example.com');
    expect(details?.promptContent?.content).toBe('Body text');
    expect(findSpec(details, 'File count')).toBe('1');
    expect(details).toBeDefined();
  });

  it('omits the author row when fulfilled metadata carries none, even if the listing entry has one', async () => {
    const listingEntry: SkillMetadataItemDto = {
      ...SPARSE_LISTING_ENTRY,
      author: 'listing-author@example.com',
    };
    const metadataWithoutAuthor: SkillMetadataItemDto = {
      ...AUTHORITATIVE_METADATA,
      author: undefined,
    };
    const api = makeApi({
      getSkillMetadata: vi.fn().mockResolvedValue(metadataWithoutAuthor),
    });
    const { result } = renderHook(() =>
      useSkillItemDetails(makeOptions(api, [listingEntry])),
    );

    const details = await result.current.onFetchSkillDetails(
      makeItem(SKILL_ID),
    );

    expect(findSpec(details, 'Author')).toBeUndefined();
  });

  it('still omits overview when the file listing rejects, even though metadata fulfilled', async () => {
    const api = makeApi({
      listSkillFiles: vi.fn().mockRejectedValue(new Error('network')),
    });
    const { result } = renderHook(() => useSkillItemDetails(makeOptions(api)));

    const details = await result.current.onFetchSkillDetails(
      makeItem(SKILL_ID),
    );

    expect(details?.overview).toBeUndefined();
    expect(details?.promptContent?.content).toBe('Body text');
  });

  it('resolves undefined when all three requests reject', async () => {
    const api = makeApi({
      downloadSkillFile: vi.fn().mockRejectedValue(new Error('network')),
      listSkillFiles: vi.fn().mockRejectedValue(new Error('network')),
      getSkillMetadata: vi.fn().mockRejectedValue(new Error('network')),
    });
    const { result } = renderHook(() => useSkillItemDetails(makeOptions(api)));

    const details = await result.current.onFetchSkillDetails(
      makeItem(SKILL_ID),
    );

    expect(details).toBeUndefined();
  });

  it('issues no request for an unparseable item id', async () => {
    const api = makeApi();
    const { result } = renderHook(() => useSkillItemDetails(makeOptions(api)));

    const details = await result.current.onFetchSkillDetails(
      makeItem('not-a-skill-url'),
    );

    expect(details).toBeUndefined();
    expect(api.getSkillMetadata).not.toHaveBeenCalled();
    expect(api.downloadSkillFile).not.toHaveBeenCalled();
    expect(api.listSkillFiles).not.toHaveBeenCalled();
  });

  it("never reaches SKILL.md's own file-level author/updatedAt in the Overview", async () => {
    const api = makeApi();
    const { result } = renderHook(() => useSkillItemDetails(makeOptions(api)));

    const details = await result.current.onFetchSkillDetails(
      makeItem(SKILL_ID),
    );

    expect(findSpec(details, 'Author')).not.toBe(
      'file-level-author@example.com',
    );
    expect(findSpec(details, 'Updated')).not.toContain('111');
  });

  it('calls getSkillMetadata with the parsed bucket and path', async () => {
    const api = makeApi();
    const { result } = renderHook(() => useSkillItemDetails(makeOptions(api)));

    await result.current.onFetchSkillDetails(makeItem(SKILL_ID));

    expect(api.getSkillMetadata).toHaveBeenCalledWith(SKILL_BUCKET, SKILL_PATH);
  });
});
