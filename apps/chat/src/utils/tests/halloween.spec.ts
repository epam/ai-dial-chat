import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HALLOWEEN_CLICK_BURSTS,
  HALLOWEEN_GHOST_COUNT,
  HALLOWEEN_BURST_DURATION_MS,
  HALLOWEEN_WEB_COUNT,
  HALLOWEEN_MOBILE_WEB_COUNT,
  HALLOWEEN_SPIDER_COUNT,
} from '../../constants/halloween';
import { HalloweenGhostVariant } from '../../types/halloween';
import {
  buildHalloweenGhostFlight,
  buildHalloweenWebLayout,
  buildHalloweenBatFlight,
  buildHalloweenWitchFlight,
  buildHalloweenSpiderDrop,
  isHalloweenSecretPhrase,
  nextHalloweenSpiderOffset,
  pickHalloweenBurst,
} from '../halloween';

describe('isHalloweenSecretPhrase', () => {
  it('matches the phrase regardless of case, punctuation, and padding', () => {
    expect(isHalloweenSecretPhrase('trick or treat')).toBe(true);
    expect(isHalloweenSecretPhrase('  Trick Or Treat!  ')).toBe(true);
    expect(isHalloweenSecretPhrase('trick-or-treat')).toBe(true);
    expect(isHalloweenSecretPhrase('TRICK   OR   TREAT???')).toBe(true);
  });

  it('does not match a message that merely contains the phrase', () => {
    expect(
      isHalloweenSecretPhrase('what does trick or treat mean in Belarus?'),
    ).toBe(false);
    expect(isHalloweenSecretPhrase('trick or treats')).toBe(false);
  });

  it('does not match unrelated or empty input', () => {
    expect(isHalloweenSecretPhrase('')).toBe(false);
    expect(isHalloweenSecretPhrase('   ')).toBe(false);
    expect(isHalloweenSecretPhrase('treat or trick')).toBe(false);
  });
});

describe('buildHalloweenSpiderDrop', () => {
  const readVar = (drop: { style: object }, name: string) =>
    (drop.style as Record<string, string>)[name];

  it('lays out the configured number of spiders', () => {
    expect(buildHalloweenSpiderDrop()).toHaveLength(HALLOWEEN_SPIDER_COUNT);
  });

  it('gives every spider its own column, left to right', () => {
    const columns = buildHalloweenSpiderDrop().map((drop) =>
      Number.parseFloat(readVar(drop, '--spider-x')),
    );

    expect(new Set(columns).size).toBe(HALLOWEEN_SPIDER_COUNT);
    columns.slice(1).forEach((column, index) => {
      expect(column).toBeGreaterThan(columns[index]);
    });
    /* Inside the viewport: a thread anchored off-screen never shows. */
    columns.forEach((column) => {
      expect(column).toBeGreaterThanOrEqual(0);
      expect(column).toBeLessThan(100);
    });
  });

  it('varies thread length, size and pace between spiders', () => {
    const drop = buildHalloweenSpiderDrop();

    (
      ['--spider-depth', '--spider-scale', '--spider-duration'] as const
    ).forEach((name) => {
      const values = new Set(drop.map((spider) => readVar(spider, name)));
      expect(values.size).toBeGreaterThan(1);
    });
  });
});

