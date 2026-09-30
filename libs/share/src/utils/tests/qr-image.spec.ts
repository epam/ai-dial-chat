import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canWriteImageToClipboard,
  createQrPngBlob,
  writeQrImageToClipboard,
} from '../qr-image';

/*
 * jsdom neither decodes images nor implements canvas, so both are faked: the
 * image "loads" (or fails) on the next tick after `src` is set, and the 2D
 * context records the calls the helper makes.
 */
let shouldImageFail = false;
let lastImageSrc = '';

class FakeImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;

  set src(value: string) {
    lastImageSrc = value;
    setTimeout(() => (shouldImageFail ? this.onerror?.() : this.onload?.()));
  }
}

const context = {
  fillStyle: '',
  fillRect: vi.fn(),
  drawImage: vi.fn(),
};

const createQrSvg = (): SVGSVGElement => {
  const container = document.createElement('div');
  container.innerHTML =
    '<svg class="size-full" aria-hidden="true" viewBox="0 0 21 21">' +
    '<path d="M 0 0 l 1 0 0 1 -1 0 Z" fill="transparent"></path>' +
    '<path d="M 1 0 l 1 0 0 1 -1 0 Z" fill="currentColor"></path>' +
    '</svg>';
  return container.querySelector('svg') as SVGSVGElement;
};

const decodedMarkup = (): string =>
  decodeURIComponent(lastImageSrc.replace(/^data:image\/svg\+xml;[^,]*,/, ''));

describe('createQrPngBlob', () => {
  let toBlobResult: Blob | null;
  let fillStyleAtFill: string;

  beforeEach(() => {
    shouldImageFail = false;
    lastImageSrc = '';
    toBlobResult = new Blob(['png'], { type: 'image/png' });
    fillStyleAtFill = '';
    vi.clearAllMocks();
    context.fillRect.mockImplementation(() => {
      fillStyleAtFill = context.fillStyle;
    });
    vi.stubGlobal('Image', FakeImage);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback) => callback(toBlobResult),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('resolves with a PNG blob', async () => {
    const blob = await createQrPngBlob(createQrSvg());

    expect(blob.type).toBe('image/png');
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/png',
    );
  });

  it('paints the whole canvas white before drawing the code', async () => {
    await createQrPngBlob(createQrSvg(), { size: 200, margin: 20 });

    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 200, 200);
    expect(fillStyleAtFill).toBe('#ffffff');
    expect(context.fillRect.mock.invocationCallOrder[0]).toBeLessThan(
      context.drawImage.mock.invocationCallOrder[0],
    );
  });

  it('draws the code inset by the quiet-zone margin', async () => {
    await createQrPngBlob(createQrSvg(), { size: 200, margin: 20 });

    expect(context.drawImage).toHaveBeenCalledWith(
      expect.any(FakeImage),
      20,
      20,
      160,
      160,
    );
  });

  it('exports dark modules regardless of the on-screen theme colour', async () => {
    await createQrPngBlob(createQrSvg());

    const markup = decodedMarkup();
    expect(markup).toContain('fill="#000000"');
    expect(markup).not.toContain('currentColor');
    expect(markup).not.toContain('class=');
  });

  it('leaves the rendered on-screen SVG untouched', async () => {
    const svg = createQrSvg();

    await createQrPngBlob(svg);

    expect(svg.querySelectorAll('path')[1].getAttribute('fill')).toBe(
      'currentColor',
    );
  });

  it('rejects when the canvas produces no blob', async () => {
    toBlobResult = null;

    await expect(createQrPngBlob(createQrSvg())).rejects.toThrow();
  });

  it('rejects when the SVG image fails to load', async () => {
    shouldImageFail = true;

    await expect(createQrPngBlob(createQrSvg())).rejects.toThrow();
    expect(context.drawImage).not.toHaveBeenCalled();
  });
});

describe('canWriteImageToClipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when ClipboardItem and clipboard.write exist', () => {
    vi.stubGlobal('ClipboardItem', class {});
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn() } });

    expect(canWriteImageToClipboard()).toBe(true);
  });

  it('returns false when ClipboardItem is missing', () => {
    vi.stubGlobal('ClipboardItem', undefined);
    vi.stubGlobal('navigator', { clipboard: { write: vi.fn() } });

    expect(canWriteImageToClipboard()).toBe(false);
  });

  it('returns false when clipboard.write is missing', () => {
    vi.stubGlobal('ClipboardItem', class {});
    vi.stubGlobal('navigator', { clipboard: {} });

    expect(canWriteImageToClipboard()).toBe(false);
  });
});

describe('writeQrImageToClipboard', () => {
  /* Records what it was constructed with, so the PNG entry can be inspected. */
  class FakeClipboardItem {
    constructor(public readonly items: Record<string, Promise<Blob>>) {}
  }

  beforeEach(() => {
    shouldImageFail = false;
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('ClipboardItem', FakeClipboardItem);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation(
      (callback) => callback(new Blob(['png'], { type: 'image/png' })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('writes one clipboard item whose image/png entry resolves to the PNG', async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { write } });

    await writeQrImageToClipboard(createQrSvg());

    expect(write).toHaveBeenCalledOnce();
    const [[[item]]] = write.mock.calls as [[FakeClipboardItem[]]];
    expect(item).toBeInstanceOf(FakeClipboardItem);
    await expect(item.items['image/png']).resolves.toMatchObject({
      type: 'image/png',
    });
  });

  it('starts the clipboard write synchronously, before the PNG is ready', () => {
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { write } });

    void writeQrImageToClipboard(createQrSvg());

    expect(write).toHaveBeenCalledOnce();
  });

  it('rejects when the browser refuses the write', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { write: vi.fn().mockRejectedValue(new Error('denied')) },
    });

    await expect(writeQrImageToClipboard(createQrSvg())).rejects.toThrow(
      'denied',
    );
  });
});
