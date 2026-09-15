import type { StarterOption } from '@epam/ai-dial-chat-shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StarterButtons } from '../StarterButtons';

const labels = { list: 'Conversation starters', overflow: 'More starters' };

const buildStarters = (count: number): StarterOption[] =>
  Array.from({ length: count }, (_, index) => ({
    const: index,
    title: `Starter ${index}`,
    'dial:widgetOptions': {
      populateText: `Prompt ${index}`,
      submit: false,
      confirmationMessage: null,
    },
  }));

describe('StarterButtons', () => {
  it('collapses the starters that do not fit into an overflow menu by default', () => {
    render(
      <StarterButtons
        starters={buildStarters(6)}
        onSelect={vi.fn()}
        labels={labels}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    expect(screen.getByRole('button', { name: labels.overflow })).toBeDefined();
    expect(screen.queryByText('Starter 5')).toBeNull();
  });

  it('renders every starter and no overflow menu when collapsing is off', () => {
    render(
      <StarterButtons
        starters={buildStarters(6)}
        onSelect={vi.fn()}
        isCollapsible={false}
        labels={labels}
      />,
    );

    expect(screen.getAllByRole('listitem')).toHaveLength(6);
    expect(screen.getByText('Starter 5')).toBeDefined();
    expect(screen.queryByRole('button', { name: labels.overflow })).toBeNull();
  });
});
