import { describe, expect, it } from 'vitest';
import { isExternalPeerImport } from '../vite-external-matcher';

describe('isExternalPeerImport', () => {
  it('externalizes a bare peer package name', () => {
    expect(isExternalPeerImport('@epam/ai-dial-react-pdf-highlighter')).toBe(
      true,
    );
    expect(isExternalPeerImport('react-syntax-highlighter')).toBe(true);
    expect(isExternalPeerImport('@mcp-ui/client')).toBe(true);
    expect(isExternalPeerImport('@modelcontextprotocol/sdk')).toBe(true);
    expect(isExternalPeerImport('@epam/pdf-highlighter-kit')).toBe(true);
    expect(isExternalPeerImport('pdfjs-dist')).toBe(true);
  });

  it('externalizes a deep JS subpath of a peer package', () => {
    expect(
      isExternalPeerImport('@epam/pdf-highlighter-kit/dist/index.js'),
    ).toBe(true);
    expect(
      isExternalPeerImport('react-syntax-highlighter/dist/esm/prism'),
    ).toBe(true);
    expect(isExternalPeerImport('pdfjs-dist/build/pdf.worker.min.mjs')).toBe(
      true,
    );
  });

  it('does not externalize the existing aliased vendor CSS subpaths', () => {
    expect(
      isExternalPeerImport('@epam/ai-dial-react-pdf-highlighter/styles.css'),
    ).toBe(false);
    expect(
      isExternalPeerImport(
        '@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css',
      ),
    ).toBe(false);
  });

  it('does not externalize an unrelated package', () => {
    expect(isExternalPeerImport('@silurus/ooxml')).toBe(false);
    expect(isExternalPeerImport('lodash')).toBe(false);
  });
});
