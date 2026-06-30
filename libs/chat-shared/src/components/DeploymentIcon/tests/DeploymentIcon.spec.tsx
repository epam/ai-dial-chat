import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { type DeploymentIconProps, DeploymentIcon } from '../DeploymentIcon';

vi.mock('@epam/ai-dial-ui-kit', () => ({
  DialTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const renderIcon = (
  props: Omit<DeploymentIconProps, 'size' | 'initialsName'> &
    Partial<Pick<DeploymentIconProps, 'initialsName'>> = {},
) => render(<DeploymentIcon size={36} initialsName="" {...props} />);

describe('DeploymentIcon', () => {
  it('renders InitialsAvatar with initialsName when src is absent', () => {
    renderIcon({ initialsName: 'My App' });
    expect(screen.getByText('MA')).toBeTruthy();
  });

  it('renders InitialsAvatar with "?" when initialsName is empty', () => {
    renderIcon({ initialsName: '' });
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('renders the image when src is provided', () => {
    const { container } = renderIcon({
      src: 'https://example.com/icon.png',
      initialsName: 'My App',
    });
    const img = container.querySelector('img');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('src')).toBe('https://example.com/icon.png');
  });

  it('renders custom fallback node when fallback prop is provided', () => {
    renderIcon({ fallback: <span>custom</span> });
    expect(screen.getByText('custom')).toBeTruthy();
  });
});
