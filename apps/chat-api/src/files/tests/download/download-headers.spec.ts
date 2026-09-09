import { describe, expect, it } from 'vitest';
import { headersForEmbeddedImage } from '../../download/download-headers';

describe('headersForEmbeddedImage', () => {
  it('leaves non-image downloads unchanged', () => {
    const headers = {
      'content-type': 'application/pdf',
      'content-disposition': 'attachment; filename="f.pdf"',
    };

    expect(headersForEmbeddedImage(headers, 'reports/q1.pdf')).toEqual(headers);
  });

  it('switches attachment to inline and fills image/png when Core sends octet-stream', () => {
    expect(
      headersForEmbeddedImage(
        {
          'content-type': 'application/octet-stream',
          'content-disposition':
            'attachment; filename="silver_lake_investments_net_income.png"',
        },
        'appdata/applications/public/pg/pg-agent__1.0.0/silver_lake_investments_net_income.png',
      ),
    ).toEqual({
      'content-type': 'image/png',
      'content-disposition':
        'inline; filename="silver_lake_investments_net_income.png"',
    });
  });

  it('keeps an image Content-Type from Core and only inlines disposition', () => {
    expect(
      headersForEmbeddedImage(
        {
          'content-type': 'image/jpeg',
          'content-disposition': 'attachment; filename="photo.jpg"',
        },
        'uploads/photo.jpg',
      ),
    ).toEqual({
      'content-type': 'image/jpeg',
      'content-disposition': 'inline; filename="photo.jpg"',
    });
  });

  it('adds inline disposition when Core omits it for an image path', () => {
    expect(
      headersForEmbeddedImage(
        { 'content-type': 'application/octet-stream' },
        'chart.webp',
      ),
    ).toEqual({
      'content-type': 'image/webp',
      'content-disposition': 'inline; filename="chart.webp"',
    });
  });

  it('inlines when Core already sent an image MIME without a known extension', () => {
    expect(
      headersForEmbeddedImage(
        {
          'content-type': 'image/png',
          'content-disposition': 'attachment; filename="blob"',
        },
        'blob',
      ),
    ).toEqual({
      'content-type': 'image/png',
      'content-disposition': 'inline; filename="blob"',
    });
  });
});
