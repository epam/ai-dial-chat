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
  it('grows each length corner by the padding', () => {
    expect(spotlightRadius(elementWithRadius('8px'), 6)).toBe(
      '14px 14px 14px 14px',
    );
  });

  it('keeps square corners square', () => {
    expect(spotlightRadius(elementWithRadius('0px'), 6)).toBe(
      '0px 0px 0px 0px',
    );
  });

  it('keeps a percentage radius, so a round element gets a round outline', () => {
    expect(spotlightRadius(elementWithRadius('50%'), 6)).toBe(
      '50% 50% 50% 50%',
    );
  });

  it('follows corners that differ', () => {
    expect(spotlightRadius(elementWithRadius('4px 0px 12px 0px'), 6)).toBe(
      '10px 0px 18px 0px',
    );
  });
});
