import type { PromptResponseDto } from '@epam/ai-dial-chat-api-client';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useFavoriteApplications } from '../../../context/FavoriteApplicationsContext';
import { usePrompts } from '../../../context/PromptsContext';
import { useUiFeature } from '../../../hooks/useUiFeature';
import {
  usePromptSelectorOverlay,
  type PendingParametersPrompt,
} from '../usePromptSelectorOverlay';

vi.mock('../../../context/PromptsContext', () => ({
  usePrompts: vi.fn(),
}));

vi.mock('../../../context/FavoriteApplicationsContext', () => ({
  useFavoriteApplications: vi.fn(),
}));

vi.mock('../../../hooks/useUiFeature', () => ({
  useUiFeature: vi.fn(),
}));

const PROMPT: PromptResponseDto = {
  id: 'summarize',
  name: 'Summarizer',
  content: 'Rewrite {{text}}',
  folderId: '',
  createdAt: 0,
  updatedAt: 0,
};

const mockUsePrompts = vi.mocked(usePrompts);
const mockUseFavoriteApplications = vi.mocked(useFavoriteApplications);
const mockUseUiFeature = vi.mocked(useUiFeature);

const setupContexts = () => {
  mockUsePrompts.mockReturnValue({
    prompts: [PROMPT],
    folders: [],
    sharedWithMe: [],
    publicPrompts: [],
    publicFolders: [],
    isLoading: false,
    error: null,
    refetchPrompts: vi.fn(),
    refetchPublicPrompts: vi.fn(),
  });
  mockUseFavoriteApplications.mockReturnValue({
    favoriteIds: new Set(),
    isLoading: false,
    toggleFavorite: vi.fn(),
  });
};

/* Exercises the adapter's returned pieces the way ConversationView/ConversationRoute do. */
const Harness = ({
  directPrompt,
}: {
  directPrompt?: PendingParametersPrompt;
}) => {
  const [opened, setOpened] = useState(false);
  const {
    renderOverlay,
    promptCatalogModal,
    parametersPopup,
    openParametersPopup,
  } = usePromptSelectorOverlay({ onInsertText: vi.fn() });

  return (
    <div>
      {renderOverlay ? <span>menu enabled</span> : <span>menu disabled</span>}
      {promptCatalogModal}
      {parametersPopup}
      {directPrompt && (
        <button
          type="button"
          onClick={() => {
            openParametersPopup(directPrompt);
            setOpened(true);
          }}
        >
          Open direct
        </button>
      )}
      {opened && <span>direct-open invoked</span>}
    </div>
  );
};

describe('usePromptSelectorOverlay (host adapter)', () => {
  it('exposes no menu renderer or surfaces while OverlayFeature.Prompts is disabled', () => {
    setupContexts();
    mockUseUiFeature.mockReturnValue(false);

    render(<Harness />);

    expect(screen.getByText('menu disabled')).toBeTruthy();
  });

  it('enables the menu renderer once OverlayFeature.Prompts resolves true', () => {
    setupContexts();
    mockUseUiFeature.mockReturnValue(true);

    render(<Harness />);

    expect(screen.getByText('menu enabled')).toBeTruthy();
  });

  it('a no-op direct-open handler does not throw while disabled', async () => {
    setupContexts();
    mockUseUiFeature.mockReturnValue(false);

    render(<Harness directPrompt={PROMPT} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open direct' }));

    expect(screen.queryByText('Summarizer')).toBeNull();
  });

  it('opens the parameters popup directly for a route-level Catalog entry, with no Back action', async () => {
    setupContexts();
    mockUseUiFeature.mockReturnValue(true);

    render(<Harness directPrompt={PROMPT} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open direct' }));

    expect(await screen.findByText('Summarizer')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });
});