describe('buildHalloweenGhostFlight', () => {
  it('lays out the configured number of ghosts', () => {
    expect(buildHalloweenGhostFlight()).toHaveLength(HALLOWEEN_GHOST_COUNT);
  });

  it('mixes the silhouettes so neighbours differ', () => {
    const flight = buildHalloweenGhostFlight();

    expect(new Set(flight.map((ghost) => ghost.variant)).size).toBe(
      Math.min(
        HALLOWEEN_GHOST_COUNT,
        Object.keys(HalloweenGhostVariant).length,
      ),
    );
    flight.slice(1).forEach((ghost, index) => {
      expect(ghost.variant).not.toBe(flight[index].variant);
    });
  });

  it('alternates the entry edge so ghosts cross in both directions', () => {
    const flight = buildHalloweenGhostFlight();
    const entersFromLeft = flight.map((ghost) =>
      String(
        (ghost.style as Record<string, string>)['--ghost-from-x'],
      ).startsWith('-'),
    );

    expect(entersFromLeft).toContain(true);
    expect(entersFromLeft).toContain(false);
  });

  it('starts and ends every flight off-screen', () => {
    const readVw = (value: string) => Number.parseFloat(value);

    buildHalloweenGhostFlight().forEach((ghost) => {
      const style = ghost.style as Record<string, string>;
      const from = readVw(style['--ghost-from-x']);
      const to = readVw(style['--ghost-to-x']);

      expect(from < 0 || from > 100).toBe(true);
      expect(to < 0 || to > 100).toBe(true);
      /* Entry and exit on opposite sides — otherwise the ghost turns around
         instead of crossing. */
      expect(Math.sign(from) === Math.sign(to) && from > 0 && to > 0).toBe(
        false,
      );
    });
  });

  it('gives every ghost its own path', () => {
    const flight = buildHalloweenGhostFlight();
    const paths = flight.map((ghost) => JSON.stringify(ghost.style));

    expect(new Set(paths).size).toBe(HALLOWEEN_GHOST_COUNT);
  });
});

describe('nextHalloweenSpiderOffset', () => {
  const base = {
    perch: { x: 200, y: 200 },
    offset: { x: 0, y: 0 },
    fleeRadius: 100,
    fleeStep: 50,
    maxOffset: 120,
  };

  it('stays put while the pointer keeps its distance', () => {
    expect(
      nextHalloweenSpiderOffset({ ...base, pointer: { x: 400, y: 200 } }),
    ).toBeNull();
  });

  it('bolts directly away from an approaching pointer', () => {
    /* Pointer to the spider's left, so it must move right and not at all
       vertically. */
    const next = nextHalloweenSpiderOffset({
      ...base,
      pointer: { x: 150, y: 200 },
    });

    expect(next).toEqual({ x: 50, y: 0 });
  });

  it('gives ground again when the pointer follows', () => {
    const first = nextHalloweenSpiderOffset({
      ...base,
      pointer: { x: 150, y: 200 },
    });
    const second = nextHalloweenSpiderOffset({
      ...base,
      offset: first as { x: number; y: number },
      /* The pointer has closed in on where the spider just moved to. */
      pointer: { x: 200, y: 200 },
    });

    expect(second?.x).toBeGreaterThan(first?.x as number);
  });

  it('measures the pointer against where the spider actually is, not its perch', () => {
    /* Within the radius of the perch, but the spider has already bolted well
       clear of it. */
    expect(
      nextHalloweenSpiderOffset({
        ...base,
        offset: { x: 110, y: 0 },
        pointer: { x: 190, y: 200 },
      }),
    ).toBeNull();
  });

  it('slides around the boundary when the push comes in at an angle', () => {
    const next = nextHalloweenSpiderOffset({
      ...base,
      offset: { x: base.maxOffset, y: 0 },
      /* Below and behind, so the push has a tangential component. */
      pointer: { x: 250, y: 240 },
    });

    expect(Math.hypot(next?.x as number, next?.y as number)).toBeCloseTo(
      base.maxOffset,
    );
    /* Traded some of its outward reach for movement along the boundary. */
    expect(next?.x).toBeLessThan(base.maxOffset);
    expect(next?.y).toBeLessThan(0);
  });

  it('never strays further than the leash allows', () => {
    let offset = { x: 0, y: 0 };
    /* A pointer parked on the spider, shoving it in one direction forever. */
    for (let nudge = 0; nudge < 20; nudge += 1) {
      offset =
        nextHalloweenSpiderOffset({
          ...base,
          offset,
          pointer: { x: 200 + offset.x - 10, y: 200 + offset.y },
        }) ?? offset;
    }

    expect(Math.hypot(offset.x, offset.y)).toBeLessThanOrEqual(
      base.maxOffset + 0.001,
    );
  });

  it('breaks the tie diagonally when the pointer is exactly on it', () => {
    const next = nextHalloweenSpiderOffset({
      ...base,
      pointer: { x: 200, y: 200 },
    });

    expect(next?.x).toBeCloseTo(base.fleeStep * Math.SQRT1_2);
    expect(next?.y).toBeCloseTo(base.fleeStep * Math.SQRT1_2);
  });
});

