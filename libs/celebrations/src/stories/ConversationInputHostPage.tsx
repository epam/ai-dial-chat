import type { DeploymentItem, StarterOption } from '@epam/ai-dial-chat-shared';
import {
  CONVERSATION_INPUT_CLASS,
  ConversationInput,
} from '@epam/ai-dial-conversation-input';
import {
  STARTER_BUTTONS_CLASS,
  StarterButtons,
} from '@epam/ai-dial-starter-buttons';
import type { FC, ReactNode } from 'react';
import type { CelebrationAnchors } from '../models/celebration';

/** Anchors the app passes for the real composer and starters (`CelebrationHost`). */
export const CONVERSATION_INPUT_ANCHORS: CelebrationAnchors = {
  composer: CONVERSATION_INPUT_CLASS.wrapper,
  composerAddCluster: CONVERSATION_INPUT_CLASS.addCluster,
  composerModelSelector: CONVERSATION_INPUT_CLASS.modelSelectorButton,
  starterList: STARTER_BUTTONS_CLASS.list,
  welcomeRegion: '[role="region"]',
};

const DEPLOYMENTS: DeploymentItem[] = [
  { id: 'gpt-4o', displayName: 'GPT-4o', type: 'model' },
  { id: 'claude', displayName: 'Claude', type: 'model' },
];

const starter = (index: number, title: string): StarterOption => ({
  const: index,
  title,
  'dial:widgetOptions': {
    populateText: title,
    submit: false,
    confirmationMessage: null,
  },
});

const STARTERS = [
  starter(0, 'Tell me a riddle'),
  starter(1, 'Write a poem'),
  starter(2, 'Plan my evening'),
];

const STARTER_LABELS = { list: 'Starters', overflow: 'More starters' };

const noop = () => undefined;

interface ConversationInputHostPageProps {
  /** Whether the starters use their phone layout. */
  isMobile?: boolean;
  /** Draft in the composer, which scenes must never change. */
  draft?: string;
  /** Controls rendered above the greeting, such as a Replay button. */
  children?: ReactNode;
}

/**
 * The chat start page as `NewConversationComposer` lays it out: the real
 * `ConversationInput` with its greeting and model selector, and the real
 * starter buttons below it. Scenes measure production geometry here.
 */
export const ConversationInputHostPage: FC<ConversationInputHostPageProps> = ({
  isMobile = false,
  draft,
  children,
}) => (
  <div className="bg-layer-1 flex h-dvh min-w-0 flex-col overflow-hidden text-primary">
    <main
      role="region"
      aria-label="Welcome screen"
      className="@container relative flex flex-auto shrink-0 flex-col items-center justify-center overflow-hidden px-4 py-14 desktop:px-8 desktop:py-16"
    >
      {children}
      <ConversationInput
        message={draft}
        welcomeText="Good evening!"
        placeholder="Type a message"
        deployments={DEPLOYMENTS}
        selectedDeploymentId={DEPLOYMENTS[0].id}
        onDeploymentChange={noop}
        onSend={noop}
      />
      <StarterButtons
        starters={STARTERS}
        onSelect={noop}
        isMobile={isMobile}
        labels={STARTER_LABELS}
      />
    </main>
  </div>
);
