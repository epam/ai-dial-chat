import type { CelebrationAnchors } from '../models/celebration';

/** Anchors of the start-page fixture below. */
export const SNOWMAN_ANCHORS: CelebrationAnchors = {
  composer: 'composer',
  starterList: 'starters',
  welcomeRegion: '[role="region"]',
};

/** Viewport-pixel bounds of one fixture element. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Layout of the start-page fixture; `null` omits an element. */
export interface SnowmanFixture {
  width?: number;
  height?: number;
  rtl?: boolean;
  region?: Box;
  heading?: Box | null;
  composer?: Box | null;
  starters?: Box | null;
  cards?: Box[];
}

/* Plain property overrides, so this helper needs no test-runner import. */
const place = (element: HTMLElement, { left, top, width, height }: Box) =>
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => new DOMRect(left, top, width, height),
  });
const viewport = (name: 'clientWidth' | 'clientHeight', value: number) =>
  Object.defineProperty(document.documentElement, name, {
    configurable: true,
    get: () => value,
  });

/** Builds a measured start page: a region with a greeting, a composer and starter buttons. */
export const buildSnowmanFixture = ({
  width = 1280,
  height = 900,
  rtl = false,
  region,
  heading = { left: 440, top: 200, width: 400, height: 40 },
  composer = { left: 360, top: 400, width: 560, height: 100 },
  starters = { left: 400, top: 520, width: 480, height: 40 },
  cards = [
    { left: 400, top: 520, width: 140, height: 40 },
    { left: 560, top: 520, width: 140, height: 40 },
    { left: 720, top: 520, width: 140, height: 40 },
  ],
}: SnowmanFixture = {}) => {
  viewport('clientWidth', width);
  viewport('clientHeight', height);
  document.documentElement.dir = rtl ? 'rtl' : 'ltr';
  const main = document.createElement('div');
  main.setAttribute('role', 'region');
  document.body.append(main);
  place(main, region ?? { left: 0, top: 0, width, height });
  if (heading) {
    const h1 = document.createElement('h1');
    h1.textContent = 'How can I help?';
    main.append(h1);
    place(h1, heading);
  }
  if (composer) {
    const input = document.createElement('div');
    input.className = 'composer';
    /* jsdom does not inherit `direction`; the stage reads it from the composer. */
    input.style.direction = rtl ? 'rtl' : 'ltr';
    main.append(input);
    place(input, composer);
  }
  const buttons: HTMLButtonElement[] = [];
  if (starters) {
    const list = document.createElement('ul');
    list.className = 'starters';
    main.append(list);
    place(list, starters);
    cards.forEach((box, index) => {
      const button = document.createElement('button');
      button.textContent = `Starter ${index + 1}`;
      list.append(button);
      place(button, box);
      buttons.push(button);
    });
  }
  return { region: main, buttons };
};

/** Gives jsdom elements a WAAPI stub so eligibility sees an animatable card. */
export const stubAnimate = () =>
  Object.defineProperty(HTMLElement.prototype, 'animate', {
    configurable: true,
    value: () => undefined,
  });

/** Clears the fixture and its viewport overrides. */
export const resetSnowmanFixture = () => {
  document.body.replaceChildren();
  document.documentElement.removeAttribute('dir');
  delete (document.documentElement as { clientWidth?: number }).clientWidth;
  delete (document.documentElement as { clientHeight?: number }).clientHeight;
};
