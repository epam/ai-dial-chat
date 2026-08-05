import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  cloneElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeLanguage } from '../../../types/code-language';
import { ApiDetails } from '../ApiDetails';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    MarkdownCodeBlock: ({
      language,
      value,
      copyLabel,
      titleSlot,
      hideDownload,
    }: {
      language: string;
      value: string;
      copyLabel?: string;
      titleSlot?: ReactNode;
      hideDownload?: boolean;
    }) => (
      <div>
        {titleSlot ?? <span>{language || 'plain'}</span>}
        <pre data-language={language}>{value}</pre>
        <button onClick={() => void navigator.clipboard.writeText(value)}>
          {copyLabel ?? 'Copy code'}
        </button>
        {!hideDownload && <button>Download code</button>}
      </div>
    ),
  };
});
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    DialDropdown: ({
      children,
      items,
    }: {
      children: ReactElement<{ onClick?: () => void }>;
      items: Array<{ key: string; label: ReactNode; onClick?: () => void }>;
    }) => {
      const [isOpen, setIsOpen] = useState(false);
      return (
        <div>
          {cloneElement(children, {
            onClick: () => setIsOpen((value) => !value),
          })}
          {isOpen &&
            items.map((item) => (
              <button key={item.key} onClick={item.onClick}>
                {item.label}
              </button>
            ))}
        </div>
      );
    },
  };
});

const LONG_MCP_URL =
  'https://dial.example.com/v1/toolset/toolsets/public/a-very-long-toolset-name-that-would-otherwise-overflow-the-panel/mcp';

describe('ApiDetails', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders the full single-endpoint URL via MarkdownCodeBlock, never truncated', () => {
    render(<ApiDetails api={{ resource: { endpointUrl: LONG_MCP_URL } }} />);

    expect(screen.getByText(LONG_MCP_URL)).toBeTruthy();
  });

  it('titles the single-endpoint code block with the endpoint label', () => {
    render(
      <ApiDetails
        api={{ resource: { endpointUrl: LONG_MCP_URL } }}
        endpointLabel="Connect URL"
      />,
    );

    expect(screen.getByText('Connect URL')).toBeTruthy();
  });

  it('copies the full untruncated single-endpoint URL when the copy button is clicked', async () => {
    render(<ApiDetails api={{ resource: { endpointUrl: LONG_MCP_URL } }} />);

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(LONG_MCP_URL);
  });

  it('renders the Model ID row separately from the endpoint code block', () => {
    render(
      <ApiDetails
        api={{
          resource: { modelId: 'gpt-4o', endpointUrl: LONG_MCP_URL },
        }}
      />,
    );

    expect(screen.getByText('gpt-4o')).toBeTruthy();
    expect(screen.getByText(LONG_MCP_URL)).toBeTruthy();
  });

  it('renders the endpoint-type dropdown trigger inside the code block header, in place of a plain title', () => {
    render(
      <ApiDetails
        api={{
          endpoints: [{ label: 'Azure OpenAI Endpoint', url: LONG_MCP_URL }],
        }}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Azure OpenAI Endpoint' }),
    ).toBeTruthy();
    expect(screen.getByText(LONG_MCP_URL)).toBeTruthy();
  });

  it('does not render a single-endpoint code block when endpoints are provided', () => {
    render(
      <ApiDetails
        api={{
          resource: { endpointUrl: LONG_MCP_URL },
          endpoints: [
            {
              label: 'Azure OpenAI Endpoint',
              url: 'https://dial.example.com/azure',
            },
          ],
        }}
      />,
    );

    expect(screen.queryByText(LONG_MCP_URL)).toBeNull();
    expect(screen.getByText('https://dial.example.com/azure')).toBeTruthy();
  });

  it('never renders the endpoint URL as a clickable anchor', () => {
    render(<ApiDetails api={{ resource: { endpointUrl: LONG_MCP_URL } }} />);

    expect(screen.queryByRole('link')).toBeNull();
  });

  it('never offers code download anywhere in the Connect tab, only copy', () => {
    render(
      <ApiDetails
        api={{
          resource: { modelId: 'gpt-4o' },
          endpoints: [{ label: 'Azure OpenAI Endpoint', url: LONG_MCP_URL }],
          requestExample: 'curl https://dial.example.com',
          responseSchema: '{"ok":true}',
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Download code' })).toBeNull();
    expect(
      screen.getAllByRole('button', { name: 'Copy' }).length,
    ).toBeGreaterThan(0);
  });

  it('switches the displayed endpoint URL when a different type is picked from the dropdown', async () => {
    render(
      <ApiDetails
        api={{
          endpoints: [
            {
              label: 'Azure OpenAI Endpoint',
              url: 'https://azure.example.com',
            },
            {
              label: 'Anthropic Endpoint',
              url: 'https://anthropic.example.com',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('https://azure.example.com')).toBeTruthy();

    await userEvent.click(
      screen.getByRole('button', { name: 'Azure OpenAI Endpoint' }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Anthropic Endpoint' }),
    );

    expect(screen.queryByText('https://azure.example.com')).toBeNull();
    expect(screen.getByText('https://anthropic.example.com')).toBeTruthy();
  });

  it('renders the request example via MarkdownCodeBlock as a bash snippet', async () => {
    render(
      <ApiDetails api={{ requestExample: 'curl https://dial.example.com' }} />,
    );

    expect(screen.getByText('bash')).toBeTruthy();
    expect(screen.getByText('curl https://dial.example.com')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'curl https://dial.example.com',
    );
  });

  it('renders the response schema via MarkdownCodeBlock as json', () => {
    render(<ApiDetails api={{ responseSchema: '{"ok":true}' }} />);

    expect(screen.getByText('json')).toBeTruthy();
    expect(screen.getByText('{"ok":true}')).toBeTruthy();
  });

  it('maps a legacy code snippet language to its syntax-highlighter id', () => {
    const { container } = render(
      <ApiDetails
        api={{
          snippets: [{ language: CodeLanguage.Curl, code: 'curl example' }],
        }}
      />,
    );

    expect(container.querySelector('[data-language="bash"]')).toBeTruthy();
    expect(screen.getByText('curl example')).toBeTruthy();
  });

  it('switches the displayed snippet when a different language is picked from the dropdown', async () => {
    render(
      <ApiDetails
        api={{
          snippets: [
            { language: CodeLanguage.Python, code: 'print(1)' },
            { language: CodeLanguage.Curl, code: 'curl example' },
          ],
        }}
      />,
    );

    expect(screen.getByText('print(1)')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Python' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'cURL' }));

    expect(screen.queryByText('print(1)')).toBeNull();
    expect(screen.getByText('curl example')).toBeTruthy();
  });
});
