import { describe, expect, it } from 'vitest';
import type {
  CelebrationSceneVariantDescriptor,
  CelebrationVariantInput,
} from '../../models/celebration-pack';
import {
  CelebrationColorScheme,
  CelebrationLayout,
  CelebrationStageAlign,
  CelebrationStageEdge,
} from '../../types/celebration-pack';
import {
  resolveStageAlignment,
  selectCelebrationVariant,
} from '../celebration-variant';

const variant = (
  animationAssetId: string,
  when: CelebrationSceneVariantDescriptor['when'],
): CelebrationSceneVariantDescriptor => ({ when, animationAssetId });

const LTR_DESKTOP_LIGHT: CelebrationVariantInput = {
  layout: CelebrationLayout.Desktop,
  direction: 'ltr',
  colorScheme: CelebrationColorScheme.Light,
};

describe('selectCelebrationVariant', () => {
  it('picks the variant that meets the most conditions', () => {
    const variants = [
      variant('mobile', { layout: CelebrationLayout.Mobile }),
      variant('mobile-rtl', {
        layout: CelebrationLayout.Mobile,
        direction: 'rtl',
      }),
    ];
    expect(
      selectCelebrationVariant(variants, {
        ...LTR_DESKTOP_LIGHT,
        layout: CelebrationLayout.Mobile,
        direction: 'rtl',
      })?.animationAssetId,
    ).toBe('mobile-rtl');
  });

  it('resolves a tie by declaration order', () => {
    const variants = [
      variant('first', { layout: CelebrationLayout.Desktop }),
      variant('second', { colorScheme: CelebrationColorScheme.Light }),
    ];
    expect(
      selectCelebrationVariant(variants, LTR_DESKTOP_LIGHT)?.animationAssetId,
    ).toBe('first');
  });

  it('lets a variant without conditions match anything', () => {
    expect(
      selectCelebrationVariant([variant('any', {})], LTR_DESKTOP_LIGHT)
        ?.animationAssetId,
    ).toBe('any');
  });

  it('returns undefined when every variant contradicts the input', () => {
    const variants = [
      variant('mobile', { layout: CelebrationLayout.Mobile }),
      variant('dark', { colorScheme: CelebrationColorScheme.Dark }),
    ];
    expect(
      selectCelebrationVariant(variants, LTR_DESKTOP_LIGHT),
    ).toBeUndefined();
    expect(selectCelebrationVariant([], LTR_DESKTOP_LIGHT)).toBeUndefined();
  });
});

describe('resolveStageAlignment', () => {
  it('maps start and end corners to logical edges', () => {
    expect(resolveStageAlignment(CelebrationStageAlign.BottomStart)).toEqual({
      block: CelebrationStageEdge.End,
      inline: CelebrationStageEdge.Start,
    });
    expect(resolveStageAlignment(CelebrationStageAlign.TopEnd)).toEqual({
      block: CelebrationStageEdge.Start,
      inline: CelebrationStageEdge.End,
    });
  });

  it('centers the inline axis for top and bottom', () => {
    expect(resolveStageAlignment(CelebrationStageAlign.Bottom)).toEqual({
      block: CelebrationStageEdge.End,
      inline: CelebrationStageEdge.Center,
    });
  });

  it('falls back to center for an unknown value', () => {
    expect(resolveStageAlignment('diagonal' as CelebrationStageAlign)).toEqual({
      block: CelebrationStageEdge.Center,
      inline: CelebrationStageEdge.Center,
    });
  });
});
