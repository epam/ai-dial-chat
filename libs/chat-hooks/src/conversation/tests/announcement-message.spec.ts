import { AnnouncementSeverity as AnnouncementSeverityDto } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import {
  type AnnouncementContent,
  AnnouncementSeverity,
  buildAnnouncementSignature,
  mapAnnouncementSeverity,
} from '../announcement-message';

describe('mapAnnouncementSeverity', () => {
  it.each([
    [AnnouncementSeverityDto.Info, AnnouncementSeverity.Info],
    [AnnouncementSeverityDto.Warning, AnnouncementSeverity.Warning],
  ])('maps %s onto the matching lib severity', (severity, expected) => {
    expect(mapAnnouncementSeverity(severity)).toBe(expected);
  });

  it('returns info when the severity is missing', () => {
    expect(mapAnnouncementSeverity(undefined)).toBe(AnnouncementSeverity.Info);
    expect(mapAnnouncementSeverity(null)).toBe(AnnouncementSeverity.Info);
  });

  it('returns info for a severity this build does not know', () => {
    expect(
      mapAnnouncementSeverity('error' as unknown as AnnouncementSeverityDto),
    ).toBe(AnnouncementSeverity.Info);
  });
});

describe('buildAnnouncementSignature', () => {
  const buildContent = (
    severity?: AnnouncementSeverity,
  ): AnnouncementContent => ({
    title: 'Release',
    description: 'Notes',
    html: null,
    items: [
      {
        title: 'Upcoming maintenance',
        description: null,
        link: { label: 'Details', href: 'https://dialx.ai' },
        severity,
      },
    ],
  });

  it('returns the same signature for entries that differ only in severity', () => {
    const withoutSeverity = buildAnnouncementSignature(buildContent());
    expect(
      buildAnnouncementSignature(buildContent(AnnouncementSeverity.Info)),
    ).toBe(withoutSeverity);
    expect(
      buildAnnouncementSignature(buildContent(AnnouncementSeverity.Warning)),
    ).toBe(withoutSeverity);
  });

  it('keeps the signature format stored before severity existed', () => {
    expect(
      buildAnnouncementSignature(buildContent(AnnouncementSeverity.Warning)),
    ).toBe(
      '{"title":"Release","description":"Notes","items":[{"title":"Upcoming maintenance","description":"","link":{"label":"Details","href":"https://dialx.ai"}}]}',
    );
  });
});
