import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillFileDropOverlay } from '../SkillFileDropOverlay';

vi.mock('@tabler/icons-react', () => ({
  IconUpload: () => <svg />,
}));

describe('SkillFileDropOverlay', () => {
  it('keeps an empty status region mounted while hidden and fills it when shown', () => {
    const { rerender } = render(<SkillFileDropOverlay isVisible={false} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');
    expect(screen.queryByText('Upload files')).toBeNull();

    rerender(<SkillFileDropOverlay isVisible />);

    expect(screen.getByRole('status')).toBe(status);
    expect(status.textContent).toBe(
      'Upload files. Drop files here to add them to this skill',
    );
  });

  it('shows the default title and subtitle when visible', () => {
    render(<SkillFileDropOverlay isVisible />);

    expect(screen.getByText('Upload files')).toBeTruthy();
    expect(
      screen.getByText('Drop files here to add them to this skill'),
    ).toBeTruthy();
  });

  it('renders host-supplied labels', () => {
    render(
      <SkillFileDropOverlay
        isVisible
        labels={{
          dropOverlayTitle: 'Custom title',
          dropOverlaySubtitle: 'Custom subtitle',
        }}
      />,
    );

    expect(screen.getByText('Custom title')).toBeTruthy();
    expect(screen.getByText('Custom subtitle')).toBeTruthy();
  });
});
