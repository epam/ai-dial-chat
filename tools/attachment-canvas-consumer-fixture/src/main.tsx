/*
 * Imports only from the package's public root and its documented
 * `./styles.css` subpath — never a deep `src`/`dist` path — to exercise the
 * exact surface a real downstream consumer of the published
 * `@epam/ai-dial-attachment-canvas` package would use.
 */
/*
 * This project deliberately imports the packed npm artifact `pack-lib`
 * installs into its own `node_modules/@epam/ai-dial-attachment-canvas` —
 * never the workspace source `@nx/enforce-module-boundaries` otherwise
 * steers every in-repo consumer toward. That resolution difference is
 * exactly the property this fixture exists to prove (see README.md).
 */
// eslint-disable-next-line @nx/enforce-module-boundaries
import {
  AttachmentCanvasContainer,
  AttachmentCanvasProvider,
} from '@epam/ai-dial-attachment-canvas';
import '@epam/ai-dial-attachment-canvas/styles.css';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <AttachmentCanvasProvider>
      <AttachmentCanvasContainer />
    </AttachmentCanvasProvider>,
  );
}
