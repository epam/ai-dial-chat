import { describe, expect, it, vi } from 'vitest';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { Conversation } from '@/src/types/chat';
import { EntityType, ScreenState } from '@/src/types/common';
import { DialAIEntityModel } from '@/src/types/models';
import { AppAction } from '@/src/types/store';
import { CardType } from '@/src/types/talkTo';

import { ModelsSelectors, SettingsSelectors } from '@/src/store/selectors';

import { SuggestedCard } from '@/src/constants/talkTo';

import { TalkToSlider } from '@/src/components/Chat/TalkTo/TalkToSlider';

import { Feature } from '@epam/ai-dial-shared';

vi.mock('@/public/images/icons/search-alt.svg', () => ({
  default: () => <div data-testid="mock-svg" />,
}));

const mockModelsMap: Record<string, DialAIEntityModel> = {
  model1: {
    id: 'model1',
    name: 'Model 1',
    reference: 'model1',
    type: EntityType.Model,
    isDefault: false,
  },
  model2: {
    id: 'model2',
    name: 'Model 2',
    reference: 'model2',
    type: EntityType.Model,
    isDefault: false,
  },
};

const mockInstalledModelIds = new Set(['model1', 'model2']);

vi.mock('@/src/store/hooks', async () => {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useAppSelector: (selector: any) => selector({}),
    useAppDispatch: () => (action: AppAction) => action,
  };
});

vi.mock('@/src/store/selectors', () => ({
  ModelsSelectors: {
    selectModelsMap: vi.fn(),
    selectInstalledModelIds: vi.fn(),
    selectModels: vi.fn(),
  },
  SettingsSelectors: {
    selectEnabledFeatures: vi.fn(),
    isSharingEnabled: vi.fn(),
    selectIsPublishingEnabled: vi.fn(),
  },
}));

vi.mock('@/src/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (str: string) => str,
  }),
}));

vi.mock('@/src/hooks/useScreenState', () => ({
  useScreenState: () => ScreenState.XL,
}));

vi.mock('@/src/hooks/useAgentMenuItems', () => ({
  useAgentMenuItems: () => [],
}));

describe('TalkToSlider', () => {
  const createMockItems = (count: number): CardType[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `model${i + 1}`,
      name: `Model ${i + 1}`,
      reference: `model${i + 1}`,
      description: `Test model ${i + 1}`,
      type: EntityType.Model,
      isDefault: false,
    }));
  };

  const mockItems = createMockItems(2);

  const mockConversation: Conversation = {
    id: '1',
    name: 'Test Conversation',
    model: { id: 'model1' },
    messages: [],
    prompt: '',
    temperature: 1,
    selectedAddons: [],
    createdAt: 1234567890,
    updatedAt: 1234567890,
    folderId: '',
  };

  beforeEach(() => {
    vi.mocked(ModelsSelectors.selectModelsMap).mockReturnValue(mockModelsMap);
    vi.mocked(ModelsSelectors.selectInstalledModelIds).mockReturnValue(
      mockInstalledModelIds,
    );
    vi.mocked(ModelsSelectors.selectModels).mockReturnValue(
      Object.values(mockModelsMap),
    );
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(
      new Set<Feature>(),
    );
  });

  const renderComponent = (
    props: Partial<Parameters<typeof TalkToSlider>[0]> = {},
  ) => {
    return render(
      <TalkToSlider
        conversation={mockConversation}
        items={mockItems}
        isMyWorkspace={false}
        isSearchMode={false}
        searchTerm=""
        onSelectModel={vi.fn()}
        onOpenMarketplaceTab={vi.fn()}
        {...props}
      />,
    );
  };

  it('renders without crashing', () => {
    renderComponent();
    expect(screen.getByTestId('agents-section')).toBeInTheDocument();
  });

  it('displays model cards', () => {
    renderComponent();
    expect(screen.getByText('Model 1')).toBeInTheDocument();
    expect(screen.getByText('Model 2')).toBeInTheDocument();
  });

  it('shows no results found when items array is empty', () => {
    renderComponent({ items: [] });
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('calls onSelectModel when a model card is clicked', () => {
    const onSelectModel = vi.fn();
    renderComponent({ onSelectModel });

    const modelCard = screen.getByText('Model 1');
    fireEvent.click(modelCard);

    expect(onSelectModel).toHaveBeenCalled();
  });

  it('shows suggestion button in my workspace when no results', () => {
    const onOpenMarketplaceTab = vi.fn();
    renderComponent({
      items: [],
      isMyWorkspace: true,
      onOpenMarketplaceTab,
    });

    const suggestionButton = screen.getByText(/See results from/i);
    fireEvent.click(suggestionButton);

    expect(onOpenMarketplaceTab).toHaveBeenCalled();
  });

  describe('Multiple slides', () => {
    it('shows slider dots when there are multiple slides', () => {
      const manyItems = createMockItems(10);
      renderComponent({ items: manyItems });

      const dots = screen.getAllByTestId(/^slider-dot-\d+$/);
      expect(dots.length).toBe(2);
    });

    it('allows navigation between slides', () => {
      const manyItems = createMockItems(15);
      renderComponent({ items: manyItems });

      expect(screen.getByText('Model 1')).toBeInTheDocument();

      const nextButton = screen.getByTestId('slider-dot-arrow-next');
      fireEvent.click(nextButton);

      expect(screen.getByText('Model 10')).toBeInTheDocument();
    });

    it('updates active slide when clicking dots', () => {
      const manyItems = createMockItems(15);
      renderComponent({ items: manyItems });

      const dots = screen.getAllByTestId(/^slider-dot-\d+$/);
      fireEvent.click(dots[1]);

      expect(within(dots[1]).getByRole('button')).toHaveClass('h-2 w-8');
      expect(within(dots[0]).getByRole('button')).not.toHaveClass('h-2 w-8');
    });
  });

  describe('SuggestedCard', () => {
    it('shows suggested card when searching in my workspace with results', () => {
      const items = [...createMockItems(3), SuggestedCard];
      renderComponent({
        items,
        isMyWorkspace: true,
        isSearchMode: true,
        searchTerm: 'test',
      });

      expect(
        screen.getByText("Couldn't find what you need?"),
      ).toBeInTheDocument();
      expect(screen.getByText(/See results from/i)).toBeInTheDocument();
    });

    it('calls onOpenMarketplaceTab when clicking suggested card', async () => {
      const onOpenMarketplaceTab = vi.fn();
      const items = [...createMockItems(3), SuggestedCard];
      renderComponent({
        items,
        isMyWorkspace: true,
        isSearchMode: true,
        searchTerm: 'test',
        onOpenMarketplaceTab,
      });

      const suggestedButton = screen.getByText("Couldn't find what you need?");
      await userEvent.click(suggestedButton);

      expect(onOpenMarketplaceTab).toHaveBeenCalled();
    });

    it('does not show suggested card when not in my workspace', () => {
      const items = createMockItems(3);
      renderComponent({
        items,
        isMyWorkspace: false,
        isSearchMode: true,
        searchTerm: 'test',
      });

      expect(
        screen.queryByText("Couldn't find what you need?"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/See results from/i)).not.toBeInTheDocument();
    });

    it('does not show suggested card when not searching', () => {
      const items = createMockItems(3);
      renderComponent({
        items,
        isMyWorkspace: true,
        isSearchMode: false,
        searchTerm: '',
      });

      expect(
        screen.queryByText("Couldn't find what you need?"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(/See results from/i)).not.toBeInTheDocument();
    });
  });
});
