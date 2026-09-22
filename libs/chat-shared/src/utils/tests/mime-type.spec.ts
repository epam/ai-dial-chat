import { describe, expect, it } from 'vitest';
import { AttachmentType } from '../../types/attachment';
import { MIMEType } from '../../types/mime-type';
import {
  getAttachmentTypeFromMime,
  getBaseMimeType,
  inferMimeTypeFromPath,
  normalizeMimeType,
} from '../mime-type';

describe('inferMimeTypeFromPath', () => {
  it.each([
    ['agents/analyzer.md', MIMEType.Markdown],
    ['notes.markdown', MIMEType.Markdown],
    ['readme.txt', MIMEType.Plain],
    ['index.html', MIMEType.HTML],
    ['page.htm', MIMEType.HTML],
    ['app.xhtml', MIMEType.XHTML],
    ['styles.css', MIMEType.CSS],
    ['app.js', MIMEType.JavaScript],
    ['app.tsx', MIMEType.TypeScript],
    ['data.csv', MIMEType.CSV],
    ['data.json', MIMEType.JSON],
    ['data.jsonl', MIMEType.JSON],
    ['doc.xml', MIMEType.XML],
    ['report.pdf', MIMEType.PDF],
    ['archive.zip', MIMEType.ZIP],
    ['archive.gz', MIMEType.GZIP],
    ['script.py', MIMEType.Plain],
    ['photo.jpg', MIMEType.JPEG],
    ['photo.jpeg', MIMEType.JPEG],
    ['image.png', MIMEType.PNG],
    ['image.gif', MIMEType.GIF],
    ['image.webp', MIMEType.WebP],
    ['image.bmp', MIMEType.BMP],
    ['icon.svg', MIMEType.SVG],
    ['track.mp3', MIMEType.MP3],
    ['track.wav', MIMEType.WAV],
    ['track.ogg', MIMEType.OGG],
  ])('infers %s as %s', (path, expected) => {
    expect(inferMimeTypeFromPath(path)).toBe(expected);
  });

  it('is case-insensitive on the extension', () => {
    expect(inferMimeTypeFromPath('REPORT.PDF')).toBe(MIMEType.PDF);
  });

  it('ignores a query string or fragment when inferring the extension', () => {
    expect(inferMimeTypeFromPath('report.pdf?download=1#page=2')).toBe(
      MIMEType.PDF,
    );
  });

  it('returns undefined for an unrecognized extension', () => {
    expect(inferMimeTypeFromPath('archive.7z')).toBeUndefined();
  });

  it('returns undefined for a path with no extension', () => {
    expect(inferMimeTypeFromPath('Dockerfile')).toBeUndefined();
  });
});

describe('getAttachmentTypeFromMime', () => {
  it('classifies an image/* MIME type as Image', () => {
    expect(getAttachmentTypeFromMime('image/png')).toBe(AttachmentType.Image);
  });

  it('classifies an audio/* MIME type as Audio', () => {
    expect(getAttachmentTypeFromMime('audio/mpeg')).toBe(AttachmentType.Audio);
  });

  it('classifies everything else as File', () => {
    expect(getAttachmentTypeFromMime('text/markdown')).toBe(
      AttachmentType.File,
    );
    expect(getAttachmentTypeFromMime(undefined)).toBe(AttachmentType.File);
  });
});

describe('getBaseMimeType', () => {
  it('lowercases the type and strips parameters and surrounding whitespace', () => {
    expect(getBaseMimeType('  Application/JSON; charset=utf-8 ')).toBe(
      'application/json',
    );
  });

  it('leaves an alias unresolved', () => {
    expect(getBaseMimeType('text/json')).toBe('text/json');
  });
});

describe('normalizeMimeType', () => {
  it.each([
    ['text/json', 'application/json'],
    ['TEXT/JSON', 'application/json'],
    ['text/json; charset=utf-8', 'application/json'],
    ['text/xml', 'application/xml'],
    ['application/javascript', 'text/javascript'],
    ['application/x-zip-compressed', 'application/zip'],
    ['image/jpg', 'image/jpeg'],
    ['audio/mp3', 'audio/mpeg'],
  ])('resolves %s to %s', (input, expected) => {
    expect(normalizeMimeType(input)).toBe(expected);
  });

  it('returns a canonical type unchanged', () => {
    expect(normalizeMimeType('application/json')).toBe('application/json');
    expect(normalizeMimeType('application/pdf')).toBe('application/pdf');
  });

  it('leaves wildcards and unknown types alone', () => {
    expect(normalizeMimeType('text/*')).toBe('text/*');
    expect(normalizeMimeType('*/*')).toBe('*/*');
    expect(normalizeMimeType('application/x-made-up')).toBe(
      'application/x-made-up',
    );
  });
});
