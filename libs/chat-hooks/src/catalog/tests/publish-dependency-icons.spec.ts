import type {
  DeploymentItemDto,
  DialToolsetDto,
  ResourceDependencyDto,
} from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import { createPublishDependencyIconResolver } from '../publish-dependency-icons';

const dependency = (
  id: string,
  type: ResourceDependencyDto['type'],
): ResourceDependencyDto => ({ id, name: 'x', type, location: '' });

const deployments = [
  { id: 'applications/b/Agent%20One__1.0.0', iconUrl: 'agent.png' },
] as DeploymentItemDto[];
const toolsets = [
  { id: 'toolsets/b/Search__1.0.0', iconUrl: 'search.png' },
] as DialToolsetDto[];

const resolve = createPublishDependencyIconResolver({
  deployments,
  toolsets,
  resolveIconUrl: (iconUrl) =>
    iconUrl == null ? undefined : `/resolved/${iconUrl}`,
});

describe('createPublishDependencyIconResolver', () => {
  it('gives an application the resolved icon of the loaded deployment', () => {
    expect(
      resolve(dependency('applications/b/Agent%20One__1.0.0', 'application')),
    ).toBe('/resolved/agent.png');
  });

  it('matches an application whose id is encoded differently', () => {
    expect(
      resolve(dependency('applications/b/Agent One__1.0.0', 'application')),
    ).toBe('/resolved/agent.png');
  });

  it('gives a toolset the resolved icon of the loaded toolset', () => {
    expect(resolve(dependency('toolsets/b/Search__1.0.0', 'toolset'))).toBe(
      '/resolved/search.png',
    );
  });

  it('gives nothing for an entity the host has not loaded', () => {
    expect(
      resolve(dependency('applications/b/Unknown__1.0.0', 'application')),
    ).toBeUndefined();
  });

  it.each(['prompt', 'skill', 'file'] as const)(
    'gives a %s no icon',
    (type) => {
      expect(resolve(dependency(`${type}s/b/x`, type))).toBeUndefined();
    },
  );
});
