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
  /** Decoration slot rendered inside the welcome region. */
  children?: ReactNode;
  /** Composer text, for the secret-phrase playground. */
  composerValue?: string;
  /** Called when the composer text changes. */
  onComposerChange?: (value: string) => void;
  /** Called when the fixture's send button is pressed. */
  onSend?: () => void;
}

/** A stand-in chat start page carrying every anchor scenes can borrow from. */
export const StoryHostPage: FC<StoryHostPageProps> = ({
  children,
  composerValue,
  onComposerChange,
  onSend,
}) => (
  <div className="bg-layer-1 flex h-screen min-h-[560px] text-primary">
    <nav
      aria-label="Conversation history"
      className="story-history w-60 shrink-0 overflow-hidden border-e border-primary p-3"
    >
      <h2 className="mb-2">Today</h2>
      <ul className="flex flex-col gap-1">
        {CONVERSATIONS.map((title, index) => (
          <li key={title} className="rounded px-2 py-1.5">
            <a href={`/conversations/${index}`} onClick={stayOnPage}>
              {title}
            </a>
          </li>
        ))}
      </ul>
      <button type="button" className="mt-3 rounded border px-2 py-1">
        New chat
      </button>
    </nav>
    <main
      role="region"
      aria-label="Start page"
      className="relative flex flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-8"
    >
      {children}
      <h1>Good evening!</h1>
      <ul className="story-starters flex gap-2">
        {STARTERS.map((starter) => (
          <li key={starter}>
            <button type="button" className="rounded border px-3 py-1.5">
              {starter}
            </button>
          </li>
        ))}
      </ul>
      <div className="story-composer flex w-full max-w-[560px] items-center gap-2 rounded-lg border p-3">
        <button type="button" className="story-add rounded border px-2">
          +
        </button>
        <textarea
          aria-label="Message"
          rows={1}
          className="flex-1 resize-none bg-transparent"
          value={composerValue}
          onChange={(event) => onComposerChange?.(event.target.value)}
        />
        <button type="button" className="story-model rounded border px-2">
          Model
        </button>
        <button type="button" className="rounded border px-2" onClick={onSend}>
          Send
        </button>
      </div>
    </main>
  </div>
);
