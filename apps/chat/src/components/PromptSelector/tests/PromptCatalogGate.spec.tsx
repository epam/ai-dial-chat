import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PromptCatalogGate from '../PromptCatalogGate';

const mocks = vi.hoisted(() => ({ isAfterLoadIdle: false }));

vi.mock('../../../hooks/useIsAfterLoadIdle', () => ({
  useIsAfterLoadIdle: () => mocks.isAfterLoadIdle,
}));

describe('PromptCatalogGate', () => {
  beforeEach(() => {
    mocks.isAfterLoadIdle = false;
  });

  it('renders nothing while the page loads and the catalog is closed', () => {
    render(
      <PromptCatalogGate isOpen={false}>
        <p>Prompt catalog</p>
      </PromptCatalogGate>,
    );

    expect(screen.queryByText('Prompt catalog')).toBeNull();
  });

  it('renders the catalog when it opens, and keeps it after it closes', () => {
    const { rerender } = render(
      <PromptCatalogGate isOpen>
        <p>Prompt catalog</p>
      </PromptCatalogGate>,
    );
    expect(screen.getByText('Prompt catalog')).toBeTruthy();

    rerender(
      <PromptCatalogGate isOpen={false}>
        <p>Prompt catalog</p>
      </PromptCatalogGate>,
    );

    expect(screen.getByText('Prompt catalog')).toBeTruthy();
  });

  it('renders the closed catalog once the page has loaded', () => {
    mocks.isAfterLoadIdle = true;
    render(
      <PromptCatalogGate isOpen={false}>
        <p>Prompt catalog</p>
      </PromptCatalogGate>,
    );

    expect(screen.getByText('Prompt catalog')).toBeTruthy();
  });
});
