import { vi } from 'vitest';

const translations: Record<string, string> = {
  'auth.signOut': 'Sign out',
  'chat.demoResponse': 'This is a demo response',
  'chat.placeholder': 'Type a message...',
  'chat.welcomeText': 'Welcome to Chat',
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (key === 'auth.providerButtonLabel') {
        return `Sign in with ${params?.provider}`;
      }
      if (key === 'auth.signedInAs') {
        return `Signed in as ${params?.email}`;
      }
      return translations[key] ?? key;
    },
  }),
}));
