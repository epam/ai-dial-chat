import { render, screen, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { QrCode } from '../QrCode';

const VALUE = 'https://example.com/share/abc';
const LABELS = { ariaLabel: 'QR code for the share link' };

describe('QrCode', () => {
  it('hands the rendered svg element to svgRef once the QR renderer loads', async () => {
    const svgRef = createRef<SVGSVGElement>();

    render(<QrCode value={VALUE} labels={LABELS} svgRef={svgRef} />);

    await waitFor(() => expect(svgRef.current).toBeInstanceOf(SVGSVGElement));
    expect(
      screen
        .getByRole('img', { name: LABELS.ariaLabel })
        .contains(svgRef.current),
    ).toBe(true);
  });

  it('renders the labelled frame before the QR renderer has loaded', () => {
    const svgRef = createRef<SVGSVGElement>();

    render(<QrCode value={VALUE} labels={LABELS} svgRef={svgRef} />);

    expect(screen.getByRole('img', { name: LABELS.ariaLabel })).toBeTruthy();
    expect(svgRef.current).toBeNull();
  });

  it('renders only the QR image, with no actions, when used standalone', () => {
    render(<QrCode value={VALUE} labels={LABELS} />);

    expect(screen.getByRole('img', { name: LABELS.ariaLabel })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
