import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  cloneElement,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CodeLanguage } from '../../../types/code-language';
import { ApiDetails } from '../ApiDetails';

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return {
    ...actual,
    /*
     * Mirrors the real block's a11y contract: a stable copy label plus a
     * polite live region that carries the transient copied message.
     */
    MarkdownCodeBlock: ({
      language,
      value,
      copyLabel,
      copiedLabel,
      title,
      titleSlot,
      hideDownload,
    }: {
      language: string;
      value: string;
      copyLabel?: string;
      copiedLabel?: string;
      title?: string;
      titleSlot?: ReactNode;
      hideDownload?: boolean;
    }) => {
      const [isCopied, setIsCopied] = useState(false);
      return (
        <div>
          {titleSlot ?? <span>{title ?? (language || 'plain')}</span>}
          <pre data-language={language}>{value}</pre>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(value);
              setIsCopied(true);
            }}
          >
            {copyLabel ?? 'Copy code'}
          </button>
          <span role="status" aria-live="polite">
            {isCopied ? (copiedLabel ?? 'Copied!') : ''}
          </span>
          {!hideDownload && <button>Download code</button>}
        </div>
      );
    },
  };
});
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...actual,
    Dropdown: ({
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

const MESSAGES_URL = 'https://dial.example.com/anthropic/v1/messages';
const MESSAGES_CODE =
  'curl -X POST ' +
  MESSAGES_URL +
  ' -d \'{"model":"selected-model","max_tokens":128,"messages":[{"role":"user","content":"Hello"}]}\'';
const MESSAGE_ENDPOINT = {
  label: 'Anthropic Messages',
  url: MESSAGES_URL,
  snippets: [{ language: CodeLanguage.Curl, code: MESSAGES_CODE }],
};
const MIXED_ENDPOINTS = [
  {
    label: 'Chat Completions',
    url: 'https://dial.example.com/openai/deployments/selected-model/chat/completions',
    snippets: [{ language: CodeLanguage.Curl, code: 'curl chat-completions' }],
  },
  {
    label: 'Responses',
    url: 'https://dial.example.com/openai/v1/responses',
    snippets: [{ language: CodeLanguage.Curl, code: 'curl responses' }],
  },
  MESSAGE_ENDPOINT,
];

describe('ApiDetails', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.documentElement.dir = '';
  });

  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it('renders a Messages-only endpoint with a plain title and copies both values accessibly', async () => {
    render(
      <ApiDetails
        api={{
          resource: { modelId: 'selected-model' },
          endpoints: [MESSAGE_ENDPOINT],
        }}
        copiedStatusLabel="Copied API"
      />,
    );
    expect(screen.getByText('Anthropic Messages')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Anthropic Messages' }),
    ).toBeNull();
    expect(screen.getByText(MESSAGES_URL)).toBeTruthy();
    expect(screen.getByText(MESSAGES_CODE)).toBeTruthy();
    expect(
      screen
        .getAllByRole('status')
        .every((status) => status.textContent === ''),
    ).toBe(true);
    await userEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MESSAGES_URL);
    await userEvent.click(screen.getAllByRole('button', { name: 'Copy' })[1]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MESSAGES_CODE);
    expect(
      screen
        .getAllByRole('status')
        .every((status) => status.textContent === 'Copied API'),
    ).toBe(true);
    expect(screen.queryByRole('button', { name: 'Download code' })).toBeNull();
  });

  it('switches mixed API URL and request example together before copying', async () => {
    render(<ApiDetails api={{ endpoints: MIXED_ENDPOINTS }} />);
    expect(screen.getByText('curl chat-completions')).toBeTruthy();
    await userEvent.click(
      screen.getByRole('button', { name: 'Chat Completions' }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Anthropic Messages' }),
    );
    expect(screen.queryByText('curl chat-completions')).toBeNull();
    expect(screen.getByText(MESSAGES_URL)).toBeTruthy();
    expect(screen.getByText(MESSAGES_CODE)).toBeTruthy();
    await userEvent.click(screen.getAllByRole('button', { name: 'Copy' })[1]);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MESSAGES_CODE);
  });

  /* ApiDetails has no JS width branch and jsdom does no CSS layout, so only the
   * document direction is varied here; layout parity is a manual check. */
  it.each(['ltr', 'rtl'])(
    'keeps Messages selection and copy available in %s',
    async (direction) => {
      document.documentElement.dir = direction;
      const view = render(
        <ApiDetails api={{ endpoints: [MESSAGE_ENDPOINT] }} />,
      );
      expect(screen.getByText(MESSAGES_URL)).toBeTruthy();
      expect(
        screen.queryByRole('button', { name: 'Anthropic Messages' }),
      ).toBeNull();
      view.rerender(<ApiDetails api={{ endpoints: MIXED_ENDPOINTS }} />);
      await userEvent.click(
        screen.getByRole('button', { name: 'Chat Completions' }),
      );
      await userEvent.click(
        screen.getByRole('menuitem', { name: 'Anthropic Messages' }),
      );
      expect(screen.getByText(MESSAGES_CODE)).toBeTruthy();
      await userEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0]);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(MESSAGES_URL);
      expect(screen.getAllByRole('status')[0].textContent).toBe('Copied!');
    },
  );

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

  it('announces the endpoint copy through a polite live region', async () => {
    render(
      <ApiDetails
        api={{ resource: { endpointUrl: LONG_MCP_URL } }}
        copiedStatusLabel="Copied"
      />,
    );

    const status = screen.getByRole('status');
    expect(status.textContent).toBe('');

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(status.textContent).toBe('Copied');
  });

  it('forwards the copied status label to the snippet code block', async () => {
    render(
      <ApiDetails
        api={{
          snippets: [{ language: CodeLanguage.Curl, code: 'curl example' }],
        }}
        copiedStatusLabel="Copiado"
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));

    expect(screen.getByRole('status').textContent).toBe('Copiado');
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
          endpoints: [
            { label: 'Azure OpenAI Endpoint', url: LONG_MCP_URL },
            { label: 'Anthropic Endpoint', url: 'https://anthropic.example' },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Azure OpenAI Endpoint' }),
    ).toBeTruthy();
    expect(screen.getByText(LONG_MCP_URL)).toBeTruthy();
  });

  it('renders a plain endpoint title instead of a dropdown trigger when there is only one endpoint', () => {
    render(
      <ApiDetails
        api={{
          endpoints: [{ label: 'Azure OpenAI Endpoint', url: LONG_MCP_URL }],
        }}
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Azure OpenAI Endpoint' }),
    ).toBeNull();
    expect(screen.getByText('Azure OpenAI Endpoint')).toBeTruthy();
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

    // The syntax highlighter sets a data-language attribute with no
    // accessible role; asserting it requires a direct attribute check.
    // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
    expect(container.querySelector('[data-language="bash"]')).toBeTruthy();
    expect(screen.getByText('curl example')).toBeTruthy();
  });

  it('renders a plain language title instead of a dropdown trigger when there is only one snippet', () => {
    render(
      <ApiDetails
        api={{
          snippets: [{ language: CodeLanguage.Curl, code: 'curl example' }],
        }}
      />,
    );

    expect(screen.queryByRole('button', { name: 'cURL' })).toBeNull();
    expect(screen.getByText('cURL')).toBeTruthy();
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
