import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { buildDeploymentIcon } from '../deployment';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    DeploymentIcon: ({
      src,
      initialsName,
    }: {
      src?: string;
      initialsName?: string;
    }) => (
      <div>
        {src && <img src={src} alt="" />}
        {!src && <span data-testid="initials">{initialsName ?? ''}</span>}
      </div>
    ),
  };
});

describe('buildDeploymentIcon', () => {
  it('renders DeploymentIcon with initialsName when no icon URL', () => {
    render(<>{buildDeploymentIcon(undefined, undefined, 'My App')}</>);
    expect(screen.getByTestId('initials').textContent).toBe('My App');
  });

  it('renders DeploymentIcon with src when icon URL is provided', () => {
    render(
      <>
        {buildDeploymentIcon(
          'https://example.com/icon.png',
          undefined,
          'My App',
        )}
      </>,
    );
    expect(screen.getByRole('presentation')).toBeTruthy();
  });

  it('passes empty string initialsName when displayName is empty', () => {
    render(<>{buildDeploymentIcon(undefined, undefined, '')}</>);
    expect(screen.getByTestId('initials').textContent).toBe('');
  });
});
