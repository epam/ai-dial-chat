/*
 * `pdfjs-dist`'s worker setup is owned by the app, not by
 * `@epam/ai-dial-attachment-canvas` — a lib must not mutate a third-party
 * runtime's global state (`GlobalWorkerOptions` is shared by every
 * `pdfjs-dist` consumer in the app), and the app is the right place to
 * decide which worker build/version every consumer should share. Both
 * imports are dynamic so `pdfjs-dist` stays out of the eager bundle — it is
 * only fetched the first time a PDF attachment is actually opened.
 */
let configurePdfWorkerPromise: Promise<void> | null = null;

/** Points `pdfjs-dist`'s worker at the app's own bundled worker script. Idempotent — safe to call on every PDF open. */
export const configurePdfWorker = (): Promise<void> => {
  if (!configurePdfWorkerPromise) {
    configurePdfWorkerPromise = (async () => {
      const [{ GlobalWorkerOptions }, { default: pdfWorkerUrl }] =
        await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);
      GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    })();
  }
  return configurePdfWorkerPromise;
};
