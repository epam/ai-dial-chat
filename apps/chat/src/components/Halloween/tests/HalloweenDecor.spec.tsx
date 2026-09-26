import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HALLOWEEN_SPIDER_DROP_DELAY_MS,
  HALLOWEEN_SPIDER_DROP_MS,
  HALLOWEEN_SPIDER_DRUM_MS,
  HALLOWEEN_SPIDER_RETRACT_MS,
  HALLOWEEN_SPIDER_RETURN_MS,
  HALLOWEEN_SPIDER_WRAP_IDLE_MS,
} from '../../../constants/halloween';
import { HALLOWEEN_PUMPKIN_SILK } from '../../../utils/halloween-spider-wrap';
import HalloweenDecor from '../HalloweenDecor';

const onActivate = vi.fn();

const clickPumpkin = () =>
  userEvent.click(
    screen.getByRole('button', { name: 'halloween.pumpkinLabel' }),
  );

/*
 * The decoration is inline SVG with no accessible name, so no Testing Library
 * query can reach it — and that unreachability is the point.
 */
const queryDrawings = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.body.querySelectorAll('svg');

/* The spider carries its displacement as an inline transform, so the
   element that has one is exactly the corner spider. */
const queryCornerSpiders = () =>
  // eslint-disable-next-line testing-library/no-node-access
  document.body.querySelectorAll<HTMLElement>('span[style*="translate3d"]');

/*
 * jsdom reports a zero rect for everything, so the spider would sit at the
 * origin. Pin it somewhere known and announce it the way a real layout change
 * would.
 */
const perch = (spider: HTMLElement, x: number, y: number) => {
  vi.spyOn(spider, 'getBoundingClientRect').mockReturnValue({
    x,
    y,
    left: x,
    top: y,
    right: x + 24,
    bottom: y + 24,
    width: 24,
    height: 24,
    toJSON: () => ({}),
  });
};

/* Built by hand rather than with `fireEvent.pointerMove`: jsdom has no
   `PointerEvent`, and the fallback it substitutes drops `clientX`/`clientY`,
   which is the whole payload here. */
/** The horizontal displacement out of the spider's inline transform. */
const readOffsetX = (spider: HTMLElement) =>
  Number.parseFloat(
    /translate3d\((-?[\d.]+)px/.exec(spider.style.transform)?.[1] ?? 'NaN',
  );

const movePointer = (x: number, y: number) =>
  fireEvent(
    window,
    new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }),
  );

