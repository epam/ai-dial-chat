import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ContentTab } from '../Content';

describe('ContentTab', () => {
  it('renders the body as markdown', () => {
    render(
      <ContentTab content={'## Instructions\n\n- first step\n- second step'} />,
    );

    expect(screen.getByRole('heading', { name: 'Instructions' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders the description above the body when present', () => {
    render(
      <ContentTab content="Summarize:" description="Writes a short summary." />,
    );

    expect(screen.getByText('Writes a short summary.')).toBeTruthy();
  });

  it('separates the description from the body with a divider', () => {
    const { container } = render(
      <ContentTab content="Summarize:" description="Writes a short summary." />,
    );

    expect(container.querySelector('[class*="divider"]')).toBeTruthy();
  });

  it('omits the description block when it is empty', () => {
    const { container } = render(<ContentTab content="Summarize:" />);

    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelector('[class*="divider"]')).toBeNull();
  });

  it('highlights a {{placeholder}} apart from the surrounding prose', () => {
    render(<ContentTab content="Reply to {{original_email}} politely." />);

    const variable = screen.getByText('{{original_email}}');
    expect(variable.tagName).toBe('SPAN');
    expect(variable.className).toContain('cat-prompt-variable');
  });

  it('leaves a placeholder inside a code fence unhighlighted', () => {
    render(<ContentTab content={'```\n{{original_email}}\n```'} />);

    expect(
      screen.queryByText(
        (_, element) =>
          element?.className?.includes?.('cat-prompt-variable') ?? false,
      ),
    ).toBeNull();
  });

  it('scrolls the body inside its own container rather than the page', () => {
    render(<ContentTab content="a very long prompt body" />);

    const body = screen.getByText('a very long prompt body');
    /* The markdown paragraph sits inside the scroll container. */
    expect(body.closest('.overflow-auto')).toBeTruthy();
  });

  it('renders no copy control', () => {
    render(<ContentTab content="Summarize:" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
