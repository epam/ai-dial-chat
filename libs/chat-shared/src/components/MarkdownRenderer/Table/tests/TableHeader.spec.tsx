import { DIAL_ICON_SIZE, DIAL_KIT_ICON_STROKE } from '@epam/ai-dial-ui-kit';
import { IconDownload } from '@tabler/icons-react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TableHeader } from '../TableHeader';

class IntersectionObserverMock {
  observe() {
    // No-op in JSDOM.
  }
  unobserve() {
    // No-op in JSDOM.
  }
  disconnect() {
    // No-op in JSDOM.
  }
}

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TableHeader', () => {
  it('renders action descriptors as accessible tooltip buttons', async () => {
    const user = userEvent.setup({ delay: null });
    const onClick = vi.fn();

    render(
      <TableHeader
        actions={[
          {
            label: 'Export table',
            icon: (
              <IconDownload
                size={DIAL_ICON_SIZE.SM}
                stroke={DIAL_KIT_ICON_STROKE}
              />
            ),
            onClick,
          },
        ]}
      >
        Results
      </TableHeader>,
    );

    expect(screen.getByText('Results')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Export table' });

    await user.hover(button);
    expect(await screen.findByText('Export table')).toBeTruthy();

    await user.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });
});
