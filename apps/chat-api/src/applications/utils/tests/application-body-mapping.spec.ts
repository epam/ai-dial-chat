import { describe, expect, it } from 'vitest';
import { normalizeStoredApplication } from '../application-body-mapping';

describe('normalizeStoredApplication', () => {
  it('renames each snake alias of a camelCase SDK field and drops the snake key', () => {
    expect(
      normalizeStoredApplication({
        display_name: 'My App',
        display_version: '1.0.0',
        icon_url: 'files/bucket/icon.png',
        description_keywords: ['a'],
        input_attachment_types: ['image/png'],
        max_input_attachments: 3,
        created_at: 1,
      }),
    ).toEqual({
      displayName: 'My App',
      displayVersion: '1.0.0',
      iconUrl: 'files/bucket/icon.png',
      descriptionKeywords: ['a'],
      inputAttachmentTypes: ['image/png'],
      maxInputAttachments: 3,
      createdAt: 1,
    });
  });

  it('keeps the camelCase value when both spellings are present', () => {
    expect(
      normalizeStoredApplication({
        displayVersion: '2.0.0',
        display_version: '1.0.0',
      }),
    ).toEqual({ displayVersion: '2.0.0' });
  });

  it('leaves snake-only schema fields untouched', () => {
    const body = {
      application_properties: { features: { timestamp: true } },
      application_type_schema_id: 'https://schema',
      editor_url: 'https://editor',
    };

    expect(normalizeStoredApplication(body)).toEqual(body);
  });

  it('does not mutate the stored body', () => {
    const raw = { display_version: '1.0.0' };

    normalizeStoredApplication(raw);

    expect(raw).toEqual({ display_version: '1.0.0' });
  });
});
