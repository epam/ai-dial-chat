import { describe, expect, it } from 'vitest';
import { isMindMapSchema } from '../application-schema';

describe('isMindMapSchema', () => {
  it.each([
    'mind map',
    'Mind Map',
    'Mind map',
    'MIND MAP',
    'mind-map',
    'Mind-Map',
    'mind_map',
    'MindMap',
    'mindmap',
    'MINDMAP',
    '  Mind   Map  ',
    'Mind Map 2.0',
    'My mind map',
  ])('recognizes the display name %j', (displayName) => {
    expect(isMindMapSchema({ id: 'some-runner', displayName })).toBe(true);
  });

  it.each([
    'mind-map',
    'mind-map-schema',
    'MindMap',
    'mind_map',
    'https://runner.example/schemas/mindmap',
    'https://runner.example/schemas/Mind-Map/v1',
  ])('recognizes the schema id %j', (id) => {
    expect(isMindMapSchema({ id, displayName: 'Runner' })).toBe(true);
  });

  it.each([
    { id: 'ocr', displayName: 'OCR' },
    { id: 'foo-quickapps2', displayName: 'Quick app 2.0' },
    { id: 'map-runner', displayName: 'Map' },
    { id: 'mind-reader', displayName: 'Mind reader' },
    { id: 'custom_app', displayName: 'Custom app' },
  ])('does not match $displayName', (schema) => {
    expect(isMindMapSchema(schema)).toBe(false);
  });

  it('returns false for a missing schema', () => {
    expect(isMindMapSchema(undefined)).toBe(false);
    expect(isMindMapSchema({})).toBe(false);
  });
});
