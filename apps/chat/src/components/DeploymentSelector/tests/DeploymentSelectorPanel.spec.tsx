import { type CatalogItem } from '@epam/ai-dial-catalog';
import { CatalogEntityType } from '@epam/ai-dial-chat-shared';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import DeploymentSelectorPanel from '../DeploymentSelectorPanel';

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const makeItem = (id: string, type: CatalogEntityType): CatalogItem => ({
  id,
  type,
  name: id,
  version: '',
  lastUsed: '',
  description: '',
  folder: [],
  topics: [],
});

const renderPanel = (
  favorites: CatalogItem[],
  props?: Partial<ComponentProps<typeof DeploymentSelectorPanel>>,
) =>
  render(
    <DeploymentSelectorPanel
      favorites={favorites}
      onSelect={vi.fn()}
      onToggleFavorite={vi.fn()}
      onClose={vi.fn()}
      {...props}
    />,
  );

describe('DeploymentSelectorPanel — long version', () => {
  it('caps the version at 30% of the row so it cannot overlap the name', () => {
    renderPanel([
      {
        ...makeItem('model-1', CatalogEntityType.Model),
        version: 'With Google Search Grounding',
      },
    ]);

    const version = screen.getByText('With Google Search Grounding');
    expect(version.className).toContain('max-w-[30%]');
    expect(version.className).toContain('shrink-0');
  });

  it('renders no version element when the item has an empty version', () => {
    renderPanel([makeItem('model-1', CatalogEntityType.Model)]);

    /* Asserting the absence of a CSS-level styling class (not text/role) has
       no semantic query equivalent — this repo's spec conventions carve out
       this exact case for container/document.querySelector. */
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.querySelector('.max-w-\\[30\\%\\]')).toBeNull();
  });
});

describe('DeploymentSelectorPanel', () => {
  it('shows a favorited Application in the list', () => {
    renderPanel([makeItem('app-1', CatalogEntityType.Agent)]);

    expect(screen.getByRole('button', { name: /app-1/ })).toBeTruthy();
  });

  it('shows a favorited Model in the list', () => {
    renderPanel([makeItem('model-1', CatalogEntityType.Model)]);

    expect(screen.getByRole('button', { name: /model-1/ })).toBeTruthy();
  });

  it('shows a favorited Agent in the list', () => {
    renderPanel([makeItem('agent-1', CatalogEntityType.Agent)]);

    expect(screen.getByRole('button', { name: /agent-1/ })).toBeTruthy();
  });

  it.each([CatalogEntityType.Toolset, CatalogEntityType.Skill])(
    'excludes a favorited %s from the list',
    (type) => {
      renderPanel([makeItem('non-talkable-1', type)]);

      expect(
        screen.queryByRole('button', { name: /non-talkable-1/ }),
      ).toBeNull();
    },
  );

  it('shows Models and Applications together', () => {
    renderPanel([
      makeItem('model-1', CatalogEntityType.Model),
      makeItem('app-1', CatalogEntityType.Agent),
      makeItem('toolset-1', CatalogEntityType.Toolset),
    ]);

    expect(screen.getByRole('button', { name: /model-1/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /app-1/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /toolset-1/ })).toBeNull();
  });

  describe('currently-selected (not favorited) model', () => {
    const selectedItem = makeItem('claude-opus', CatalogEntityType.Model);

    it('shows a "Currently selected" section when the selected model is not a favorite', () => {
      renderPanel([makeItem('gpt-4o', CatalogEntityType.Model)], {
        selectedId: 'claude-opus',
        selectedItem,
      });

      expect(screen.getByText('Currently selected')).toBeTruthy();
      expect(screen.getByRole('button', { name: /claude-opus/ })).toBeTruthy();
    });

    it('does not duplicate the row when the selected model is already a favorite', () => {
      renderPanel([selectedItem], {
        selectedId: 'claude-opus',
        selectedItem,
      });

      expect(screen.queryByText('Currently selected')).toBeNull();
      expect(
        screen.getAllByRole('button', { name: /claude-opus/ }),
      ).toHaveLength(1);
    });

    it('shows nothing extra when there is no selected item', () => {
      renderPanel([makeItem('gpt-4o', CatalogEntityType.Model)]);

      expect(screen.queryByText('Currently selected')).toBeNull();
    });

    it('hides the currently-selected row when it does not match the search query', async () => {
      const user = userEvent.setup();
      renderPanel([makeItem('gpt-4o', CatalogEntityType.Model)], {
        selectedId: 'claude-opus',
        selectedItem,
      });

      await user.type(
        screen.getByRole('textbox', { name: 'Search models, agents\u2026' }),
        'gpt',
      );

      expect(screen.queryByText('Currently selected')).toBeNull();
    });

    it('adds the currently-selected item to favorites when its star is clicked', async () => {
      const user = userEvent.setup();
      const onToggleFavorite = vi.fn();
      renderPanel([makeItem('gpt-4o', CatalogEntityType.Model)], {
        selectedId: 'claude-opus',
        selectedItem,
        onToggleFavorite,
      });

      await user.click(
        screen.getByRole('button', { name: 'Add to favorites' }),
      );

      await waitFor(() =>
        expect(onToggleFavorite).toHaveBeenCalledWith('claude-opus', true),
      );
    });

    it('selects the currently-selected row and closes the panel when clicked', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();
      renderPanel([makeItem('gpt-4o', CatalogEntityType.Model)], {
        selectedId: 'claude-opus',
        selectedItem,
        onSelect,
        onClose,
      });

      await user.click(screen.getByRole('button', { name: /claude-opus/ }));

      expect(onSelect).toHaveBeenCalledWith('claude-opus');
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  it('shows a Favorites heading above the favorites list', () => {
    renderPanel([makeItem('gpt-4o', CatalogEntityType.Model)]);

    expect(screen.getByText('Favorites')).toBeTruthy();
  });

  describe('removing a favorite plays its exit animation before committing', () => {
    it('does not call onToggleFavorite synchronously on click', async () => {
      const user = userEvent.setup();
      const onToggleFavorite = vi.fn();
      renderPanel([makeItem('gpt-4o', CatalogEntityType.Model)], {
        onToggleFavorite,
      });

      await user.click(
        screen.getByRole('button', { name: 'Remove from favorites' }),
      );

      expect(onToggleFavorite).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /gpt-4o/ })).toBeTruthy();
    });

    it('calls onToggleFavorite with false once the exit animation finishes', async () => {
      const user = userEvent.setup();
      const onToggleFavorite = vi.fn();
      renderPanel([makeItem('gpt-4o', CatalogEntityType.Model)], {
        onToggleFavorite,
      });

      await user.click(
        screen.getByRole('button', { name: 'Remove from favorites' }),
      );

      await waitFor(() =>
        expect(onToggleFavorite).toHaveBeenCalledWith('gpt-4o', false),
      );
    });
  });
});
