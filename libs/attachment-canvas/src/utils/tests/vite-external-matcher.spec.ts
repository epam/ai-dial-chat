import { describe, expect, it } from 'vitest';
import { isExternalPackageImport } from '../vite-external-matcher';

describe('isExternalPackageImport', () => {
  it('externalizes a bare runtime package name', () => {
    expect(isExternalPackageImport('@silurus/ooxml')).toBe(true);
    expect(isExternalPackageImport('@epam/ai-dial-react-pdf-highlighter')).toBe(
      true,
    );
    expect(isExternalPackageImport('react-syntax-highlighter')).toBe(true);
    expect(isExternalPackageImport('@mcp-ui/client')).toBe(true);
    expect(isExternalPackageImport('@modelcontextprotocol/sdk')).toBe(true);
    expect(isExternalPackageImport('@epam/pdf-highlighter-kit')).toBe(true);
    expect(isExternalPackageImport('pdfjs-dist')).toBe(true);
  });

  it('externalizes a deep JS subpath of a runtime package', () => {
    expect(isExternalPackageImport('@silurus/ooxml/docx')).toBe(true);
    expect(isExternalPackageImport('@silurus/ooxml/xlsx')).toBe(true);
    expect(isExternalPackageImport('@silurus/ooxml/pptx')).toBe(true);
    expect(isExternalPackageImport('@silurus/ooxml/chart-ex')).toBe(true);
    expect(
      isExternalPackageImport('@epam/pdf-highlighter-kit/dist/index.js'),
    ).toBe(true);
    expect(
      isExternalPackageImport('react-syntax-highlighter/dist/esm/prism'),
    ).toBe(true);
    expect(isExternalPackageImport('pdfjs-dist/build/pdf.worker.min.mjs')).toBe(
      true,
    );
  });

  it('does not externalize the existing aliased vendor CSS subpaths', () => {
    expect(
      isExternalPackageImport('@epam/ai-dial-react-pdf-highlighter/styles.css'),
    ).toBe(false);
    expect(
      isExternalPackageImport(
        '@epam/pdf-highlighter-kit/dist/pdf-highlight-viewer.css',
      ),
    ).toBe(false);
  });

  it('does not externalize an unrelated package', () => {
    expect(isExternalPackageImport('lodash')).toBe(false);
  });
});
