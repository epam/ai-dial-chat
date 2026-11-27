import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { AppliedTopicTags } from '../AppliedTopicTags';

const Host = ({
  initial,
  onChange = vi.fn(),
}: {
  initial: string[];
  onChange?: (s: Set<string>) => void;
}) => {
  const [topics, setTopics] = useState(new Set(initial));
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={triggerRef}>
        Filter by topic
      </button>
      <AppliedTopicTags
        topics={topics}
        fallbackFocusRef={triggerRef}
        onChange={(next) => {
          setTopics(next);
          onChange(next);
        }}
      />
    </>
  );
};

describe('AppliedTopicTags', () => {
  it('renders nothing while no topic is applied', () => {
    render(<AppliedTopicTags topics={new Set()} onChange={vi.fn()} />);
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('renders two tags and no "Clear all" for two topics', () => {
    render(<Host initial={['Business', 'Compliance, Legal & Tax']} />);
    const group = screen.getByRole('group', { name: 'Applied topics' });
    expect(group).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Remove Business' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Remove Compliance, Legal & Tax' }),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clear all' })).toBeNull();
  });

  it('adds "Clear all" from three topics and clears every topic', async () => {
    const onChange = vi.fn();
    render(
      <Host
        initial={['Business', 'Coding', 'Deep Research']}
        onChange={onChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(onChange).toHaveBeenCalledWith(new Set());
    expect(screen.queryByRole('group')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Filter by topic' }).matches(':focus'),
    ).toBe(true);
  });

  it('removes a topic and moves focus to the next tag', async () => {
    const onChange = vi.fn();
    render(
      <Host initial={['Business', 'Coding', 'Vision']} onChange={onChange} />,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Business' }),
    );
    expect(onChange).toHaveBeenCalledWith(new Set(['Coding', 'Vision']));
    expect(
      screen.getByRole('button', { name: 'Remove Coding' }).matches(':focus'),
    ).toBe(true);
  });

  it('moves focus to the previous tag when the last one is removed', async () => {
    render(<Host initial={['Business', 'Coding']} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Coding' }),
    );
    expect(
      screen.getByRole('button', { name: 'Remove Business' }).matches(':focus'),
    ).toBe(true);
  });

  it('returns focus to the fallback when the only tag is removed', async () => {
    render(<Host initial={['Business']} />);
    await userEvent.click(
      screen.getByRole('button', { name: 'Remove Business' }),
    );
    expect(screen.queryByRole('group')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Filter by topic' }).matches(':focus'),
    ).toBe(true);
  });
});
