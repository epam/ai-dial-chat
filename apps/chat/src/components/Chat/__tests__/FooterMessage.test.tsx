import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { UISelectors } from '@/src/store/ui/ui.reducers';

import { CHINA_TIME_ZONE_OFFSET } from '@/src/constants/chat';

import {
  FooterMessage,
  reportAnIssueHash,
  requestApiKeyHash,
} from '@/src/components/Common/FooterMessage';

import { Feature } from '@epam/ai-dial-shared';

const footerHtmlMessage = `<p data-qa="test">Some footer text.</p><a data-qa="reportAnIssue" href="${reportAnIssueHash}">reportAnIssue</a> and <a data-qa="requestApiKey" href="${requestApiKeyHash}">requestApiKey</a>`;
const footerEnabledFeatures = new Set([
  Feature.Footer,
  Feature.RequestApiKey,
  Feature.ReportAnIssue,
]);
const timeZoneOffset = 0;

vi.mock('@/src/store/hooks', () => ({
  useAppSelector: vi.fn((selector) => selector()),
  useAppDispatch: vi.fn((action) => action),
}));

vi.mock('@/src/store/settings/settings.reducers', () => ({
  SettingsSelectors: {
    selectFooterHtmlMessage: vi.fn(() => footerHtmlMessage),
    selectEnabledFeatures: vi.fn(() => footerEnabledFeatures),
  },
}));
vi.mock('@/src/store/ui/ui.reducers', () => ({
  UISelectors: {
    selectTimeZoneOffset: vi.fn(() => timeZoneOffset),
  },
}));

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function makeMockDialog(dataTestId: string) {
  // eslint-disable-next-line react/display-name
  return ({ isOpen, onClose }: DialogProps) =>
    isOpen ? (
      <div data-qa={dataTestId}>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null;
}
const reportIssueDialogTestId = 'reportIssueDialog';
const requestAPIKeyDialogTestId = 'requestAPIKeyDialog';

vi.mock('@/src/components/Chat/ReportIssueDialog', () => ({
  ReportIssueDialog: makeMockDialog('reportIssueDialog'),
}));

vi.mock('@/src/components/Chat/RequestApiKeyDialog', () => ({
  RequestAPIKeyDialog: makeMockDialog('requestAPIKeyDialog'),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: vi.fn((key) => key),
  }),
}));

describe('FooterMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(SettingsSelectors.selectFooterHtmlMessage).mockReturnValue(
      footerHtmlMessage,
    );
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(
      footerEnabledFeatures,
    );
    vi.mocked(UISelectors.selectTimeZoneOffset).mockReturnValue(timeZoneOffset);
  });

  it('renders footerHtmlMessage properly', async () => {
    render(<FooterMessage />);

    const footerMessageContainer = screen.getByTestId('footer-message');
    const footerMessageText = screen.getByText('common.footer.message');

    expect(footerMessageContainer).toBeInTheDocument();
    expect(footerMessageText).toBeInTheDocument();
    expect(footerMessageText.tagName).toBe('SPAN');
  });

  it('renders footerHtmlMessage properly for Chines time zone', async () => {
    vi.mocked(UISelectors.selectTimeZoneOffset).mockReturnValue(
      CHINA_TIME_ZONE_OFFSET,
    );

    render(<FooterMessage />);

    const footerMessageContainer = screen.getByTestId('footer-message');
    const footerMessageText = screen.getByText('footer_msg_zh');

    expect(footerMessageContainer).toBeInTheDocument();
    expect(footerMessageText).toBeInTheDocument();
    expect(footerMessageText.tagName).toBe('SPAN');
  });

  it('renders nothing when footer feature is disabled', async () => {
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(
      new Set([Feature.RequestApiKey, Feature.ReportAnIssue]),
    );
    const { container } = await render(<FooterMessage />);

    expect(container).toBeEmptyDOMElement();
  });

  it.skip('does not open the request api key dialog if this option is disabled', async () => {
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(
      new Set([Feature.Footer, Feature.ReportAnIssue]),
    );
    await render(<FooterMessage />);
    const requestApiKeyLink = screen.getByTestId('requestApiKey');

    await userEvent.click(requestApiKeyLink);

    await expect(async () => {
      await screen.findByTestId(requestAPIKeyDialogTestId);
    }).rejects.toEqual(expect.anything());
  });

  it.skip('opens the request api key dialog and closes it by executing onClose', async () => {
    await render(<FooterMessage />);
    const requestApiKeyLink = screen.getByTestId('requestApiKey');

    await userEvent.click(requestApiKeyLink);

    await screen.findByTestId(requestAPIKeyDialogTestId);

    const button = screen.getByText('Close');

    await userEvent.click(button);

    await expect(async () => {
      await screen.findByTestId(requestAPIKeyDialogTestId);
    }).rejects.toEqual(expect.anything());
  });

  it.skip('does not open the request an issue dialog if this option is disabled', async () => {
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(
      new Set([Feature.Footer, Feature.RequestApiKey]),
    );
    render(<FooterMessage />);
    const reportAnIssueLink = screen.getByTestId('reportAnIssue');

    await userEvent.click(reportAnIssueLink);

    await expect(async () => {
      await screen.findByTestId(reportIssueDialogTestId);
    }).rejects.toEqual(expect.anything());
  });

  it.skip('opens the request an issue dialog and closes it by executing onClose', async () => {
    render(<FooterMessage />);
    const reportAnIssueLink = screen.getByTestId('reportAnIssue');

    await userEvent.click(reportAnIssueLink);

    await screen.findByTestId(reportIssueDialogTestId);

    const button = screen.getByText('Close');

    await userEvent.click(button);

    await expect(async () => {
      await screen.findByTestId(reportIssueDialogTestId);
    }).rejects.toEqual(expect.anything());
  });
});
