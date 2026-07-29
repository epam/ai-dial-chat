import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import FooterContainer from '../FooterContainer';

const { mockFlags } = vi.hoisted(() => ({
  mockFlags: { requestApiKey: true, reportAnIssue: true },
}));

vi.mock('../../../context/AppConfigContext', () => ({
  useFeatureFlag: (key: string): boolean => {
    if (key === 'requestApiKey') return mockFlags.requestApiKey;
    if (key === 'reportAnIssue') return mockFlags.reportAnIssue;
    return false;
  },
}));

vi.mock('../../FooterMessage/FooterMessage', () => ({
  default: ({ onDialAction }: { onDialAction: (action: string) => void }) => (
    <div>
      <button type="button" onClick={() => onDialAction('requestApiKey')}>
        Request Key
      </button>
      <button type="button" onClick={() => onDialAction('reportIssue')}>
        Report Issue
      </button>
    </div>
  ),
}));

vi.mock('../RequestApiKeyDialog', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    !isOpen ? null : (
      <div role="dialog" aria-label="RequestApiKeyDialog">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ),
}));

vi.mock('../ReportIssueDialog', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    !isOpen ? null : (
      <div role="dialog" aria-label="ReportIssueDialog">
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>
    ),
}));

describe('FooterContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFlags.requestApiKey = true;
    mockFlags.reportAnIssue = true;
  });

  it('opens RequestApiKeyDialog when requestApiKey action fires', async () => {
    render(<FooterContainer />);

    await userEvent.click(screen.getByText('Request Key'));

    expect(
      screen.getByRole('dialog', { name: 'RequestApiKeyDialog' }),
    ).toBeTruthy();
  });

  it('opens ReportIssueDialog when reportIssue action fires', async () => {
    render(<FooterContainer />);

    await userEvent.click(screen.getByText('Report Issue'));

    expect(
      screen.getByRole('dialog', { name: 'ReportIssueDialog' }),
    ).toBeTruthy();
  });

  it('does not open RequestApiKeyDialog when the requestApiKey flag is off', async () => {
    mockFlags.requestApiKey = false;
    render(<FooterContainer />);

    await userEvent.click(screen.getByText('Request Key'));

    expect(
      screen.queryByRole('dialog', { name: 'RequestApiKeyDialog' }),
    ).toBeNull();
  });

  it('does not open ReportIssueDialog when the reportAnIssue flag is off', async () => {
    mockFlags.reportAnIssue = false;
    render(<FooterContainer />);

    await userEvent.click(screen.getByText('Report Issue'));

    expect(
      screen.queryByRole('dialog', { name: 'ReportIssueDialog' }),
    ).toBeNull();
  });

  it('closes RequestApiKeyDialog when onClose is triggered', async () => {
    render(<FooterContainer />);

    await userEvent.click(screen.getByText('Request Key'));
    expect(
      screen.getByRole('dialog', { name: 'RequestApiKeyDialog' }),
    ).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(
      screen.queryByRole('dialog', { name: 'RequestApiKeyDialog' }),
    ).toBeNull();
  });
});
