import { CatalogEntityType, type CatalogItem } from '@epam/ai-dial-catalog';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ModelPickerPanel from '../ModelPickerPanel';

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

const renderPanel = (favorites: CatalogItem[]) =>
  render(
    <ModelPickerPanel
      favorites={favorites}
      onSelect={vi.fn()}
      onToggleFavorite={vi.fn()}
      onClose={vi.fn()}
    />,
  );

describe('ModelPickerPanel', () => {
  it('shows a favorited Application in the list', () => {
    renderPanel([makeItem('app-1', CatalogEntityType.Application)]);

    expect(screen.getByText('app-1')).toBeTruthy();
  });

  it('shows a favorited Model in the list', () => {
    renderPanel([makeItem('model-1', CatalogEntityType.Model)]);

    expect(screen.getByText('model-1')).toBeTruthy();
  });

  it('shows a favorited Agent in the list', () => {
    renderPanel([makeItem('agent-1', CatalogEntityType.Agent)]);

    expect(screen.getByText('agent-1')).toBeTruthy();
  });

  it.each([
    CatalogEntityType.Toolset,
    CatalogEntityType.Skill,
    CatalogEntityType.Guardrail,
    CatalogEntityType.Mcp,
  ])('excludes a favorited %s from the list', (type) => {
    renderPanel([makeItem('non-talkable-1', type)]);

    expect(screen.queryByText('non-talkable-1')).toBeNull();
  });

  it('shows Models and Applications together', () => {
    renderPanel([
      makeItem('model-1', CatalogEntityType.Model),
      makeItem('app-1', CatalogEntityType.Application),
      makeItem('toolset-1', CatalogEntityType.Toolset),
    ]);

    expect(screen.getByText('model-1')).toBeTruthy();
    expect(screen.getByText('app-1')).toBeTruthy();
    expect(screen.queryByText('toolset-1')).toBeNull();
  });
});
