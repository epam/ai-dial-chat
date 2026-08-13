import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DropdownSelector } from '@/src/components/Common/DropdownSelector';

vi.mock('@/src/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const options = [
  { label: 'Topic 1', value: 'topic-1' },
  { label: 'Topic 2', value: 'topic-2' },
];

describe('DropdownSelector', () => {
  it('renders the selected values as removable pills', () => {
    render(<DropdownSelector isMulti options={options} value={[options[0]]} />);

    const removeButton = screen.getByTestId(
      `unselect-item-${options[0].value}`,
    );

    expect(screen.getByText(options[0].label)).toBeInTheDocument();
    expect(removeButton.tagName).toBe('BUTTON');
    // The ui-kit icon button is what gives the pill its square hover state.
    expect(removeButton).toHaveClass('dial-icon-button');
  });

  it('removes a value when its pill button is clicked', async () => {
    const onChange = vi.fn();
    render(
      <DropdownSelector
        isMulti
        options={options}
        value={[options[0], options[1]]}
        onChange={onChange}
      />,
    );

    await userEvent.click(
      screen.getByTestId(`unselect-item-${options[0].value}`),
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual([options[1]]);
  });

  it('clears every value from the clear indicator', async () => {
    const onChange = vi.fn();
    render(
      <DropdownSelector
        isMulti
        isClearable
        options={options}
        value={[options[0], options[1]]}
        onChange={onChange}
      />,
    );

    await userEvent.click(screen.getByTestId('clear-dropdown-selection'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0]).toEqual([]);
  });

  it('centers the pill content, so the fixed size remove button is not pushed to the top', () => {
    render(<DropdownSelector isMulti options={options} value={[options[0]]} />);

    const pill = screen
      .getByTestId(`unselect-item-${options[0].value}`)
      // eslint-disable-next-line testing-library/no-node-access
      .closest('[class*="-multiValue"]');

    expect(pill).not.toBeNull();
    expect(getComputedStyle(pill!).alignItems).toBe('center');
  });

  it('sizes the remove, clear and dropdown icons consistently at 16px', () => {
    const { container } = render(
      <DropdownSelector
        isMulti
        isClearable
        options={options}
        value={[options[0]]}
      />,
    );

    // Icon dimensions live on the SVG itself, which no Testing Library query reaches.
    // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access
    const icons = container.querySelectorAll('svg');

    expect(icons.length).toBeGreaterThan(0);
    icons.forEach((icon) => {
      expect(icon.getAttribute('width')).toBe('16');
      expect(icon.getAttribute('height')).toBe('16');
    });
  });
});
