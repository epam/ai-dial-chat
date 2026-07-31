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
    const icon = container.querySelector('img');

    expect(icon).not.toBeNull();
    if (!icon) return;

    fireEvent.error(icon);
    expect(icon?.classList.contains('hidden')).toBe(true);
  });
});
