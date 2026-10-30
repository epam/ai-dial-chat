import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectChatHeader } from '../ProjectChatHeader';

describe('ProjectChatHeader', () => {
  it('goes back from the button and links the project name', async () => {
    const onBack = vi.fn();
    const onProjectLinkClick = vi.fn((event) => event.preventDefault());
    render(
      <ProjectChatHeader
        projectName="Q4 launch"
        projectHref="/projects/view/a1b2c3/q4"
        onBack={onBack}
        onProjectLinkClick={onProjectLinkClick}
        backLabel="Back to Q4 launch"
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Back to Q4 launch' }),
    );
    const link = screen.getByRole('link');
    await userEvent.click(link);

    expect(onBack).toHaveBeenCalledOnce();
    expect(onProjectLinkClick).toHaveBeenCalledOnce();
    expect(link.getAttribute('href')).toBe('/projects/view/a1b2c3/q4');
    expect(
      screen.getByRole('navigation', { name: 'Back to Q4 launch' }),
    ).toBeTruthy();
  });

  it('mirrors the back arrow in RTL', () => {
    document.documentElement.dir = 'rtl';
    render(
      <ProjectChatHeader
        projectName="Q4 launch"
        projectHref="/projects/view/a1b2c3/q4"
        onBack={vi.fn()}
        backLabel="Back to Q4 launch"
      />,
    );

    const button = screen.getByRole('button', { name: 'Back to Q4 launch' });
    // eslint-disable-next-line testing-library/no-node-access -- the mirror is a CSS class on the decorative icon, which no query reaches
    expect(button.querySelector('svg')?.getAttribute('class')).toContain(
      'rtl:scale-x-[-1]',
    );
    document.documentElement.dir = 'ltr';
  });
});
