import { describe, expect, it, vi } from 'vitest';

import { render, screen } from '@testing-library/react';

import { SchemaButton } from '../SchemaButton';

const selectedAction = 'Test action';
const onButtonClick = vi.fn();
const buttonDefaultProps = {
  option: {
    title: 'Test button',
    const: 0,
  },
  showSelected: false,
  disabled: false,
  onClick: onButtonClick,
};

vi.mock('@/src/store/hooks', () => ({
  useAppSelector: vi.fn((selector) => selector()),
  useAppDispatch: () => vi.fn((action) => action),
}));

vi.mock('@/src/store/conversations/conversations.selectors', () => ({
  ConversationsSelectors: {
    selectIsPlaybackSelectedConversations: vi.fn(() => false),
    selectAction: vi.fn(() => selectedAction),
  },
}));

describe('SchemaButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders schema button properly', () => {
    render(<SchemaButton {...buttonDefaultProps} />);

    const button = screen.getByRole('button');

    expect(button).toBeInTheDocument();
    expect(button.textContent).toEqual(buttonDefaultProps.option.title);
    expect(button).not.toBeDisabled();
  });

  it('renders disabled schema button', () => {
    render(<SchemaButton {...buttonDefaultProps} disabled />);

    const button = screen.getByRole('button');

    expect(button).toBeInTheDocument();
    expect(button.textContent).toEqual(buttonDefaultProps.option.title);
    expect(button).toBeDisabled();
    expect(onButtonClick).toBeCalledTimes(0);
  });

  describe('selected action is the same as button title', () => {
    const option = {
      title: selectedAction,
      const: 0,
    };

    it('clicks automatically on schema button', () => {
      render(<SchemaButton {...buttonDefaultProps} option={option} />);

      const button = screen.getByRole('button');

      expect(button).toBeInTheDocument();
      expect(button.textContent).toEqual(selectedAction);
      expect(button).not.toBeDisabled();
      expect(onButtonClick).toBeCalledTimes(1);
    });

    it('does not click automatically on disabled schema button', () => {
      render(<SchemaButton {...buttonDefaultProps} option={option} disabled />);

      const button = screen.getByRole('button');

      expect(button).toBeInTheDocument();
      expect(button.textContent).toEqual(selectedAction);
      expect(button).toBeDisabled();
      expect(onButtonClick).toBeCalledTimes(0);
    });
  });
});
