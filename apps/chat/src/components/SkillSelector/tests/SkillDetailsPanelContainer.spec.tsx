import type { SkillMetadataItemDto } from '@epam/ai-dial-chat-api-client';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogI18nKeys } from '../../../constants/translation-keys';
import { useFavoriteApplications } from '../../../context/FavoriteApplicationsContext';
import { useSkills } from '../../../context/SkillsContext';
import {
  downloadSkillFile,
  getSkillMetadata,
  listSkillFiles,
} from '../../../server-api/skills.api';
import SkillDetailsPanelContainer from '../SkillDetailsPanelContainer';

vi.mock('../../../context/SkillsContext', () => ({
  useSkills: vi.fn(),
}));

vi.mock('../../../context/FavoriteApplicationsContext', () => ({
  useFavoriteApplications: vi.fn(),
}));

vi.mock('../../../server-api/skills.api', () => ({
  downloadSkillFile: vi.fn(),
  listSkillFiles: vi.fn(),
  getSkillMetadata: vi.fn(),
}));

/* A sparse context entry, mirroring a shared skill whose catalog listing
 * carries no provenance (the regression this change fixes). */
const SPARSE_SHARED_SKILL: SkillMetadataItemDto = {
  name: 'docs-helper',
  path: 'team-a/docs-helper',
  url: 'skills/owner-bucket/team-a/docs-helper',
  bucket: 'owner-bucket',
  nodeType: 'item',
  parentPath: 'team-a/',
  permissions: ['READ'],
};

const AUTHORITATIVE_METADATA: SkillMetadataItemDto = {
  ...SPARSE_SHARED_SKILL,
  author: 'jane.doe@example.com',
  updatedAt: 1752100000000,
};

const makeManifestResponse = (body: string) =>
  new Response(body, { headers: { 'content-length': String(body.length) } });

describe('SkillDetailsPanelContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useFavoriteApplications).mockReturnValue({
      favoriteIds: new Set(),
      isLoading: false,
      toggleFavorite: vi.fn(),
    });

    vi.mocked(useSkills).mockReturnValue({
      skills: [],
      publicSkills: [],
      sharedWithMe: [SPARSE_SHARED_SKILL],
      isLoading: false,
      error: null,
      refetchSkills: vi.fn().mockResolvedValue(undefined),
      mergeSharedSkill: vi.fn(),
    });

    vi.mocked(downloadSkillFile).mockResolvedValue(
      makeManifestResponse('---\ndescription: Explains our docs\n---\nBody'),
    );
    vi.mocked(listSkillFiles).mockResolvedValue({
      bucket: 'owner-bucket',
      path: 'team-a/docs-helper',
      items: [
        {
          name: 'SKILL.md',
          path: 'SKILL.md',
          url: 'skills/owner-bucket/team-a/docs-helper/SKILL.md',
          bucket: 'owner-bucket',
          nodeType: 'item',
        },
      ],
    });
    vi.mocked(getSkillMetadata).mockResolvedValue(AUTHORITATIVE_METADATA);
  });

  it('renders Author and Last updated from the metadata response for a shared skill whose context entry lacks provenance', async () => {
    render(
      <SkillDetailsPanelContainer
        skillId={SPARSE_SHARED_SKILL.url}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() =>
      expect(getSkillMetadata).toHaveBeenCalledWith(
        'owner-bucket',
        'team-a/docs-helper',
      ),
    );

    await userEvent.click(await screen.findByRole('tab', { name: 'Overview' }));

    expect(
      await screen.findByText(CatalogI18nKeys.DetailsSkillAuthor),
    ).toBeTruthy();
    expect(screen.getByText('jane.doe@example.com')).toBeTruthy();
  });
});
