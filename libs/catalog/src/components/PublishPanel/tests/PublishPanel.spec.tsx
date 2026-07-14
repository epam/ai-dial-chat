import { render, screen } from '@testing-library/react';
import { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CatalogItem } from '../../../models/catalog-item';
import {
  PublishFolderNode,
  PublishHistoryEntry,
} from '../../../models/publish';
import { CatalogEntityType } from '../../../types/entity-type';
import { PublishPanel } from '../PublishPanel';

interface MockDropdownItem {
  key: string;
  label?: ReactNode;
  onClick?: (info: { key: string; domEvent: MouseEvent }) => void;
}

// DialDropdown uses floating-ui which can't position in jsdom — mock it as a
// plain listbox so option interaction works in tests (matches the convention
// used in Filter.spec.tsx: render children + a clickable list of items).
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...real,
    DialDropdown: ({
      children,
      items,
    }: {
      children: ReactNode;
      items?: MockDropdownItem[];
    }) => (
      <div>
        {children}
        <div role="listbox">
          {items?.map((item) => (
            <button
              key={item.key}
              type="button"
              role="option"
              aria-selected={false}
              onClick={(e) =>
                item.onClick?.({
                  key: item.key,
                  domEvent: e.nativeEvent as unknown as MouseEvent,
                })
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    ),
  };
});

const item: CatalogItem = {
  id: '1',
  type: CatalogEntityType.Model,
  name: 'ali.deepseek-v4-flash',
  version: '4.0.1',
  lastUsed: 'now',
  description: '',
  folder: [],
  topics: [],
};

const folderItems: PublishFolderNode[] = [
  {
    path: ['Shared'],
    name: 'Shared',
    children: [
      {
        path: ['Shared', 'Data Science'],
        name: 'Data Science',
        children: [
          {
            path: ['Shared', 'Data Science', 'Published models'],
            name: 'Published models',
          },
        ],
      },
    ],
  },
];

const history: PublishHistoryEntry[] = [
  {
    version: '4.0.0',
    publishedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
    publishedBy: 'you',
    folderPath: ['Shared', 'Data Science', 'Published models'],
  },
];

const renderPanel = (props?: Partial<ComponentProps<typeof PublishPanel>>) =>
  render(
    <PublishPanel
      item={item}
      history={history}
      folderItems={folderItems}
      onSelectedFolderPathChange={vi.fn()}
      onCreateFolder={vi.fn()}
      hasExistingVersionInFolder={false}
      hasWriteAccess={true}
      isSubmitting={false}
      {...props}
    />,
  );

describe('PublishPanel', () => {
  it('renders the entity name and current version pill', () => {
    renderPanel();
    expect(screen.getByText('ali.deepseek-v4-flash')).toBeTruthy();
    expect(screen.getByText('Version 4.0.1 · current')).toBeTruthy();
  });

  it('renders the folder section title', () => {
    renderPanel();
    expect(screen.getByText('Publish to folder')).toBeTruthy();
  });

  it('hides the history section until a folder is selected', () => {
    renderPanel();
    expect(screen.queryByText('Versions history')).toBeNull();
  });

  it('shows the history section once a folder is selected', () => {
    renderPanel({ selectedFolderPath: ['Shared', 'Data Science'] });
    expect(screen.getByText('Versions history')).toBeTruthy();
  });

  it('shows the replace-warning callout when the version already exists in the folder, with the folder name bold', () => {
    const { container } = renderPanel({
      selectedFolderPath: ['Shared', 'Data Science', 'Published models'],
      hasExistingVersionInFolder: true,
    });
    expect(container.textContent).toContain(
      'Version 4.0.1 is already published in Published models. Publishing will replace it.',
    );
    expect(container.querySelector('strong')?.textContent).toBe(
      'Published models',
    );
  });

  it('shows the no-access callout when the user lacks write access, with the folder name bold', () => {
    const { container } = renderPanel({
      selectedFolderPath: ['Shared', 'Data Science'],
      hasWriteAccess: false,
    });
    expect(container.textContent).toContain(
      "You don't have permission to publish to Data Science. Pick another, or ask an owner for access.",
    );
    expect(container.querySelector('strong')?.textContent).toBe('Data Science');
  });

  it('shows the submit-error callout when the most recent submit attempt failed', () => {
    renderPanel({
      selectedFolderPath: ['Shared', 'Data Science'],
      hasSubmitError: true,
    });
    expect(
      screen.getByText('Publishing failed. Please try again.'),
    ).toBeTruthy();
  });

  it('hides the callout while submitting', () => {
    renderPanel({
      selectedFolderPath: ['Shared', 'Data Science'],
      isSubmitting: true,
    });
    expect(screen.queryByText(/Everyone with access/)).toBeNull();
  });

  it('renders the empty-history message when there is no publish history for the selected folder', () => {
    renderPanel({
      selectedFolderPath: ['Shared', 'Data Science'],
    });
    expect(
      screen.getByText(
        'Not published to this folder yet — this will be the first version here.',
      ),
    ).toBeTruthy();
  });

  it('renders history rows only for the selected folder', () => {
    renderPanel({
      selectedFolderPath: ['Shared', 'Data Science', 'Published models'],
    });
    expect(screen.getByText('Version 4.0.0')).toBeTruthy();
  });

  it('does not show history from a different folder', () => {
    renderPanel({ selectedFolderPath: ['Shared', 'Data Science'] });
    expect(screen.queryByText('Version 4.0.0')).toBeNull();
  });

  describe('root selection', () => {
    it('shows the history section when the root ([]) is selected', () => {
      renderPanel({ selectedFolderPath: [] });
      expect(screen.getByText('Versions history')).toBeTruthy();
    });

    it('shows the empty-history message for the root when there is no root history', () => {
      renderPanel({ selectedFolderPath: [] });
      expect(
        screen.getByText(
          'Not published to this folder yet — this will be the first version here.',
        ),
      ).toBeTruthy();
    });

    it('uses the root folder label in the no-access callout when the root is selected', () => {
      const { container } = renderPanel({
        selectedFolderPath: [],
        hasWriteAccess: false,
      });
      expect(container.textContent).toContain(
        "You don't have permission to publish to Organization. Pick another, or ask an owner for access.",
      );
    });

    it('uses a custom rootFolderLabel text override', () => {
      const { container } = renderPanel({
        selectedFolderPath: [],
        hasWriteAccess: false,
        texts: { rootFolderLabel: 'Public bucket' },
      });
      expect(container.textContent).toContain(
        "You don't have permission to publish to Public bucket.",
      );
    });
  });
});
