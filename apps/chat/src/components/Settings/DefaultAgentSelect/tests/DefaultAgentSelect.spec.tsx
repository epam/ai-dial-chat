import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsI18nKeys } from '../../../../constants/translation-keys';
import { DefaultAgentMode } from '../../../../types/default-agent';
import { StorageKey } from '../../../../types/storage-key';
import DefaultAgentSelect from '../DefaultAgentSelect';

const deploymentsMock = vi.hoisted(() => ({
  items: [] as {
    id: string;
    displayName: string;
    iconUrl?: string;
    displayVersion?: string;
  }[],
}));

vi.mock('../../../../context/DeploymentsContext', () => ({
  useDeployments: () => deploymentsMock,
}));

vi.mock('@epam/ai-dial-chat-shared', async (importOriginal) => {
  const real =
    await importOriginal<typeof import('@epam/ai-dial-chat-shared')>();
  return { ...real, DeploymentIcon: () => <span aria-hidden>icon</span> };
});

/*
 * The real Select hides its options behind a floating overlay. Stubbing it to a
 * listbox of buttons — and surfacing the search box it would render — keeps
 * these tests on this component's own contract: the option list it builds, the
 * order, and what each selection persists.
 */
vi.mock('@epam/ai-dial-ui-kit', async (importOriginal) => {
  const real = await importOriginal<typeof import('@epam/ai-dial-ui-kit')>();
  return {
    ...real,
    Select: ({
      options,
      value,
      labelProps,
      searchPlaceholder,
      onChange,
      onSearchQueryChange,
    }: {
      options: {
        value: string;
        label: string;
        labelNode?: React.ReactNode;
        icon?: React.ReactNode;
        rightControl?: React.ReactNode;
      }[];
      value: string;
      labelProps?: { label: string };
      searchPlaceholder?: string;
      onChange: (v: string) => void;
      onSearchQueryChange?: (q: string) => void;
    }) => (
      <div>
        <span>{labelProps?.label}</span>
        <span>selected:{value}</span>
        <input
          aria-label={searchPlaceholder}
          onChange={(e) => onSearchQueryChange?.(e.target.value)}
        />
        <ul>
          {options.map((o) => (
            <li key={o.value}>
              <button type="button" onClick={() => onChange(o.value)}>
                {o.icon}
                {o.labelNode ?? o.label}
                {o.rightControl}
              </button>
            </li>
          ))}
        </ul>
      </div>
    ),
  };
});

describe('DefaultAgentSelect', () => {
  beforeEach(() => {
    localStorage.clear();
    deploymentsMock.items = [
      { id: 'gpt-4o', displayName: 'GPT-4o', displayVersion: '1.0.0' },
      { id: 'my-app', displayName: 'My App' },
    ];
  });

  afterEach(() => {
    localStorage.clear();
  });

  const optionLabels = () =>
    screen.getAllByRole('button').map((b) => b.textContent);

  it('lists the two modes first, then the catalog', () => {
    render(<DefaultAgentSelect />);

    const labels = optionLabels();
    expect(labels[0]).toContain(SettingsI18nKeys.DefaultAgentOptionDefault);
    expect(labels[1]).toContain(SettingsI18nKeys.DefaultAgentOptionLastUsed);
    expect(labels[2]).toContain('GPT-4o');
    expect(labels[3]).toContain('My App');
  });

  it('shows a version next to the deployment that has one', () => {
    render(<DefaultAgentSelect />);

    const labels = optionLabels();
    expect(labels[2]).toContain('1.0.0');
    expect(labels[3]).not.toContain('1.0.0');
  });

  it('is labeled with the Default agent for new chats string', () => {
    render(<DefaultAgentSelect />);

    expect(screen.getByText(SettingsI18nKeys.DefaultAgent)).toBeTruthy();
  });

  it('persists a deployment id when an agent is chosen', async () => {
    render(<DefaultAgentSelect />);

    await userEvent.click(screen.getByRole('button', { name: /GPT-4o/ }));

    expect(localStorage.getItem(StorageKey.DefaultAgent)).toBe('gpt-4o');
  });

  it('persists the default-agent sentinel when Default agent is chosen', async () => {
    render(<DefaultAgentSelect />);

    await userEvent.click(
      screen.getByRole('button', {
        name: new RegExp(SettingsI18nKeys.DefaultAgentOptionDefault),
      }),
    );

    expect(localStorage.getItem(StorageKey.DefaultAgent)).toBe(
      DefaultAgentMode.DefaultAgent,
    );
  });

  it('defaults to the last-used-agent mode when nothing is stored', () => {
    render(<DefaultAgentSelect />);

    expect(
      screen.getByText(`selected:${DefaultAgentMode.LastUsedAgent}`),
    ).toBeTruthy();
  });

  /*
   * Titled for what it actually proves: the stub echoes `value` unconditionally,
   * so this covers the component's side of the contract — it still renders, it
   * offers no matching option, and it leaves the stored value alone. Whether the
   * real Select paints nothing as selected is the kit's own behaviour.
   */
  it('renders and preserves the stored value when the stored agent has left the catalog', () => {
    localStorage.setItem(StorageKey.DefaultAgent, 'retired-model');

    render(<DefaultAgentSelect />);

    expect(screen.getByText('selected:retired-model')).toBeTruthy();
    expect(optionLabels().some((l) => l?.includes('retired-model'))).toBe(
      false,
    );
    expect(localStorage.getItem(StorageKey.DefaultAgent)).toBe('retired-model');
  });

  it('feeds the search query into the rendered option labels', async () => {
    render(<DefaultAgentSelect />);

    await userEvent.type(screen.getByRole('textbox'), 'GPT');

    /*
     * Highlight renders the matched run inside a <mark>, which carries the
     * implicit `mark` role — querying for it proves the query reached the
     * option label rather than the name rendering as plain text.
     */
    expect(screen.getAllByRole('mark').length).toBeGreaterThan(0);
  });
});
