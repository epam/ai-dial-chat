import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CredentialsIdentityIcon } from '../CredentialsIdentityIcon';

vi.mock('@epam/ai-dial-ui-kit', async () => ({
  /* The real live region: a hand-rolled stub would hide its always-mounted markup. */
  ...(await vi
    .importActual<typeof import('@epam/ai-dial-ui-kit')>('@epam/ai-dial-ui-kit')
    .then(({ LiveRegion, LiveRegionElement }) => ({
      LiveRegion,
      LiveRegionElement,
    }))),
  DIAL_KIT_ICON_STROKE: 1.5,
  DIAL_ICON_SIZE: { SM: 16, MD: 20, LG: 24 },
}));

/* The badge is decorative in production, so it has no accessible name of its
   own — the mock renders text the queries can look for instead. */
vi.mock('@tabler/icons-react', () => ({
  IconCircleCheckFilled: () => <span>active badge</span>,
}));

const icon = <span>Level icon</span>;

describe('CredentialsIdentityIcon', () => {
  it('renders the level icon it is given', () => {
    render(<CredentialsIdentityIcon icon={icon} />);
    expect(screen.getByText('Level icon')).toBeTruthy();
  });

  it('omits the checkmark badge for a level that is not in effect', () => {
    render(<CredentialsIdentityIcon icon={icon} />);
    expect(screen.queryByText('active badge')).toBeNull();
  });

  it('shows the checkmark badge for the level in effect', () => {
    render(<CredentialsIdentityIcon icon={icon} isActive />);
    expect(screen.getByText('active badge')).toBeTruthy();
  });

  it('announces nothing when no status label is supplied', () => {
    render(<CredentialsIdentityIcon icon={icon} isActive />);
    expect(screen.queryByText('Signed in')).toBeNull();
  });

  it('announces the status when a label is supplied', () => {
    render(
      <CredentialsIdentityIcon icon={icon} isActive statusLabel="Signed in" />,
    );
    expect(screen.getByText('Signed in')).toBeTruthy();
  });

  it('keeps one status region and swaps its text when the level signs in', () => {
    const { rerender } = render(
      <CredentialsIdentityIcon icon={icon} statusLabel="Signed out" />,
    );
    const status = screen.getByRole('status');
    expect(status.textContent).toBe('Signed out');

    rerender(
      <CredentialsIdentityIcon icon={icon} isActive statusLabel="Signed in" />,
    );

    expect(screen.getByRole('status')).toBe(status);
    expect(status.textContent).toBe('Signed in');
  });
});
