import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SkillFileDropOverlay } from '../SkillFileDropOverlay';

vi.mock('@tabler/icons-react', () => ({
  IconUpload: () => <svg />,
}));

describe('SkillFileDropOverlay', () => {
  it('renders nothing when not visible', () => {
    render(<SkillFileDropOverlay isVisible={false} />);

    expect(screen.queryByRole('status')).toBeNull();
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
