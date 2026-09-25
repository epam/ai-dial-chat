import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillInfoTooltipContent } from '../SkillInfoTooltipContent';

describe('SkillInfoTooltipContent', () => {
  it('applies viewDetailsTabIndex to the View details button', () => {
    render(
      <SkillInfoTooltipContent
        onViewDetails={vi.fn()}
        viewDetailsTabIndex={-1}
      />,
    );

    expect(
      screen
        .getByRole('button', { name: 'View details' })
        .getAttribute('tabindex'),
    ).toBe('-1');
  });

  it('keeps the View details button in the Tab sequence by default', () => {
    render(<SkillInfoTooltipContent onViewDetails={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'View details' });
    expect(button.hasAttribute('tabindex')).toBe(false);
  });
});
