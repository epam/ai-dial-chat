import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo, useState, type FC } from 'react';
import { useCelebration } from '../context/CelebrationContext';
import { halloweenEvent } from '../halloween/event';
import {
  HalloweenDecorBehavior,
  HalloweenScene,
} from '../halloween/types/halloween';
import { NewYearScene } from '../new-year/components/NewYear/types';
import { newYearEvent } from '../new-year/event';
import { ScenePlayer } from './ScenePlayer';

const EVENTS = { halloween: halloweenEvent, 'new-year': newYearEvent };

const SecretComposer: FC = () => {
  const { consumeSecretPhrase } = useCelebration();
  const [text, setText] = useState('trick or treat');
  const [result, setResult] = useState('');
  return (
    <form
      className="bg-layer-2 fixed bottom-3 end-3 z-[80] flex gap-2 rounded border p-2"
      onSubmit={(event) => {
        event.preventDefault();
        setResult(
          consumeSecretPhrase(text) ? 'Played a secret scene' : 'Sent normally',
        );
      }}
    >
      <input
        aria-label="Secret phrase"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="rounded border px-2"
      />
      <button type="submit" className="rounded border px-2">
        Send
      </button>
      <output aria-live="polite">{result}</output>
    </form>
  );
};

interface PlaygroundProps {
  /** Event the host selects. */
  eventId: keyof typeof EVENTS;
  /** Scenes the host switches off. */
  disabledScenes: string[];
  /** Corner-spider behaviors the host switches off. */
  disabledDecorBehaviors: string[];
  /** Whether the secret phrase is handled. */
  isSecretEnabled: boolean;
  /** Whether scenes use their mobile layout. */
  isMobile: boolean;
}

const Playground: FC<PlaygroundProps> = ({
  eventId,
  disabledScenes,
  disabledDecorBehaviors,
  isSecretEnabled,
  isMobile,
}) => {
  const selection = useMemo(
    () => ({ disabledScenes, disabledDecorBehaviors, isSecretEnabled }),
    [disabledScenes, disabledDecorBehaviors, isSecretEnabled],
  );
  return (
    <ScenePlayer
      key={eventId}
      event={EVENTS[eventId]}
      selection={selection}
      isMobile={isMobile}
    >
      <SecretComposer />
    </ScenePlayer>
  );
};

/* Everything a host can configure, on one page: click the trigger, type the phrase. */
const meta = {
  title: 'Playground',
  component: Playground,
  args: {
    eventId: 'halloween',
    disabledScenes: [],
    disabledDecorBehaviors: [],
    isSecretEnabled: true,
    isMobile: false,
  },
  argTypes: {
    eventId: { control: 'inline-radio', options: Object.keys(EVENTS) },
    disabledScenes: {
      control: 'multi-select',
      options: [
        ...Object.values(HalloweenScene),
        ...Object.values(NewYearScene),
      ],
    },
    disabledDecorBehaviors: {
      control: 'multi-select',
      options: Object.values(HalloweenDecorBehavior),
    },
  },
} satisfies Meta<typeof Playground>;

export default meta;

/** Toggle scenes, decor behaviors and the secret phrase from the controls. */
export const HostSelection: StoryObj<typeof meta> = {};
