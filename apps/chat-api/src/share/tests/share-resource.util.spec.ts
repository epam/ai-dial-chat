import { describe, expect, it } from 'vitest';
import {
  getInvitationRoutePath,
  resolveResourceKind,
} from '../utils/share-resource.util';

describe('resolveResourceKind', () => {
  it('resolves a project id to the PROJECT resource kind', () => {
    expect(resolveResourceKind('projects/a1b2c3/q4-launch')).toBe('PROJECT');
  });

  it('keeps resolving the existing kinds', () => {
    expect(resolveResourceKind('skills/a1b2c3/helper')).toBe('SKILL');
    expect(resolveResourceKind('prompts/a1b2c3/p')).toBe('PROMPT');
  });
});

describe('getInvitationRoutePath', () => {
  it('lands a project invitation on the project share route', () => {
    expect(getInvitationRoutePath('projects/a1b2c3/q4-launch')).toBe(
      '/projects/shared',
    );
  });

  it('keeps conversations and catalog kinds on their routes', () => {
    expect(getInvitationRoutePath('conversations/a1b2c3/c')).toBe(
      '/conversations/shared',
    );
    expect(getInvitationRoutePath('skills/a1b2c3/helper')).toBe(
      '/catalog/shared',
    );
  });
});
