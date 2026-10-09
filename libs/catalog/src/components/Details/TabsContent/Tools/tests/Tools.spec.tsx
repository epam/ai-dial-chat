import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { CatalogItemTools } from '../../../../../models/item-details-data';
import { Tools } from '../Tools';

const TOOLS: CatalogItemTools = {
  tools: [
    {
      name: 'search',
      description: 'Searches files',
      inputParams: [{ name: 'query', type: 'string', isRequired: true }],
      annotations: [{ key: 'readOnly', value: 'true' }],
    },
  ],
};

describe('Tools', () => {
  it('heads its grids in English by default', () => {
    render(<Tools tools={TOOLS} />);

    for (const heading of ['Name', 'Type', 'Required', 'Key', 'Value']) {
      expect(screen.getByText(heading)).toBeTruthy();
    }
  });

  it('uses the headings the host supplies, keeping defaults for the rest', () => {
    render(
      <Tools
        tools={TOOLS}
        labels={{ inputName: 'Nom', annotationValue: 'Valeur' }}
      />,
    );

    expect(screen.getByText('Nom')).toBeTruthy();
    expect(screen.getByText('Valeur')).toBeTruthy();
    expect(screen.queryByText('Name')).toBeNull();
    expect(screen.getByText('Type')).toBeTruthy();
  });

  it('renders nothing without tools', () => {
    render(<Tools />);

    expect(screen.queryByText('Name')).toBeNull();
    expect(screen.queryByText('Key')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  describe('search and count', () => {
    const MANY_TOOLS: CatalogItemTools = {
      tools: [
        { name: 'notion-search', description: 'Searches pages' },
        { name: 'notion-fetch', description: 'Fetches a page' },
        { name: 'create-attachment', description: 'Uploads a FILE' },
      ],
    };

    it('shows the total number of tools and a search field', () => {
      render(<Tools tools={MANY_TOOLS} />);

      expect(screen.getByRole('status').textContent).toBe('3 tools');
      expect(screen.getByRole('textbox', { name: 'Search...' })).toBeTruthy();
    });

    it('narrows the list by name or description, ignoring case', () => {
      render(<Tools tools={MANY_TOOLS} />);
      const search = screen.getByRole('textbox');

      fireEvent.change(search, { target: { value: 'NOTION' } });
      expect(screen.getByText('notion-search')).toBeTruthy();
      expect(screen.getByText('notion-fetch')).toBeTruthy();
      expect(screen.queryByText('create-attachment')).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('2 tools');

      fireEvent.change(search, { target: { value: ' file ' } });
      expect(screen.getByText('create-attachment')).toBeTruthy();
      expect(screen.queryByText('notion-fetch')).toBeNull();
      expect(screen.getByRole('status').textContent).toBe('1 tools');
    });

    it('says so when the search matches no tool', () => {
      render(<Tools tools={MANY_TOOLS} />);

      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: 'nothing-like-this' },
      });

      expect(screen.getByText('No results found')).toBeTruthy();
      expect(screen.getByRole('status').textContent).toBe('0 tools');
    });

    it('uses the search, count and no-results strings the host supplies', () => {
      render(
        <Tools
          tools={MANY_TOOLS}
          labels={{
            searchPlaceholder: 'Rechercher',
            toolCount: (count) => `${count} outils`,
            noResults: 'Aucun résultat',
          }}
        />,
      );

      expect(screen.getByRole('status').textContent).toBe('3 outils');
      fireEvent.change(screen.getByRole('textbox', { name: 'Rechercher' }), {
        target: { value: 'zzz' },
      });
      expect(screen.getByText('Aucun résultat')).toBeTruthy();
    });
  });
});
