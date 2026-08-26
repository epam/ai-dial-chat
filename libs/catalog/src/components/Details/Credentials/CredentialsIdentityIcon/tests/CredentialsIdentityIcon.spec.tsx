import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CredentialsIdentityIcon } from '../CredentialsIdentityIcon';

vi.mock('@epam/ai-dial-ui-kit', () => ({
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
});
