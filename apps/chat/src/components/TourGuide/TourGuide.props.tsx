import { Step } from 'react-joyride';

import { TFunction } from 'next-i18next';

import { translate } from '@/src/utils/app/translation';

import { Translation } from '@/src/types/translation';

import { TourGuideId } from '@/src/constants/share';

export enum TourStepAction {
  skip = 'skip',
  close = 'close',
  prev = 'prev',
}

export enum TourStepType {
  tourEnd = 'tour:end',
  stepAfter = 'step:after',
}

export enum TooltipId {
  back = 'back',
  close = 'close',
  next = 'next',
}

export const DEFAULT_STEPS = [
  {
    target: `body`,
    title: translate('tour_guide.steps.start.title', {
      ns: Translation.TourGuide,
    }),
    content: translate('tour_guide.steps.start.content', {
      ns: Translation.TourGuide,
    }),
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: `#${TourGuideId.modelSelection}`,
    title: translate('tour_guide.steps.model_selection.title', {
      ns: Translation.TourGuide,
    }),
    content: translate(
      'Pernod Ricard GPT provides several models to generate text, images and even ask questions to documents. GPT-4 Vision integrates text and image comprehension for seamless content analysis and generation.',
      {
        ns: Translation.TourGuide,
      },
    ),
    placement: 'right',
  },
  {
    target: `#${TourGuideId.newConversation}`,
    title: translate('tour_guide.steps.new_conversation.title', {
      ns: Translation.TourGuide,
    }),
    content: translate('tour_guide.steps.new_conversation.content', {
      ns: Translation.TourGuide,
    }),
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: `#${TourGuideId.startDiscussion}`,
    title: translate('tour_guide.steps.start_discussion.title', {
      ns: Translation.TourGuide,
    }),
    content: translate('tour_guide.steps.start_discussion.content', {
      ns: Translation.TourGuide,
    }),
    placement: 'top',
  },
  {
    target: `#${TourGuideId.chatHistory}`,
    title: translate('tour_guide.steps.history.title', {
      ns: Translation.TourGuide,
    }),
    content: translate('tour_guide.steps.history.content', {
      ns: Translation.TourGuide,
    }),
    placement: 'right',
  },
  {
    target: `#${TourGuideId.exploreAllApplications}`,
    title: translate('tour_guide.steps.explore_all_applications.title', {
      ns: Translation.TourGuide,
    }),
    content: translate('tour_guide.steps.explore_all_applications.content', {
      ns: Translation.TourGuide,
    }),
    placement: 'right',
  },
  {
    target: `#${TourGuideId.promptBank}`,
    title: translate('tour_guide.steps.prompt_bank.title', {
      ns: Translation.TourGuide,
    }),
    content: translate('tour_guide.steps.prompt_bank.content', {
      ns: Translation.TourGuide,
    }),
    placement: 'left',
  },
  {
    target: `#${TourGuideId.newPrompt}`,
    title: translate('tour_guide.steps.create_new_prompt.title', {
      ns: Translation.TourGuide,
    }),
    content: translate('tour_guide.steps.create_new_prompt.content', {
      ns: Translation.TourGuide,
    }),
    placement: 'left',
  },
  {
    target: `body`,
    title: translate('tour_guide.steps.start.title', {
      ns: Translation.TourGuide,
    }),
    content: '',
    placement: 'center',
    disableBeacon: true,
  },
];

export const APPLICATION_ACTIONS_STEP = {
  target: `#${TourGuideId.applicationActions}`,
  title: translate('tour_guide.steps.applications.title', {
    ns: Translation.TourGuide,
  }),
  content: translate('tour_guide.steps.applications.content', {
    ns: Translation.TourGuide,
  }),
  placement: 'right',
};

const disableBodyScroll = () => (document.body.style.overflow = 'hidden');
const enableBodyScroll = () => (document.body.style.overflow = 'auto');

export const handleBodyScroll = (status: string, lifecycle: string) => {
  if (status === 'running' && lifecycle === 'init') {
    disableBodyScroll();
  } else if (status === 'finished' || status === 'skipped') {
    enableBodyScroll();
  }
};

export const isTargetInDocument = (selector: string): boolean => {
  return document.querySelector(selector) !== null;
};

export const translateSteps = (steps: Step[], t: TFunction) =>
  steps.map((step) => ({
    ...step,
    title: typeof step.title === 'string' ? t(step.title) : step.title,
    content: typeof step.content === 'string' ? t(step.content) : step.title,
  }));

export const styles = {
  spotlight: {
    borderRadius: '5px',
  },
};
