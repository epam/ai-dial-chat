import { beforeEach, describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import { SettingsSelectors } from '@/src/store/selectors';

import { reportAnIssueHash, requestApiKeyHash } from '@/src/constants/footer';

import { FooterMessage } from '@/src/components/Common/FooterMessage';
import { SystemDialogs } from '@/src/components/Common/SystemDialogs';

import { Feature } from '@epam/ai-dial-shared';

const footerHtmlMessage = `<p data-qa="test">Some footer text.</p><a data-qa="reportAnIssue" href="${reportAnIssueHash}">reportAnIssue</a> and <a data-qa="requestApiKey" href="${requestApiKeyHash}">requestApiKey</a>`;
const footerEnabledFeatures = new Set([
  Feature.Footer,
  Feature.RequestApiKey,
  Feature.ReportAnIssue,
]);

const FooterWithSystemDialogs = () => (
  <>
    <FooterMessage />
    <SystemDialogs />
  </>
);

vi.mock('@/src/store/hooks', () => ({
  useAppSelector: vi.fn((selector) => selector()),
  useAppDispatch: vi.fn((action) => action),
}));

vi.mock('@/src/store/selectors', () => ({
  SettingsSelectors: {
    selectFooterHtmlMessage: vi.fn(() => footerHtmlMessage),
    selectEnabledFeatures: vi.fn(() => footerEnabledFeatures),
    isFeatureEnabled: vi.fn((_, feature: Feature) => {
      return footerEnabledFeatures.has(feature);
    }),
  },
}));

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function makeMockDialog(dataTestId: string) {
  // eslint-disable-next-line react/display-name
  return ({ onClose }: DialogProps) => (
    <div data-qa={dataTestId}>
      <button onClick={onClose}>Close</button>
    </div>
  );
}
const reportIssueDialogTestId = 'reportIssueDialog';
const requestAPIKeyDialogTestId = 'requestAPIKeyDialog';

vi.mock('@/src/components/Chat/ReportIssueDialog', () => ({
  ReportIssueDialog: makeMockDialog('reportIssueDialog'),
}));

vi.mock('@/src/components/Chat/RequestApiKeyDialog', () => ({
  RequestAPIKeyDialog: makeMockDialog('requestAPIKeyDialog'),
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
    vi.mocked(SettingsSelectors.isFeatureEnabled).mockImplementation(
      (_, feature) => footerEnabledFeatures.has(feature),
    );
  });

  it('renders footerHtmlMessage properly', async () => {
    render(<FooterWithSystemDialogs />);

    const textElement = screen.getByTestId('test');
    const reportAnIssueLink = screen.getByTestId('reportAnIssue');
    const requestApiKeyLink = screen.getByTestId('requestApiKey');

    expect(textElement).toBeInTheDocument();
    expect(textElement?.textContent).toEqual('Some footer text.');
    expect(reportAnIssueLink).toBeInTheDocument();
    expect(requestApiKeyLink).toBeInTheDocument();
  });

  it('renders nothing when footer feature is disabled', async () => {
    const footerFeatures = new Set([
      Feature.RequestApiKey,
      Feature.ReportAnIssue,
    ]);
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(
      footerFeatures,
    );
    vi.mocked(SettingsSelectors.isFeatureEnabled).mockImplementation(
      (_, feature) => footerFeatures.has(feature),
    );
    const { container } = await render(<FooterWithSystemDialogs />);

    expect(container).toBeEmptyDOMElement();
  });

  it('does not open the request api key dialog if this option is disabled', async () => {
    const footerFeatures = new Set([Feature.Footer, Feature.ReportAnIssue]);
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(
      footerFeatures,
    );
    vi.mocked(SettingsSelectors.isFeatureEnabled).mockImplementation(
      (_, feature) => footerFeatures.has(feature),
    );
    await render(<FooterWithSystemDialogs />);
    const requestApiKeyLink = screen.getByTestId('requestApiKey');

    await userEvent.click(requestApiKeyLink);

    await expect(async () => {
      await screen.findByTestId(requestAPIKeyDialogTestId);
    }).rejects.toEqual(expect.anything());
  });

  it('opens the request api key dialog and closes it by executing onClose', async () => {
    await render(<FooterWithSystemDialogs />);
    const requestApiKeyLink = screen.getByTestId('requestApiKey');

    await userEvent.click(requestApiKeyLink);

    await screen.findByTestId(requestAPIKeyDialogTestId);

    const button = screen.getByText('Close');

    await userEvent.click(button);

    await expect(async () => {
      await screen.findByTestId(requestAPIKeyDialogTestId);
    }).rejects.toEqual(expect.anything());
  });

  it('does not open the request an issue dialog if this option is disabled', async () => {
    const footerFeatures = new Set([Feature.Footer, Feature.RequestApiKey]);
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(
      footerFeatures,
    );
    vi.mocked(SettingsSelectors.isFeatureEnabled).mockImplementation(
      (_, feature) => footerFeatures.has(feature),
    );
    render(<FooterWithSystemDialogs />);
    const reportAnIssueLink = screen.getByTestId('reportAnIssue');

    await userEvent.click(reportAnIssueLink);

    await expect(async () => {
      await screen.findByTestId(reportIssueDialogTestId);
    }).rejects.toEqual(expect.anything());
  });

  it('opens the request an issue dialog and closes it by executing onClose', async () => {
    render(<FooterWithSystemDialogs />);
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
