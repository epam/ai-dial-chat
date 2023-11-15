import { FooterMessage, reportAnIssueHash, requestApiKeyHash } from '@/src/components/Chat/FooterMessage';
import { SettingsSelectors } from '@/src/store/settings/settings.reducers';
import { Feature } from '@/src/types/features';
import { cleanup, fireEvent, getByText, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const footerHtmlMessage = `<p data-qa="test">Some footer text.</p><a data-qa="reportAnIssue" href="${reportAnIssueHash}">reportAnIssue</a> and <a data-qa="requestApiKey" href="${requestApiKeyHash}">requestApiKey</a>`;
const footerEnabledFeatures = ['footer', 'request-api-key', 'report-an-issue'] as Feature[];
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

vi.mock('../ReportIssueDialog', ()=>({
   ReportIssueDialog: makeMockDialog("reportIssueDialog")
}));

vi.mock('../RequestAPIKeyDialog', ()=>({
   RequestAPIKeyDialog: makeMockDialog("requestAPIKeyDialog")
}))

describe('FooterMessage', () => {
  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(footerEnabledFeatures);
  });

  it('renders footerHtmlMessage properly', async () => {
    const { queryByTestId } = await render(<FooterMessage />);

    const textElement = queryByTestId('test');
    const reportAnIssueLink = queryByTestId('reportAnIssue');
    const requestApiKeyLink = queryByTestId('requestApiKey');

    expect(textElement).toBeInTheDocument();
    expect(textElement?.textContent).toEqual("Some footer text.");
    expect(reportAnIssueLink).toBeInTheDocument();
    expect(requestApiKeyLink).toBeInTheDocument();
  });

  it('renders nothing when footer feature is disabled', async () => {
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(['report-an-issue', 'request-api-key']);
    const { container } = await render(<FooterMessage />);

    expect(container).toBeEmptyDOMElement();
  });

  it('does not open the request api key dialog if this option is disabled', async () => {
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(['footer', 'report-an-issue']);
    const { getByTestId } = await render(<FooterMessage />);
    const requestApiKeyLink = getByTestId('requestApiKey');

    fireEvent.click(requestApiKeyLink);

    await expect(async () => {
        await waitFor(
            () => expect(getByTestId(requestAPIKeyDialogTestId)).toBeInTheDocument()
        );
    }).rejects.toEqual(expect.anything());
  });

  it('opens the request api key dialog and closes it by executing onClose', async () => {
    const { getByTestId } = await render(<FooterMessage />);
    const requestApiKeyLink = getByTestId('requestApiKey');

    fireEvent.click(requestApiKeyLink);

    await waitFor(() => expect(getByTestId(requestAPIKeyDialogTestId)).toBeInTheDocument());

    const dialog = getByTestId(requestAPIKeyDialogTestId)

    const button = getByText(dialog, 'Close');

    fireEvent.click(button);

    await expect(async () => {
        await waitFor(
            () => expect(getByTestId(requestAPIKeyDialogTestId)).toBeInTheDocument()
        );
    }).rejects.toEqual(expect.anything());

    expect(mockReplace).toHaveBeenCalledWith(mockBasePath);
  });

  it('does not open the request an issue dialog if this option is disabled', async () => {
    vi.mocked(SettingsSelectors.selectEnabledFeatures).mockReturnValue(['footer', 'request-api-key']);
    const { getByTestId, queryByTestId } = await render(<FooterMessage />);
    const reportAnIssueLink = getByTestId('reportAnIssue');

    fireEvent.click(reportAnIssueLink);

    await expect(async () => {
        await waitFor(
            () => expect(queryByTestId(reportIssueDialogTestId)).toBeInTheDocument()
        );
    }).rejects.toEqual(expect.anything());
  });

  it('opens the request an issue dialog and closes it by executing onClose', async () => {
    const { getByTestId } = await render(<FooterMessage />);
    const reportAnIssueLink = getByTestId('reportAnIssue');

    fireEvent.click(reportAnIssueLink);

    await waitFor(() => expect(getByTestId(reportIssueDialogTestId)).toBeInTheDocument());

    const dialog = getByTestId(reportIssueDialogTestId)

    const button = getByText(dialog, 'Close');

    fireEvent.click(button);

    await expect(async () => {
        await waitFor(
            () => expect(getByTestId(reportIssueDialogTestId)).toBeInTheDocument()
        );
    }).rejects.toEqual(expect.anything());

    expect(mockReplace).toHaveBeenCalledWith(mockBasePath);
  });
});
