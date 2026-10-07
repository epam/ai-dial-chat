import { render, screen } from '@testing-library/react';
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
  });
});
