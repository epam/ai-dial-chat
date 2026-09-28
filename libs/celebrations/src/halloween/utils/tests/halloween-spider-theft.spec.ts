import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testAnchors } from '../../../test-utils/environment';
import { buildHalloweenSpiderDrop } from '../halloween';
import {
  animateSpiderTheft,
  buildSpiderTheftPlans,
  getSpiderTheftTargets,
  SPIDER_THEFT_MS,
} from '../halloween-spider-theft';

const classes = {
  wrapper: 'composer-fixture',
  modelSelectorButton: 'model-fixture',
  addCluster: 'attach-fixture',
};
const anchors = testAnchors({
  composer: classes.wrapper,
  composerModelSelector: classes.modelSelectorButton,
  composerAddCluster: classes.addCluster,
});
describe('spider targets and cargo', () => {
  const originalAnimate = Object.getOwnPropertyDescriptor(
    Element.prototype,
    'animate',
  );
  let region: HTMLElement;
  let host: HTMLElement;
  let stop: (() => void) | undefined;
  const cancels: ReturnType<typeof vi.fn>[] = [];
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(
      1280,
    );
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(
      800,
    );
    region = document.createElement('section');
    region.setAttribute('role', 'region');
    region.innerHTML =
      '<h1>Hello</h1><div class="composer-fixture"><textarea></textarea><button class="model-fixture">Model</button><span class="attach-fixture"><button>Add</button></span></div>';
    region
      .querySelectorAll<HTMLElement>('h1, .model-fixture, .attach-fixture')
      .forEach((element, index) => {
        vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
          new DOMRect(
            400 + index * 130,
            200 + index * 90,
            index ? 80 : 300,
            40,
          ),
        );
      });
    host = document.createElement('div');
    document.body.append(region, host);
    Object.defineProperty(Element.prototype, 'animate', {
      configurable: true,
      value: vi.fn(() => {
        const cancel = vi.fn();
        cancels.push(cancel);
        return { cancel };
      }),
    });
  });
  afterEach(() => {
    stop?.();
    stop = undefined;
    region.remove();
    host.remove();
    cancels.length = 0;
    if (originalAnimate)
      Object.defineProperty(Element.prototype, 'animate', originalAnimate);
    else delete (Element.prototype as Partial<Element>).animate;
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it('borrows welcome elements without taking or blurring the focused textarea', () => {
    const textarea = region.querySelector('textarea');
    textarea?.focus();
    const targets = getSpiderTheftTargets(anchors);
    expect(targets).toHaveLength(3);
    expect(targets.some(({ element }) => element.contains(textarea))).toBe(
      false,
    );
    expect(document.activeElement).toBe(textarea);
  });
  it.each(['focus', 'expanded', 'hidden', 'clipped'])(
    'skips unsafe controls: %s',
    (reason) => {
      const model = region.querySelector<HTMLElement>('.model-fixture');
      if (!model) throw new Error('Missing model fixture');
      if (reason === 'focus') model.focus();
      if (reason === 'expanded') model.setAttribute('aria-expanded', 'true');
      if (reason === 'hidden') model.style.display = 'none';
      if (reason === 'clipped')
        vi.mocked(model.getBoundingClientRect).mockReturnValue(
          new DOMRect(-20, 300, 80, 40),
        );
      expect(
        getSpiderTheftTargets(anchors).map((target) => target.element),
      ).not.toContain(model);
    },
  );
  const play = () => {
    const plans = buildSpiderTheftPlans(
      getSpiderTheftTargets(anchors),
      buildHalloweenSpiderDrop(),
      1280,
      800,
    );
    const actors = plans.map(() => {
      const carrier = document.createElement('div');
      const cargo = document.createElement('div');
      carrier.appendChild(cargo);
      host.appendChild(carrier);
      const web = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      web.innerHTML =
        '<path data-silk-strand="0"/><path data-silk-strand="1"/>';
      return {
        carrier,
        cargo,
        web,
      };
    });
    stop = animateSpiderTheft(plans, actors, host);
    return { plans, actors };
  };
  it('attaches each prize to its carrier and lifts it fully above the viewport', () => {
    const { plans, actors } = play();
    expect(plans).toHaveLength(9);
    plans.forEach((plan, index) => {
      expect(actors[index].cargo.children).toHaveLength(plan.target ? 1 : 0);
      if (plan.target) {
        expect(plan.target.rect.bottom - plan.exitDistance).toBeLessThan(0);
        const copy = actors[index].cargo.firstElementChild as HTMLElement;
        expect(copy.inert).toBe(true);
        expect(copy.querySelector('textarea')).toBeNull();
        expect(plan.target.element.closest('[inert]')).toBeNull();
      }
    });
    const calls = vi.mocked(host.animate).mock.calls;
    const copyFrames = calls.filter(([frames]) =>
      (frames as Keyframe[]).some(
        (frame) =>
          frame.offset === 1 &&
          frame.opacity === 1 &&
          frame.transform === 'none',
      ),
    );
    expect(copyFrames).toHaveLength(3);
    copyFrames.forEach(([frames]) =>
      (frames as Keyframe[]).forEach((frame) =>
        expect(frame.transform).toBe('none'),
      ),
    );
  });
  it.each(['pointerdown', 'keydown', 'beforeinput', 'resize', 'deadline'])(
    'restores stolen elements on %s',
    (reason) => {
      play();
      if (reason === 'deadline') vi.advanceTimersByTime(SPIDER_THEFT_MS);
      else
        (reason === 'resize' ? window : document).dispatchEvent(
          new Event(reason),
        );
      expect(host.querySelector('[data-celebration-snapshot]')).toBeNull();
      stop?.();
      cancels.forEach((cancel) => expect(cancel).toHaveBeenCalledOnce());
    },
  );
});
