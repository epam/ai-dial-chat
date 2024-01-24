import { FooterMessage, reportAnIssueHash, requestApiKeyHash } from '@/src/components/Common/FooterMessage';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { Feature } from '@/src/types/features';
import { getByText, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const footerHtmlMessage = `<p data-qa="test">Some footer text.</p><a data-qa="reportAnIssue" href="${reportAnIssueHash}">reportAnIssue</a> and <a data-qa="requestApiKey" href="${requestApiKeyHash}">requestApiKey</a>`;
const footerEnabledFeatures = new Set([Feature.Footer, Feature.RequestApiKey, Feature.ReportAnIssue]);
const mockBasePath = '/base/';
const mockReplace = vi.fn();

vi.mock('next/router', () => ({
    useRouter: vi.fn(() => ({
        basePath: mockBasePath,
        replace: mockReplace
    }))
}));

vi.mock('@/src/store/hooks', () => ({
  useAppSelector: vi.fn((selector)=> selector()),
  useAppDispatch: vi.fn(action => action)
}));

vi.mock('@/src/store/settings/settings.reducers', () => ({
    SettingsSelectors: {
      selectFooterHtmlMessage: vi.fn(() => footerHtmlMessage),
      selectEnabledFeatures: vi.fn(() => footerEnabledFeatures)
    }
}));

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
}

function makeMockDialog (dataTestId: string) {
  return ({ isOpen, onClose }: DialogProps) => (isOpen ? <div data-qa={dataTestId}><button onClick={onClose}>Close</button></div> : null);
}
const reportIssueDialogTestId = "reportIssueDialog";
const requestAPIKeyDialogTestId = "requestAPIKeyDialog";

vi.mock('@/src/components/Chat/ReportIssueDialog', ()=>({
   ReportIssueDialog: makeMockDialog("reportIssueDialog")
}));

vi.mock('@/src/components/Chat/RequestApiKeyDialog', ()=>({
   RequestAPIKeyDialog: makeMockDialog("requestAPIKeyDialog")
}))

describe('FooterMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(SettingsSelectors.selectFooterHtmlMessage).mockReturnValue(footerHtmlMessage);
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(footerEnabledFeatures);
  });

  it('renders footerHtmlMessage properly', async () => {
    render(<FooterMessage />);

    const textElement = screen.getByTestId('test');
    const reportAnIssueLink = screen.getByTestId('reportAnIssue');
    const requestApiKeyLink = screen.getByTestId('requestApiKey');

    expect(textElement).toBeInTheDocument();
    expect(textElement?.textContent).toEqual("Some footer text.");
    expect(reportAnIssueLink).toBeInTheDocument();
    expect(requestApiKeyLink).toBeInTheDocument();
  });

  it('renders nothing when footer feature is disabled', async () => {
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(new Set([Feature.RequestApiKey, Feature.ReportAnIssue]));
    const { container } = await render(<FooterMessage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('does not open the request api key dialog if this option is disabled', async () => {
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(new Set([Feature.Footer, Feature.ReportAnIssue]));
    const { getByTestId } = await render(<FooterMessage />);
    const requestApiKeyLink = getByTestId('requestApiKey');

    await userEvent.click(requestApiKeyLink);

    await expect(async () => {
        await screen.findByTestId(requestAPIKeyDialogTestId)
    }).rejects.toEqual(expect.anything());
  });

  it('opens the request api key dialog and closes it by executing onClose', async () => {
    const { getByTestId } = await render(<FooterMessage />);
    const requestApiKeyLink = getByTestId('requestApiKey');

    await userEvent.click(requestApiKeyLink);

    await waitFor(() => expect(getByTestId(requestAPIKeyDialogTestId)).toBeInTheDocument());

    const dialog = getByTestId(requestAPIKeyDialogTestId)

    const button = getByText(dialog, 'Close');

    await userEvent.click(button);

    await expect(async () => {
        await screen.findByTestId(requestAPIKeyDialogTestId);
    }).rejects.toEqual(expect.anything());

    expect(mockReplace).toHaveBeenCalledWith(mockBasePath);
  });

  it('does not open the request an issue dialog if this option is disabled', async () => {
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(new Set([Feature.Footer, Feature.RequestApiKey]));
    render(<FooterMessage />);
    const reportAnIssueLink = screen.getByTestId('reportAnIssue');

    await userEvent.click(reportAnIssueLink);

    await expect(async () => {
        await screen.findByTestId(reportIssueDialogTestId);
    }).rejects.toEqual(expect.anything());
  });

  it('opens the request an issue dialog and closes it by executing onClose', async () => {
    render(<FooterMessage />);
    const reportAnIssueLink = screen.getByTestId('reportAnIssue');

    await userEvent.click(reportAnIssueLink);

    await waitFor(() => expect(screen.getByTestId(reportIssueDialogTestId)).toBeInTheDocument());

    const dialog = screen.getByTestId(reportIssueDialogTestId)

    const button = await getByText(dialog, 'Close');

    await userEvent.click(button);

    await expect(async () => {
        await screen.findByTestId(reportIssueDialogTestId)
    }).rejects.toEqual(expect.anything());

    expect(mockReplace).toHaveBeenCalledWith(mockBasePath);
  });
});
