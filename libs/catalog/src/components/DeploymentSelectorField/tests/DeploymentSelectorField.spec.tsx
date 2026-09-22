import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DeploymentSelectorField } from '../DeploymentSelectorField';

vi.mock('@epam/ai-dial-chat-shared', () => ({
  mergeClasses: (...classes: (string | undefined)[]) =>
    classes.filter(Boolean).join(' '),
}));
vi.mock('@epam/ai-dial-ui-kit', () => ({
  Dropdown: ({
    children,
    renderOverlay,
  }: {
    children: ReactNode;
    renderOverlay: () => ReactNode;
  }) => (
    <>
      {children}
      {renderOverlay()}
    </>
  ),
  GhostButton: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
  Highlight: ({ text }: { text: string }) => <>{text}</>,
  Input: ({
    value,
    placeholder,
    onKeyDown,
    ...props
  }: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      value={value}
      placeholder={placeholder}
      onKeyDown={onKeyDown}
      readOnly
      {...props}
    />
  ),
  MenuItem: ({
    label,
    onClick,
    ...props
  }: {
    label: ReactNode;
    onClick: () => void;
  }) => (
    <button onClick={onClick} {...props}>
      {label}
    </button>
  ),
  Search: ({
    value,
    onChange,
    ...props
  }: {
    value: string;
    onChange: (value?: string) => void;
  }) => (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
  ),
}));

describe('DeploymentSelectorField', () => {
  it('selects a resolved record and preserves an unavailable selected id', () => {
    const onSelect = vi.fn();
    render(
      <DeploymentSelectorField
        selectedId="removed"
        records={[{ id: 'model', label: 'Model' }]}
        placeholder="Choose"
        labels={{
          searchPlaceholder: 'Search',
          searchAriaLabel: 'Search models',
          emptyLabel: 'Empty',
          errorLabel: 'Error',
        }}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole<HTMLInputElement>('combobox').value).toBe(
      'removed',
    );
    fireEvent.click(screen.getByRole('option', { name: 'Model' }));
    expect(onSelect).toHaveBeenCalledWith('model');
  });

  it('keeps Browse available when records are empty', () => {
    const onBrowse = vi.fn();
    render(
      <DeploymentSelectorField
        selectedId={null}
        records={[]}
        placeholder="Choose"
        labels={{
          searchPlaceholder: 'Search',
          searchAriaLabel: 'Search models',
          emptyLabel: 'Nothing here',
          errorLabel: 'Error',
          browseLabel: 'Browse',
        }}
        onSelect={vi.fn()}
        onBrowse={onBrowse}
      />,
    );

    expect(screen.getByText('Nothing here')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Browse' }));
    expect(onBrowse).toHaveBeenCalledOnce();
  });

  it('opens from the keyboard and returns focus to its combobox after selection', () => {
    render(
      <DeploymentSelectorField
        selectedId={null}
        records={[{ id: 'model', label: 'Model' }]}
        placeholder="Choose"
        labels={{
          searchPlaceholder: 'Search',
          searchAriaLabel: 'Search models',
          emptyLabel: 'Empty',
          errorLabel: 'Error',
        }}
        onSelect={vi.fn()}
      />,
    );

    const combobox = screen.getByRole('combobox');
    combobox.focus();
    fireEvent.keyDown(combobox, { key: 'Enter' });
    expect(combobox.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(screen.getByRole('option', { name: 'Model' }));
    expect(document.activeElement).toBe(combobox);
  });
});
