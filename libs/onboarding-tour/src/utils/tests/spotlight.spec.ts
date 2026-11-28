import { describe, expect, it } from 'vitest';
import { spotlightRadius } from '../spotlight';

/* jsdom does not expand the border-radius shorthand, so set each corner. */
const elementWithRadius = (radius: string): HTMLElement => {
  const element = document.createElement('button');
  const values = radius.split(' ');
  const [
    topLeft,
    topRight = topLeft,
    bottomRight = topLeft,
    bottomLeft = topRight,
  ] = values;
  element.style.borderTopLeftRadius = topLeft;
  element.style.borderTopRightRadius = topRight;
  element.style.borderBottomRightRadius = bottomRight;
  element.style.borderBottomLeftRadius = bottomLeft;
  document.body.append(element);
  return element;
};

describe('spotlightRadius', () => {
  it.each([
    [
      'grows each length corner by the padding',
      { radius: '8px', expected: '14px 14px 14px 14px' },
    ],
    [
      'rounds the outline of a square element to the minimum radius',
      { radius: '0px', expected: '8px 8px 8px 8px' },
    ],
    [
      'never goes below the minimum radius for a barely rounded element',
      { radius: '1px', expected: '8px 8px 8px 8px' },
    ],
    [
      'keeps a percentage radius, so a round element gets a round outline',
      { radius: '50%', expected: '50% 50% 50% 50%' },
    ],
    [
      'follows corners that differ',
      { radius: '4px 0px 12px 0px', expected: '10px 8px 18px 8px' },
    ],
  ])('%s', (_name, { radius, expected }) => {
    expect(spotlightRadius(elementWithRadius(radius), 6)).toBe(expected);
  });
});
