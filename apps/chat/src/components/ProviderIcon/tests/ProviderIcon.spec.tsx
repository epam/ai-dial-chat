import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProviderIcon, { getProviderIconUrl } from '../ProviderIcon';

describe('ProviderIcon', () => {
  it('encodes the normalized provider ID as a single URL path segment', () => {
    expect(getProviderIconUrl('custom/provider 2')).toBe(
      'https://authjs.dev/img/providers/custom%2Fprovider%20.svg',
    );
  });

  it('hides the icon when loading fails', () => {
    const { container } = render(<ProviderIcon providerId="keycloak" />);
    // The icon is decorative (alt="" + aria-hidden), so it has no accessible
    // role/name for a semantic query to target; container access is the only
    // way to reach it to assert the CSS-level "hidden" class toggle.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const icon = container.querySelector('img');

    expect(icon).not.toBeNull();
    if (!icon) return;

    fireEvent.error(icon);
    expect(icon?.classList.contains('hidden')).toBe(true);
  });
});
