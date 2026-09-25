/** Options for {@link createQrPngBlob}. */
export interface QrPngOptions {
  /** Width and height of the produced PNG, in pixels. Defaults to `512`. */
  size?: number;
  /** Quiet-zone margin around the code, in pixels. Defaults to `32`. */
  margin?: number;
}

const DEFAULT_SIZE = 512;
const DEFAULT_MARGIN = 32;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/*
 * The exported image lands outside the app — in a slide, a chat message, a
 * printout — where no theme token resolves, and scanners need a dark code on a
 * light quiet zone. So the colours are literal and fixed, whatever the
 * on-screen QR's `currentColor` happens to be in the active theme.
 */
const MODULE_COLOR = '#000000';
const BACKGROUND_COLOR = '#ffffff';

/** Serialises `svg` as standalone markup with the code drawn in {@link MODULE_COLOR} at `drawSize` pixels. */
const serializeQrSvg = (svg: SVGSVGElement, drawSize: number): string => {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', SVG_NAMESPACE);
  clone.setAttribute('width', String(drawSize));
  clone.setAttribute('height', String(drawSize));
  clone.removeAttribute('class');
  clone.removeAttribute('style');
  clone.removeAttribute('aria-hidden');
  clone.querySelectorAll('path').forEach((path) => {
    if (path.getAttribute('fill') === 'currentColor') {
      path.setAttribute('fill', MODULE_COLOR);
    }
  });
  return new XMLSerializer().serializeToString(clone);
};

/** Loads `markup` into an `Image` through a `data:` URL, so there is no object URL to revoke. */
const loadSvgImage = (markup: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load the QR code SVG.'));
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
  });

/**
 * Rasterizes a rendered QR code `<svg>` into a PNG blob: dark modules on a
 * white square with a quiet-zone margin, independent of the active theme.
 * Rejects when the SVG cannot be loaded, no 2D context is available, or the
 * canvas produces no blob.
 */
export const createQrPngBlob = async (
  svg: SVGSVGElement,
  { size = DEFAULT_SIZE, margin = DEFAULT_MARGIN }: QrPngOptions = {},
): Promise<Blob> => {
  const drawSize = size - margin * 2;
  const image = await loadSvgImage(serializeQrSvg(svg, drawSize));

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (context == null) {
    throw new Error('Canvas 2D context is not available.');
  }
  context.fillStyle = BACKGROUND_COLOR;
  context.fillRect(0, 0, size, size);
  context.drawImage(image, margin, margin, drawSize, drawSize);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob == null) {
        reject(new Error('Failed to encode the QR code as PNG.'));
        return;
      }
      resolve(blob);
    }, 'image/png');
  });
};

/** Returns `true` when the browser can put an image on the clipboard. */
export const canWriteImageToClipboard = (): boolean =>
  typeof navigator !== 'undefined' &&
  typeof navigator.clipboard?.write === 'function' &&
  typeof ClipboardItem !== 'undefined';

/** Writes a PNG of the rendered QR `svg` to the clipboard; rejects when the browser refuses the write or the PNG cannot be produced. */
export const writeQrImageToClipboard = (svg: SVGSVGElement): Promise<void> => {
  const png = createQrPngBlob(svg);
  /*
   * A browser that refuses the write never reads `png`, so a later encoding
   * failure would surface as an unhandled rejection; the returned write
   * promise still reports it to the caller.
   */
  png.catch(() => undefined);
  /*
   * The write has to start synchronously inside the click handler — Safari
   * rejects it once anything was awaited first — so the PNG goes in as the
   * promise of a blob, which every supporting browser accepts.
   */
  return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
};
