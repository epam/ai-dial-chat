import { OnboardingHintPage } from '@epam/ai-dial-chat-api-client';
import { describe, expect, it } from 'vitest';
import { getOnboardingPage, isHintOnOnboardingPage } from '../onboarding-page';

describe('getOnboardingPage', () => {
  it.each([
    ['/', OnboardingHintPage.Home],
    ['/conversations/bucket/chat', OnboardingHintPage.Home],
    ['/projects', OnboardingHintPage.Projects],
    ['/projects/view/bucket/my-project', OnboardingHintPage.Projects],
    ['/scheduled-tasks/abc/edit', OnboardingHintPage.ScheduledTasks],
    ['/catalog', OnboardingHintPage.Catalog],
    ['/files', OnboardingHintPage.FileManager],
    ['/settings/preferences', OnboardingHintPage.Settings],
    ['/usage', OnboardingHintPage.Usage],
    ['/skill-editor', OnboardingHintPage.Editors],
  ])('maps %s to %s', (pathname, page) => {
    expect(getOnboardingPage(pathname)).toBe(page);
  });

  it('does not match a route that only shares a prefix', () => {
    expect(getOnboardingPage('/catalogue')).toBeNull();
  });

  it('maps a route no hint can name to null', () => {
    expect(getOnboardingPage('/login')).toBeNull();
    expect(getOnboardingPage('/auth/toolset-signin')).toBeNull();
  });
});

describe('isHintOnOnboardingPage', () => {
  it('puts a hint without pages on the home page only', () => {
    expect(isHintOnOnboardingPage([], OnboardingHintPage.Home)).toBe(true);
    expect(isHintOnOnboardingPage([], OnboardingHintPage.Catalog)).toBe(false);
  });

  it('puts a hint with pages on those pages only', () => {
    const pages = [OnboardingHintPage.Catalog, OnboardingHintPage.Projects];
    expect(isHintOnOnboardingPage(pages, OnboardingHintPage.Projects)).toBe(
      true,
    );
    expect(isHintOnOnboardingPage(pages, OnboardingHintPage.Home)).toBe(false);
  });

  it('shows no hint on a route without a page', () => {
    expect(isHintOnOnboardingPage([], null)).toBe(false);
  });
});
