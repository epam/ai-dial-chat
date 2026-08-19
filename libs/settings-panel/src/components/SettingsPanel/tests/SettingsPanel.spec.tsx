import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SettingsPanelItem } from '../../../models/settings-panel-props';
import { SettingsPanel } from '../SettingsPanel';

const items: SettingsPanelItem[] = [
  { id: 'general', label: 'General', disabled: true },
  { id: 'preferences', label: 'Preferences', disabled: true },
  { id: 'usage', label: 'Usage' },
];

const renderPanel = (
  props?: Partial<React.ComponentProps<typeof SettingsPanel>>,
) =>
  render(
    <SettingsPanel
      items={items}
      activeId="usage"
      onSelect={vi.fn()}
      {...props}
    />,
  );

describe('SettingsPanel', () => {
  it('renders one tab per item', () => {
    renderPanel();

    expect(screen.getAllByRole('tab')).toHaveLength(3);
  });

  it('marks the active item as selected', () => {
    renderPanel();

    expect(
      screen.getByRole('tab', { name: 'Usage' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(
      screen
        .getByRole('tab', { name: 'General' })
        .getAttribute('aria-selected'),
    ).toBe('false');
  });

  it('calls onSelect when an enabled, inactive row is clicked', async () => {
    const items2: SettingsPanelItem[] = [
      { id: 'usage', label: 'Usage' },
      { id: 'other', label: 'Other' },
    ];
    const onSelect = vi.fn();
    render(
      <SettingsPanel items={items2} activeId="usage" onSelect={onSelect} />,
    );

    await userEvent.click(screen.getByRole('tab', { name: 'Other' }));

    expect(onSelect).toHaveBeenCalledWith('other');
  });

  it('does not call onSelect when a disabled row is clicked', async () => {
    const onSelect = vi.fn();
    renderPanel({ onSelect });

    await userEvent.click(screen.getByRole('tab', { name: 'General' }));

    expect(onSelect).not.toHaveBeenCalled();
  });

  it('only the active row is in the tab order', () => {
    renderPanel();

    expect(
      screen.getByRole('tab', { name: 'Usage' }).getAttribute('tabindex'),
    ).toBe('0');
    expect(
      screen.getByRole('tab', { name: 'General' }).getAttribute('tabindex'),
    ).toBe('-1');
    expect(
      screen.getByRole('tab', { name: 'Preferences' }).getAttribute('tabindex'),
    ).toBe('-1');
  });

  it('ArrowDown skips a disabled row', async () => {
    const items2: SettingsPanelItem[] = [
      { id: 'usage', label: 'Usage' },
      { id: 'general', label: 'General', disabled: true },
      { id: 'other', label: 'Other' },
    ];
    const onSelect = vi.fn();
    render(
      <SettingsPanel items={items2} activeId="usage" onSelect={onSelect} />,
    );

    screen.getByRole('tab', { name: 'Usage' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenCalledWith('other');
  });

  it('ArrowDown wraps from the last enabled row to the first', async () => {
    const items2: SettingsPanelItem[] = [
      { id: 'usage', label: 'Usage' },
      { id: 'general', label: 'General', disabled: true },
      { id: 'other', label: 'Other' },
    ];
    const onSelect = vi.fn();
    render(
      <SettingsPanel items={items2} activeId="other" onSelect={onSelect} />,
    );

    screen.getByRole('tab', { name: 'Other' }).focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onSelect).toHaveBeenCalledWith('usage');
  });

  it('ArrowUp skips a disabled row and wraps at the start', async () => {
    const items2: SettingsPanelItem[] = [
      { id: 'usage', label: 'Usage' },
      { id: 'general', label: 'General', disabled: true },
      { id: 'other', label: 'Other' },
    ];
    const onSelect = vi.fn();
    render(
      <SettingsPanel items={items2} activeId="usage" onSelect={onSelect} />,
    );

    screen.getByRole('tab', { name: 'Usage' }).focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(onSelect).toHaveBeenCalledWith('other');
  });

  it('Home jumps to the first enabled row', async () => {
    const items2: SettingsPanelItem[] = [
      { id: 'general', label: 'General', disabled: true },
      { id: 'usage', label: 'Usage' },
      { id: 'preferences', label: 'Preferences', disabled: true },
      { id: 'other', label: 'Other' },
    ];
    const onSelect = vi.fn();
    render(
      <SettingsPanel items={items2} activeId="other" onSelect={onSelect} />,
    );

    screen.getByRole('tab', { name: 'Other' }).focus();
    await userEvent.keyboard('{Home}');
    expect(onSelect).toHaveBeenCalledWith('usage');
  });

  it('End jumps to the last enabled row', async () => {
    const items2: SettingsPanelItem[] = [
      { id: 'general', label: 'General', disabled: true },
      { id: 'usage', label: 'Usage' },
      { id: 'preferences', label: 'Preferences', disabled: true },
      { id: 'other', label: 'Other' },
    ];
    const onSelect = vi.fn();
    render(
      <SettingsPanel items={items2} activeId="usage" onSelect={onSelect} />,
    );

    screen.getByRole('tab', { name: 'Usage' }).focus();
    await userEvent.keyboard('{End}');
    expect(onSelect).toHaveBeenCalledWith('other');
  });

  it('renders the section label when provided', () => {
    renderPanel({ sectionLabel: 'Settings' });

    expect(screen.getByText('Settings')).toBeTruthy();
  });

  it('renders no section label by default', () => {
    renderPanel();

    expect(screen.queryByText('Settings')).toBeNull();
  });
});