describe('Halloween scene layout', () => {
  it.each([false, true])(
    'covers almost the full viewport with one connected web (mobile=%s)',
    (isMobile) => {
      const { webs, strands } = buildHalloweenWebLayout(isMobile);
      expect(webs).toHaveLength(
        isMobile ? HALLOWEEN_MOBILE_WEB_COUNT : HALLOWEEN_WEB_COUNT,
      );
      for (const axis of ['x', 'y'] as const) {
        const positions = webs.map((web) => web[axis]);
        expect(Math.min(...positions)).toBeGreaterThan(0);
        expect(Math.min(...positions)).toBeLessThan(10);
        expect(Math.max(...positions)).toBeGreaterThan(90);
        expect(Math.max(...positions)).toBeLessThan(100);
      }
      webs.forEach((web) => {
        expect(
          (web.delay +
            parseFloat(
              (web.style as Record<string, string>)['--web-run-duration'],
            )) *
            1000,
        ).toBeLessThan(HALLOWEEN_BURST_DURATION_MS);
      });
      expect(Math.max(...webs.map((web) => web.delay))).toBeGreaterThan(3);
      /* A traversal must reach every spider's web, not disconnected islands. */
      const reached = new Set([0]);
      const queue = [0];
      while (queue.length) {
        const node = queue.pop();
        strands.forEach(({ from, to }) => {
          const neighbour = from === node ? to : to === node ? from : undefined;
          if (neighbour !== undefined && !reached.has(neighbour)) {
            reached.add(neighbour);
            queue.push(neighbour);
          }
        });
      }
      expect(reached.size).toBe(webs.length);
    },
  );

  it('changes positions, weaving order, threads and escape paths between celebrations', () => {
    const random = vi.spyOn(Math, 'random');
    try {
      random.mockReturnValue(0.2);
      const first = buildHalloweenWebLayout(false);
      random.mockReturnValue(0.8);
      const second = buildHalloweenWebLayout(false);
      expect(first.webs.map(({ x, y }) => [x, y])).not.toEqual(
        second.webs.map(({ x, y }) => [x, y]),
      );
      expect(first.webs.map(({ delay }) => delay)).not.toEqual(
        second.webs.map(({ delay }) => delay),
      );
      expect(first.strands.map(({ from, to }) => [from, to])).not.toEqual(
        second.strands.map(({ from, to }) => [from, to]),
      );
      expect(first.strands[0].path).not.toEqual(second.strands[0].path);
      expect(first.webs[0].style).not.toEqual(second.webs[0].style);
    } finally {
      random.mockRestore();
    }
  });

  it.each([buildHalloweenBatFlight, buildHalloweenWitchFlight])(
    'finishes flights before the overlay is removed',
    (build) => {
      const flights = build() as Record<string, string>[];
      flights.forEach((flight) => {
        expect(
          (parseFloat(flight['--flight-delay']) +
            parseFloat(flight['--flight-duration'])) *
            1000,
        ).toBeLessThan(HALLOWEEN_BURST_DURATION_MS);
        expect(flight['--flight-start-x']).not.toBe(flight['--flight-end-x']);
      });
    },
  );
});

describe('random pumpkin scenes', () => {
  afterEach(() => vi.restoreAllMocks());

  it('can pick every scene on the first click', () => {
    const random = vi.spyOn(Math, 'random');
    const scenes = HALLOWEEN_CLICK_BURSTS.map((_, index) => {
      random.mockReturnValue((index + 0.5) / HALLOWEEN_CLICK_BURSTS.length);
      return pickHalloweenBurst();
    });
    expect(new Set(scenes)).toEqual(new Set(HALLOWEEN_CLICK_BURSTS));
  });

  it.each(HALLOWEEN_CLICK_BURSTS)(
    'excludes the previous scene: %s',
    (previous) => {
      const random = vi.spyOn(Math, 'random');
      const scenes = Array.from({ length: 4 }, (_, index) => {
        random.mockReturnValue((index + 0.5) / 4);
        return pickHalloweenBurst(previous);
      });
      expect(scenes).not.toContain(previous);
      expect(new Set(scenes).size).toBe(4);
    },
  );
});
