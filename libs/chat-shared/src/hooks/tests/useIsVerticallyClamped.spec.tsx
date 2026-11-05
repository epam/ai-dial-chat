import { render, screen } from '@testing-library/react';
import { type FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useIsVerticallyClamped } from '../useIsVerticallyClamped';

/* jsdom has no layout, so each element reports the heights stamped on it. */
const stubHeights = () => {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return Number(this.dataset.scrollHeight ?? 0);
    },
  );
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return Number(this.dataset.clientHeight ?? 0);
    },
  );
};

interface Heights {
  scroll: number;
  client: number;
}

interface ProbeProps {
  wrapper: Heights;
  child: Heights;
}

const Probe: FC<ProbeProps> = ({ wrapper, child }) => {
  const { ref, isClamped } = useIsVerticallyClamped<HTMLSpanElement>('name');
  return (
    <>
      <span
        ref={ref}
        data-scroll-height={wrapper.scroll}
        data-client-height={wrapper.client}
      >
        <span
          data-scroll-height={child.scroll}
          data-client-height={child.client}
        >
          name
        </span>
      </span>
      <output>{isClamped ? 'clamped' : 'fits'}</output>
    </>
  );
};

describe('useIsVerticallyClamped', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports a clamp on the element itself', () => {
    stubHeights();
    render(
      <Probe
        wrapper={{ scroll: 72, client: 48 }}
        child={{ scroll: 72, client: 72 }}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe('clamped');
  });

  it('reports a clamp that lands on a direct child', () => {
    stubHeights();
    render(
      <Probe
        wrapper={{ scroll: 48, client: 48 }}
        child={{ scroll: 72, client: 48 }}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe('clamped');
  });

  it('reports no clamp when nothing is cut off', () => {
    stubHeights();
    render(
      <Probe
        wrapper={{ scroll: 48, client: 48 }}
        child={{ scroll: 48, client: 48 }}
      />,
    );

    expect(screen.getByRole('status').textContent).toBe('fits');
  });
});
