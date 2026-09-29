import { describe, expect, it } from 'vitest';
import {
  buildWitchPlan,
  WITCH_HANDOFF_END,
  WITCH_KEYFRAME_LIMIT,
  WITCH_RESTORE,
  WITCH_SCENE_MS,
  WitchPart,
} from '../halloween-witch-plan';
import type { WitchTargets } from '../halloween-witch-targets';

const target = (x: number, y: number, width = 80, height = 40) => ({
  element: document.createElement('button'),
  rect: new DOMRect(x, y, width, height),
});
const fixture = (width = 1280): WitchTargets => ({
  width,
  height: 800,
  composer: target(width / 2 - 150, 300, 300, 150),
  buttons: [target(width / 2 - 100, 380), target(width / 2 + 10, 380)],
});

describe('witch spell choreography', () => {
  it.each([360, 900, 1280, 1920])(
    'keeps the cast and keyframes bounded at %s pixels',
    (width) => {
      const input = fixture(width);
      const plan = buildWitchPlan(input, width < 1280);
      expect(plan.actors).toHaveLength(2);
      expect(plan.buttons).toHaveLength(width < 1280 ? 1 : 2);
      const tracks = [
        ...plan.actors.flatMap((actor) => [
          actor.frames,
          ...Object.values(actor.parts),
        ]),
        ...plan.buttons.flatMap((button) => [
          button.frames,
          button.frogFrames,
          button.legFrames,
        ]),
        ...plan.spells.map((spell) => spell.frames),
      ];
      for (const frames of tracks) {
        expect(frames.length).toBeLessThanOrEqual(WITCH_KEYFRAME_LIMIT);
        expect(JSON.stringify(frames)).not.toMatch(/NaN|Infinity|undefined/);
        const offsets = frames.map((frame, i) =>
          Number(frame.offset ?? i / (frames.length - 1)),
        );
        expect(offsets[0]).toBe(0);
        expect(offsets.at(-1)).toBe(1);
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
      }
      for (const actor of plan.actors) {
        expect(actor.rest.x - actor.size / 2).toBeGreaterThan(0);
        expect(actor.rest.x + actor.size / 2).toBeLessThan(width);
        expect(actor.frames.at(-1)?.opacity).toBe(0);
      }
      for (const { hops, target: button } of plan.buttons) {
        for (const hop of hops) {
          expect(hop.end.x - button.rect.width / 2).toBeGreaterThanOrEqual(0);
          expect(hop.end.x + button.rect.width / 2).toBeLessThanOrEqual(width);
        }
      }
    },
  );
  it('connects the spell, broom contact and correction to the button hops', () => {
    const plan = buildWitchPlan(fixture(), false);
    const [pupil, mentor] = plan.actors;
    const button = plan.buttons[0];
    const chase = button.hops[2];
    const contact = pupil.frames.find(
      (frame) => frame.offset === 10300 / WITCH_SCENE_MS,
    )!;
    const [x, y] = String(contact.transform)
      .match(/-?\d+(?:\.\d+)?/g)!
      .map(Number);
    const broomTipX = x + (pupil.size * 80) / 180;
    expect(
      chase.start.x - button.target.rect.width / 2 - broomTipX,
    ).toBeCloseTo(5);
    expect(y).toBe(chase.start.y + button.target.rect.height / 2);
    expect(chase.from).toBeGreaterThan(Number(contact.offset) * WITCH_SCENE_MS);
    for (const [index, borrowed] of plan.buttons.entries()) {
      const spellArrival = plan.spells[index].frames[3];
      expect(spellArrival.offset).toBe(borrowed.entry);
      const frogAppears = borrowed.frogFrames.find(
        (frame) => frame.opacity === 1,
      )!;
      expect(Number(frogAppears.offset)).toBeGreaterThan(borrowed.entry);
      expect(Number(frogAppears.offset) * WITCH_SCENE_MS).toBeLessThan(
        borrowed.hops[0].from,
      );
      const correction = mentor.parts[WitchPart.Arm].find(
        (frame) => frame.offset === 14600 / WITCH_SCENE_MS,
      )!;
      expect(Number(correction.offset) * WITCH_SCENE_MS).toBeLessThan(
        borrowed.hops.at(-1)!.from,
      );
    }
  });
  it('restores recognizable, unmirrored buttons before departure', () => {
    const plan = buildWitchPlan(fixture(), false);
    for (const button of plan.buttons) {
      const returned = button.frames.find(
        (frame) => frame.offset === WITCH_RESTORE,
      )!;
      expect(returned.transform).toBe('translate(0px, 0px) scale(1, 1)');
      expect(returned.opacity).toBe(1);
      expect(returned.easing).toBe('steps(1, end)');
      expect(
        button.frames.find((frame) => frame.offset === WITCH_HANDOFF_END)
          ?.opacity,
      ).toBe(0);
      expect(button.hops.at(-1)!.to).toBeLessThan(
        WITCH_RESTORE * WITCH_SCENE_MS,
      );
      expect(
        button.frames.some((frame) =>
          String(frame.transform).includes('scale(-'),
        ),
      ).toBe(false);
      expect(
        button.frogFrames.find((frame) => frame.offset === WITCH_RESTORE)
          ?.opacity,
      ).toBe(0);
    }
    expect(
      plan.actors.every((actor) =>
        actor.frames.some(
          (frame) =>
            Number(frame.offset) > WITCH_HANDOFF_END && frame.opacity === 1,
        ),
      ),
    ).toBe(true);
  });
  it('holds the broom-cast pose until the spell lands, then recoils with delayed secondary motion', () => {
    const plan = buildWitchPlan(fixture(), false);
    const pupil = plan.actors[0];
    const spell = plan.spells.at(-2)!;
    const [launch, arrival] = [spell.frames[1], spell.frames[3]];
    const before = pupil.frames.find(
      (frame) => frame.offset === 11900 / WITCH_SCENE_MS,
    )!;
    const after = pupil.frames.find(
      (frame) => frame.offset === 12780 / WITCH_SCENE_MS,
    )!;
    expect(before.transform).toBe(after.transform);
    expect(Number(before.offset)).toBeLessThan(Number(launch.offset));
    expect(Number(after.offset)).toBeGreaterThan(Number(arrival.offset));
    const broom = pupil.parts[WitchPart.Broom];
    expect(
      broom.find((frame) => frame.offset === 11900 / WITCH_SCENE_MS)?.transform,
    ).toBe('rotate(0deg)');
    expect(
      broom.find((frame) => frame.offset === 12720 / WITCH_SCENE_MS)?.transform,
    ).toBe('rotate(0deg)');
    expect(
      pupil.parts[WitchPart.Frog].find((frame) => frame.opacity === 1)!.offset,
    ).toBeGreaterThan(Number(arrival.offset));
    const hatRecoil = pupil.parts[WitchPart.Hat].find(
      (frame) => frame.transform === 'rotate(-17deg)',
    )!;
    const bodyRecoil = pupil.frames.find(
      (frame) => frame.offset === 13000 / WITCH_SCENE_MS,
    )!;
    expect(Number(hatRecoil.offset)).toBeGreaterThan(Number(bodyRecoil.offset));
  });
  it('uses uninterrupted ballistic hops with a bounded landing recovery', () => {
    const button = buildWitchPlan(fixture(), false).buttons[0];
    const hop = button.hops[1];
    const flight = button.frames.filter(
      (frame) =>
        Number(frame.offset) * WITCH_SCENE_MS > hop.from + 1 &&
        Number(frame.offset) * WITCH_SCENE_MS < hop.to - 1,
    );
    const positions = flight.map((frame) =>
      String(frame.transform)
        .match(/-?\d+(?:\.\d+)?/g)!
        .slice(0, 2)
        .map(Number),
    );
    const dx = positions[1][0] - positions[0][0];
    for (let i = 1; i < positions.length; i++) {
      expect(positions[i][0] - positions[i - 1][0]).toBeCloseTo(dx);
      expect(flight[i].easing).toBe('linear');
    }
    const top = Math.min(...positions.map((position) => position[1]));
    expect(positions[0][1]).toBeGreaterThan(top);
    expect(positions.at(-1)![1]).toBeGreaterThan(top);
    const landed = button.frames.find(
      (frame) =>
        Math.abs(Number(frame.offset) * WITCH_SCENE_MS - hop.to) < 0.01,
    )!;
    const settled = button.frames.find(
      (frame) =>
        Math.abs(Number(frame.offset) * WITCH_SCENE_MS - hop.to - 190) < 0.01,
    )!;
    expect(landed.transform).toContain('scale(1.07, 0.88)');
    expect(settled.transform).toContain('scale(1, 1)');
  });
  it('finishes the same lesson with one or no buttons and never mutates the inputs', () => {
    const input = fixture();
    input.buttons = input.buttons.slice(0, 1);
    const before = input.buttons.slice();
    expect(buildWitchPlan(input, false).buttons).toHaveLength(1);
    expect(input.buttons).toEqual(before);
    const fallback = buildWitchPlan(
      { width: 360, height: 720, buttons: [] },
      true,
    );
    expect(fallback.buttons).toEqual([]);
    expect(fallback.actors).toHaveLength(2);
    expect(fallback.spells.length).toBeGreaterThan(0);
    expect(buildWitchPlan(input, false)).toEqual(buildWitchPlan(input, false));
  });
  it('keeps physical target attachment independent of document direction', () => {
    const input = fixture();
    const ltr = buildWitchPlan(input, false);
    document.documentElement.dir = 'rtl';
    try {
      expect(buildWitchPlan(input, false)).toEqual(ltr);
    } finally {
      document.documentElement.removeAttribute('dir');
    }
  });
});
