import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SkillFilesSummaryProps } from '../../../models/skill-files-summary-props';
import { SkillFilesSummary } from '../SkillFilesSummary';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { LG: 24, MD: 20, SM: 16 },
  DialItemType: { File: 'file', Folder: 'folder' },
  FileIcon: () => null,
}));

describe('SkillFilesSummary', () => {
  const renderSummary = (props?: Partial<SkillFilesSummaryProps>) =>
    render(
      <SkillFilesSummary
        label="Editing file"
        fileName="SKILL.md"
        isExpanded={false}
        onToggle={vi.fn()}
        {...props}
      >
        <span>Files tree</span>
      </SkillFilesSummary>,
    );

  it('names the summary button by its caption and the file name', () => {
    renderSummary();

    expect(
      screen.getByRole('button', { name: 'Editing file SKILL.md' }),
    ).toBeTruthy();
  });

  it('calls onToggle with the next expanded state when the summary is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    const onToggle = vi.fn();
    renderSummary({ onToggle });

    await user.click(screen.getByRole('button', { name: /Editing file/ }));

    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('marks the collapsed content inert and the button collapsed', () => {
    renderSummary();

    const button = screen.getByRole('button', { name: /Editing file/ });
    const contentId = button.getAttribute('aria-controls') ?? '';

    expect(button.getAttribute('aria-expanded')).toBe('false');
    // eslint-disable-next-line testing-library/no-node-access -- `inert` sits on the unlabeled wrapper around the region, which has no role of its own
    expect(document.getElementById(contentId)?.closest('[inert]')).toBeTruthy();
  });

  it('exposes the revealed content as a region labelled by the summary when expanded', () => {
    renderSummary({ isExpanded: true });

    expect(
      screen
        .getByRole('button', { name: /Editing file/ })
        .getAttribute('aria-expanded'),
    ).toBe('true');
    expect(
      screen.getByRole('region', { name: 'Editing file SKILL.md' }),
    ).toBeTruthy();
    expect(screen.getByText('Files tree')).toBeTruthy();
  });
});
