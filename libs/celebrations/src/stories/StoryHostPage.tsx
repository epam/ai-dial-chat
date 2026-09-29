import type { FC, MouseEvent, ReactNode } from 'react';
import type { CelebrationAnchors } from '../models/celebration';

/** Anchors matching the fixture page below. */
export const STORY_ANCHORS: CelebrationAnchors = {
  composer: 'story-composer',
  composerAddCluster: 'story-add',
  composerModelSelector: 'story-model',
  starterList: 'story-starters',
  historyContainer: 'story-history',
  historyRowLink: 'a[href^="/conversations/"]',
  welcomeRegion: '[role="region"]',
};

const CONVERSATIONS = [
  'Plan a haunted house party',
  'Pumpkin soup recipe',
  'Costume ideas for a team',
  'Spooky story for kids',
  'Candy budget spreadsheet',
];

const STARTERS = ['Tell me a riddle', 'Write a poem', 'Plan my evening'];

/* Links must not navigate the Storybook iframe away from the story. */
const stayOnPage = (event: MouseEvent) => event.preventDefault();

interface StoryHostPageProps {
  /** Render starters below the composer, as NewConversationComposer does. */
  startersBelowComposer?: boolean;
  /** Exercise scenes when the host has only a composer. */
  showStarters?: boolean;
  /** Decoration slot rendered inside the welcome region. */
  children?: ReactNode;
  /** Composer text, for the secret-phrase playground. */
  composerValue?: string;
  /** Called when the composer text changes. */
  onComposerChange?: (value: string) => void;
  /** Called when the fixture's send button is pressed. */
  onSend?: () => void;
}

/**
 * A stand-in chat start page carrying every anchor scenes can borrow from.
 * Keep the decoration and history inside the iframe viewport so scenes can
 * interact with them even when Storybook's panels reduce the available space.
 */
export const StoryHostPage: FC<StoryHostPageProps> = ({
  children,
  startersBelowComposer = false,
  showStarters = true,
  composerValue,
  onComposerChange,
  onSend,
}) => {
  const starterList = (
    <ul className="story-starters flex max-w-full flex-wrap justify-center gap-2">
      {STARTERS.map((starter) => (
        <li key={starter}>
          <button type="button" className="min-h-11 rounded border px-3 py-1.5">
            {starter}
          </button>
        </li>
      ))}
    </ul>
  );
  return (
    <div className="bg-layer-1 flex h-dvh min-w-0 overflow-hidden text-primary">
      <nav
        aria-label="Conversation history"
        className="story-history hidden w-1/3 max-w-60 shrink-0 overflow-y-auto border-e border-primary p-3 desktop:block"
      >
        <h2 className="mb-2">Today</h2>
        <ul className="flex flex-col gap-1">
          {CONVERSATIONS.map((title, index) => (
            <li key={title} className="rounded px-2 py-1.5">
              <a
                href={`/conversations/${index}`}
                className="block truncate"
                onClick={stayOnPage}
              >
                {title}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="mt-3 min-h-11 rounded border px-2 py-1"
        >
          New chat
        </button>
      </nav>
      <main
        role="region"
        aria-label="Start page"
        className="relative flex min-w-0 flex-1 flex-col items-center justify-center gap-4 overflow-hidden p-4 desktop:gap-6 desktop:p-8"
      >
        {children}
        <h1>Good evening!</h1>
        {showStarters && !startersBelowComposer && starterList}
        <div className="story-composer flex w-full min-w-0 max-w-[560px] flex-wrap items-center gap-1 rounded-lg border p-2 desktop:flex-nowrap desktop:gap-2 desktop:p-3">
          <button
            type="button"
            className="story-add me-auto min-h-11 min-w-11 shrink-0 rounded border px-2 desktop:me-0"
          >
            +
          </button>
          <textarea
            aria-label="Message"
            rows={1}
            className="order-first min-w-0 basis-full resize-none bg-transparent desktop:order-none desktop:flex-1 desktop:basis-auto"
            value={composerValue}
            onChange={(event) => onComposerChange?.(event.target.value)}
          />
          <button
            type="button"
            className="story-model min-h-11 shrink-0 rounded border px-2"
          >
            Model
          </button>
          <button
            type="button"
            className="min-h-11 shrink-0 rounded border px-2"
            onClick={onSend}
          >
            Send
          </button>
        </div>
        {showStarters && startersBelowComposer && starterList}
      </main>
    </div>
  );
};
