import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsI18nKeys } from '../../../../constants/translation-keys';
import { DefaultAgentMode } from '../../../../types/default-agent';
import { StorageKey } from '../../../../types/storage-key';
import type DeploymentSelectorFieldTrigger from '../../../DeploymentSelector/DeploymentSelectorFieldTrigger';
import DefaultAgentSelect from '../DefaultAgentSelect';

type TriggerProps = ComponentProps<typeof DeploymentSelectorFieldTrigger>;

/*
 * The field shows the mode that is actually in effect while nothing is stored,
 * and the pin is what decides which mode that is — so the flag has to be
 * steerable per test.
 */
const appConfigMock = vi.hoisted(() => ({ defaultDeploymentPinned: true }));

vi.mock('../../../../context/AppConfigContext', () => ({
  useFeatureFlag: (key: string) =>
    key === 'defaultDeploymentPinned'
      ? appConfigMock.defaultDeploymentPinned
      : false,
}));

/*
 * The real trigger opens a floating panel over live deployment/favorites
 * context. Stubbing it to a flat list keeps these tests on this component's
 * own contract: the mode rows it contributes, the value it hands down, what a
 * selection persists, and that the field stays wired to the visible label.
 */
vi.mock('../../../DeploymentSelector/DeploymentSelectorFieldTrigger', () => ({
  default: ({
    selectedId,
    onSelect,
    labelledById,
    extraOptions,
  }: TriggerProps) => (
    <div>
      <span>selected:{selectedId}</span>
      <input readOnly aria-labelledby={labelledById} value={selectedId ?? ''} />
      <ul>
        {extraOptions?.map((option) => (
          <li key={option.id}>
            <button type="button" onClick={() => onSelect(option.id)}>
              {option.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  ),
}));

describe('DefaultAgentSelect', () => {
  beforeEach(() => {
    localStorage.clear();
    appConfigMock.defaultDeploymentPinned = true;
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('contributes the two modes as the picker’s pinned rows', () => {
    render(<DefaultAgentSelect />);

    const labels = screen.getAllByRole('button').map((b) => b.textContent);
    expect(labels).toEqual([
      SettingsI18nKeys.DefaultAgentOptionDefault,
      SettingsI18nKeys.DefaultAgentOptionLastUsed,
    ]);
  });

  it('is labeled with the Default agent for new chats string', () => {
    render(<DefaultAgentSelect />);

    expect(screen.getByText(SettingsI18nKeys.DefaultAgent)).toBeTruthy();
  });

  /*
   * The stub mirrors the real trigger's `aria-labelledby` wiring, so resolving
   * the field by its visible label proves the id actually reaches the label
   * element the component renders.
   */
  it('names the field with the rendered label', () => {
    render(<DefaultAgentSelect />);

    expect(screen.getByLabelText(SettingsI18nKeys.DefaultAgent)).toBeTruthy();
  });

  it('persists the default-agent sentinel when Default agent is chosen', async () => {
    render(<DefaultAgentSelect />);

    await userEvent.click(
      screen.getByRole('button', {
        name: SettingsI18nKeys.DefaultAgentOptionDefault,
      }),
    );

    expect(localStorage.getItem(StorageKey.DefaultAgent)).toBe(
      DefaultAgentMode.DefaultAgent,
    );
  });

  /*
   * With an agent pinned and nothing stored, the pin is what a new chat
   * follows, so the field names the default-agent mode rather than a
   * last-used mode that is not in effect (Issue #8889).
   */
  it('shows the default-agent mode when nothing is stored and an agent is pinned', () => {
    render(<DefaultAgentSelect />);

    expect(
      screen.getByText(`selected:${DefaultAgentMode.DefaultAgent}`),
    ).toBeTruthy();
  });

  it('shows the last-used-agent mode when nothing is stored and no agent is pinned', () => {
    appConfigMock.defaultDeploymentPinned = false;

    render(<DefaultAgentSelect />);

    expect(
      screen.getByText(`selected:${DefaultAgentMode.LastUsedAgent}`),
    ).toBeTruthy();
  });

  it('hands a stored last-used-agent choice down as the selected value', () => {
    localStorage.setItem(
      StorageKey.DefaultAgent,
      DefaultAgentMode.LastUsedAgent,
    );

    render(<DefaultAgentSelect />);

    expect(
      screen.getByText(`selected:${DefaultAgentMode.LastUsedAgent}`),
    ).toBeTruthy();
  });

  it('persists the last-used-agent sentinel when Last used agent is chosen', async () => {
    render(<DefaultAgentSelect />);

    await userEvent.click(
      screen.getByRole('button', {
        name: SettingsI18nKeys.DefaultAgentOptionLastUsed,
      }),
    );

    expect(localStorage.getItem(StorageKey.DefaultAgent)).toBe(
      DefaultAgentMode.LastUsedAgent,
    );
  });

  it('hands a stored deployment id down as the selected value', () => {
    localStorage.setItem(StorageKey.DefaultAgent, 'gpt-4o');

    render(<DefaultAgentSelect />);

    expect(screen.getByText('selected:gpt-4o')).toBeTruthy();
  });

  /*
   * A retired deployment id is still a valid stored value: the field resolves
   * it to the raw id rather than blanking, and nothing here rewrites it.
   */
  it('preserves the stored value when the stored agent has left the catalog', () => {
    localStorage.setItem(StorageKey.DefaultAgent, 'retired-model');

    render(<DefaultAgentSelect />);

    expect(screen.getByText('selected:retired-model')).toBeTruthy();
    expect(localStorage.getItem(StorageKey.DefaultAgent)).toBe('retired-model');
  });
});