describe('HalloweenDecor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  afterEach(() => vi.restoreAllMocks());

  it('renders the pumpkin as a labelled button when mounted', () => {
    render(<HalloweenDecor onActivate={onActivate} />);

    expect(
      screen.getByRole('button', { name: 'halloween.pumpkinLabel' }),
    ).not.toBeNull();
  });

  it('hangs a web in each top corner and a spider only in the end one', () => {
    render(<HalloweenDecor onActivate={onActivate} />);

    /* Two webs, one spider, and the pumpkin. */
    expect(queryDrawings()).toHaveLength(4);
    expect(queryCornerSpiders()).toHaveLength(1);
  });

  it('keeps the decoration out of the accessibility tree', () => {
    render(<HalloweenDecor onActivate={onActivate} />);

    queryDrawings().forEach((drawing) =>
      // eslint-disable-next-line testing-library/no-node-access
      expect(drawing.closest('[aria-hidden="true"]')).not.toBeNull(),
    );
  });

  it('bolts when the pointer closes in', async () => {
    render(<HalloweenDecor onActivate={onActivate} />);
    const [spider] = queryCornerSpiders();
    perch(spider, 900, 100);
    fireEvent(window, new Event('resize'));

    movePointer(910, 110);

    await waitFor(() =>
      expect(spider.style.transform).not.toBe(
        'translate3d(0px, 0px, 0) rotate(0.0deg)',
      ),
    );
  });

  it('never flips the spider, so it flees in screen coordinates', () => {
    render(<HalloweenDecor onActivate={onActivate} />);

    /* The webs are mirrored to face their corner. A mirror on the corner
       itself would take the spider with it and invert its inline transform —
       it would then run towards the pointer and jam against its leash, which
       is exactly the bug this pins down. */
    queryCornerSpiders().forEach((spider) =>
      // eslint-disable-next-line testing-library/no-node-access
      expect(spider.closest('[class*="scale-x-"]')).toBeNull(),
    );
  });

  it('bolts away from the pointer in screen coordinates despite its mirrored web', async () => {
    render(<HalloweenDecor onActivate={onActivate} />);
    const [spider] = queryCornerSpiders();
    perch(spider, 900, 100);
    fireEvent(window, new Event('resize'));

    /* A pointer to its left must push it right, even though its web is
       mirrored to face the corner. */
    movePointer(860, 100);
    await waitFor(() => expect(readOffsetX(spider)).toBeGreaterThan(0));
  });

  it('keeps giving ground while the pointer chases it', async () => {
    render(<HalloweenDecor onActivate={onActivate} />);
    const [spider] = queryCornerSpiders();
    perch(spider, 100, 100);
    fireEvent(window, new Event('resize'));

    movePointer(60, 100);
    let firstDash = '';
    await waitFor(() => {
      firstDash = spider.style.transform;
      expect(firstDash).toContain('translate3d(');
      expect(firstDash).not.toContain('translate3d(0px');
    });

    /* The pointer follows it to where it just went. */
    movePointer(120, 100);
    await waitFor(() => expect(spider.style.transform).not.toBe(firstDash));
  });

  it('creeps back to its perch once the pointer leaves it alone', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<HalloweenDecor onActivate={onActivate} />);
    const [spider] = queryCornerSpiders();
    perch(spider, 100, 100);
    fireEvent(window, new Event('resize'));

    movePointer(110, 110);
    await waitFor(() =>
      expect(spider.style.transform).not.toContain('translate3d(0px, 0px'),
    );

    act(() => vi.advanceTimersByTime(HALLOWEEN_SPIDER_RETURN_MS));
    await waitFor(() =>
      expect(spider.style.transform).toContain('translate3d(0px, 0px'),
    );
    vi.useRealTimers();
  });

  describe('idle corner spider', () => {
    const animateDescriptor = Object.getOwnPropertyDescriptor(
      Element.prototype,
      'animate',
    );
    const played: {
      frames: Keyframe[];
      duration: number;
      animation: {
        cancel: ReturnType<typeof vi.fn>;
        currentTime: number;
        onfinish?: (() => void) | null;
      };
    }[] = [];

    beforeEach(() => {
      played.length = 0;
      vi.useFakeTimers({ shouldAdvanceTime: true });
      Object.defineProperty(Element.prototype, 'animate', {
        configurable: true,
        writable: true,
        value: vi.fn(
          (frames: Keyframe[], options: KeyframeAnimationOptions) => {
            const animation = { cancel: vi.fn(), currentTime: 1300 };
            played.push({
              frames,
              duration: Number(options.duration),
              animation,
            });
            return animation;
          },
        ),
      });
    });

    afterEach(() => {
      if (animateDescriptor)
        Object.defineProperty(Element.prototype, 'animate', animateDescriptor);
      else Reflect.deleteProperty(Element.prototype, 'animate');
      vi.unstubAllGlobals();
      vi.useRealTimers();
    });

    const waitForDrop = () =>
      act(() => vi.advanceTimersByTime(HALLOWEEN_SPIDER_DROP_DELAY_MS[1]));

    it('lowers itself on a thread after an undisturbed pause', () => {
      render(<HalloweenDecor onActivate={onActivate} />);
      expect(played).toHaveLength(0);

      waitForDrop();

      /* The spider and its thread share one timeline. */
      expect(played).toHaveLength(2);
      played.forEach(({ duration }) =>
        expect(duration).toBe(HALLOWEEN_SPIDER_DROP_MS),
      );
      expect(
        played[0].frames.some(({ transform }) =>
          String(transform).includes('translateY(60.00px)'),
        ),
      ).toBe(true);
    });

    it('reels in and freezes when the pointer comes near mid-drop', async () => {
      render(<HalloweenDecor onActivate={onActivate} />);
      const [spider] = queryCornerSpiders();
      perch(spider, 900, 100);
      fireEvent(window, new Event('resize'));
      waitForDrop();
      const drop = played.slice(0, 2);

      /* Inside the alert radius but outside the flee radius. */
      movePointer(1100, 100);

      await waitFor(() => expect(spider.dataset.spiderState).toBe('alert'));
      drop.forEach(({ animation }) =>
        expect(animation.cancel).toHaveBeenCalledOnce(),
      );
      expect(played.slice(2)).toHaveLength(2);
      played
        .slice(2)
        .forEach(({ duration }) =>
          expect(duration).toBe(HALLOWEEN_SPIDER_RETRACT_MS),
        );
      expect(spider.style.transform).toBe(
        'translate3d(0px, 0px, 0) rotate(0.0deg)',
      );
    });

    it('leans towards a distant pointer without leaving its perch', async () => {
      render(<HalloweenDecor onActivate={onActivate} />);
      const [spider] = queryCornerSpiders();
      perch(spider, 900, 100);
      fireEvent(window, new Event('resize'));
      // eslint-disable-next-line testing-library/no-node-access
      const watch = spider.firstElementChild?.lastElementChild as HTMLElement;

      movePointer(1400, 400);

      await waitFor(() => expect(watch.style.transform).toMatch(/^rotate\(\d/));
      expect(spider.dataset.spiderState).toBe('idle');
    });

    /* Idle drops keep running meanwhile; finishing them lets the story in. */
    const stayQuiet = (ms: number) => {
      for (let waited = 0; waited < ms; waited += 5000) {
        act(() => vi.advanceTimersByTime(5000));
        played
          .filter(({ duration }) => duration === HALLOWEEN_SPIDER_DROP_MS)
          .forEach(({ animation }) => {
            const finish = animation.onfinish;
            animation.onfinish = null;
            if (finish) act(() => finish());
          });
      }
    };

    const storyAnimations = () =>
      played.filter(({ duration }) => duration > HALLOWEEN_SPIDER_DROP_MS);

    it('climbs down and wraps the pumpkin after a long quiet spell', () => {
      render(<HalloweenDecor onActivate={onActivate} />);
      const [spider] = queryCornerSpiders();

      stayQuiet(HALLOWEEN_SPIDER_WRAP_IDLE_MS + 5000);

      /* Spider, thread, every strand, the cocoon, the silk and the pumpkin
         all share the story's clock. */
      expect(storyAnimations()).toHaveLength(
        HALLOWEEN_PUMPKIN_SILK.strands.length + 5,
      );
      act(() => vi.advanceTimersByTime(3000));
      expect(spider.dataset.spiderState).toBe('wrapping');
    });

    it('reels in and lets the silk fall away when the user comes back', () => {
      render(<HalloweenDecor onActivate={onActivate} />);
      const [spider] = queryCornerSpiders();
      stayQuiet(HALLOWEEN_SPIDER_WRAP_IDLE_MS + 5000);
      const story = storyAnimations();
      played.length = 0;

      fireEvent.keyDown(window, { key: 'a' });

      expect(
        played.filter(
          ({ duration }) => duration === HALLOWEEN_SPIDER_RETRACT_MS,
        ),
      ).toHaveLength(2);
      /* The spider, thread and pumpkin stop at once; the silk fades first. */
      expect(story[0].animation.cancel).toHaveBeenCalled();
      expect(story.at(-1)?.animation.cancel).toHaveBeenCalled();
      expect(played.some(({ duration }) => duration === 250)).toBe(true);
      expect(spider.dataset.spiderState).toBe('idle');
    });

    it('drums its legs while the user types', () => {
      render(
        <>
          <textarea aria-label="Message" />
          <HalloweenDecor onActivate={onActivate} />
        </>,
      );
      const [spider] = queryCornerSpiders();
      const input = screen.getByRole('textbox', { name: 'Message' });

      fireEvent.keyDown(input, { key: 'h' });
      expect(spider.dataset.spiderTap).toBe('a');
      fireEvent.keyDown(input, { key: 'i' });
      expect(spider.dataset.spiderTap).toBe('b');

      act(() => vi.advanceTimersByTime(HALLOWEEN_SPIDER_DRUM_MS));
      expect(spider.dataset.spiderTap).toBeUndefined();
    });

    it('does not drum for keys pressed outside a text field', () => {
      render(<HalloweenDecor onActivate={onActivate} />);
      const [spider] = queryCornerSpiders();

      fireEvent.keyDown(window, { key: 'Escape' });

      expect(spider.dataset.spiderTap).toBeUndefined();
    });

    it('never drops or leans under reduced motion', () => {
      /* jsdom has no matchMedia at all, so it is stubbed rather than spied. */
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: true }) as MediaQueryList),
      );
      render(<HalloweenDecor onActivate={onActivate} />);

      waitForDrop();

      expect(played).toHaveLength(0);
    });
  });

  it('activates the event from Enter and Space', async () => {
    render(<HalloweenDecor onActivate={onActivate} />);
    const user = userEvent.setup();
    await user.tab();
    // eslint-disable-next-line testing-library/no-node-access
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'halloween.pumpkinLabel' }),
    );
    await user.keyboard('{Enter}');
    await user.keyboard(' ');
    expect(onActivate).toHaveBeenCalledTimes(2);
  });

  it('delegates a click to the shared runtime', async () => {
    render(<HalloweenDecor onActivate={onActivate} />);
    await clickPumpkin();
    expect(onActivate).toHaveBeenCalledOnce();
  });
});
