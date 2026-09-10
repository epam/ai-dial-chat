import { readFileSync } from 'node:fs';
import { join } from 'node:path';
export const createVerifyPublishedStyles = ({
  root,
  requiredMarkers,
  forbidEmbeddedFonts = true,
  cssFileName = 'index.css',
}) => ({
  name: 'verify-published-styles',
  apply: 'build',
  closeBundle: () => {
    const css = readFileSync(join(root, 'dist', cssFileName), 'utf8');
    for (const marker of requiredMarkers) {
      if (!css.includes(marker)) {
        throw new Error(`Published stylesheet is missing ${marker}`);
      }
    }
    if (forbidEmbeddedFonts && /data:font\/[^;]+;base64,/.test(css)) {
      throw new Error('Published stylesheet must not embed font data');
    }
  },
});
