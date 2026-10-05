import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BuilderFormHeader } from '../BuilderFormHeader';

const labels = {
  title: 'Task editor',
  backButtonLabel: 'Back',
  cancelButtonLabel: 'Cancel',
  submitButtonLabel: 'Save',
};

describe('BuilderFormHeader', () => {
  it('matches the scheduled-task detail header padding at mobile and desktop breakpoints', () => {
    render(
      <BuilderFormHeader
        labels={labels}
        onBack={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    /* The header wrapper has no semantic role of its own. */
    const heading = screen.getByRole('heading', { name: 'Task editor' });
    // eslint-disable-next-line testing-library/no-node-access
    const header = heading.closest('.px-4');
    expect(header?.classList).toContain('py-2');
    expect(header?.classList).toContain('desktop:px-8');
    expect(header?.classList).toContain('desktop:py-0');
  });

  it('uses the default icon when omitted and renders a supplied icon node', () => {
    const { rerender } = render(
      <BuilderFormHeader
        labels={labels}
        onBack={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();

    rerender(
      <BuilderFormHeader
        labels={labels}
        onBack={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        backIcon={<span data-testid="custom-back-icon" />}
      />,
    );
    expect(screen.getByTestId('custom-back-icon')).toBeTruthy();
  });

  it('allows a host to suppress the decorative icon without removing the accessible back control', () => {
    render(
      <BuilderFormHeader
        labels={labels}
        onBack={vi.fn()}
        onCancel={vi.fn()}
        onSubmit={vi.fn()}
        backIcon={null}
      />,
    );
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });
});
