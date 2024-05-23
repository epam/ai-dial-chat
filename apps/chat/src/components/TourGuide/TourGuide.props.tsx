import { Step } from 'react-joyride';

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
    title:
      'Ready to harness the full power of artificial intelligence within Pernod Ricard?',
    content:
      'Welcome to Pernod Ricard GPT tour guide. It will go through main features of this solution.',
    placement: 'center',
    disableBeacon: true,
  },
  {
    target: `#${TourGuideId.newConversation}`,
    title: 'New conversation',
    content:
      'You may start a new conversation by clicking on this button. Conversation history will appear below this area.',
    placement: 'right',
    disableBeacon: true,
  },
  {
    target: `#${TourGuideId.modelSelection}`,
    title: 'Model selection',
    content:
      'Pernod Ricard GPT provides several models to generate text, images and even ask questions to documents. You can chose gpt-35-turbo as a default, robust and fast text generation model.',
    placement: 'right',
  },
  {
    target: `#${TourGuideId.startDiscussion}`,
    title: 'Start a discussion',
    content:
      'You can input your question in the below and validate with enter or click on the button. Answers will appear from top to down.',
    placement: 'top',
  },
  {
    target: `#${TourGuideId.newPrompt}`,
    title: 'Create a new prompt',
    content:
      'This is your prompt bank, where you can create prompts that will be stored in separate folders for easy access. You can simply click on a prompt to launch it immediately.',
    placement: 'left',
  },
  {
    target: `body`,
    title:
      'Ready to harness the full power of artificial intelligence within Pernod Ricard?',
    content: '',
    placement: 'center',
    disableBeacon: true,
  },
];

export const SETTINGS_STEP = {
  target: `#${TourGuideId.settings}`,
  title: 'Conversation Settings',
  content:
    'Pernod Ricard GPT provides several models to generate text, images and even ask questions to documents. You can chose gpt-35-turbo as a default, robust and fast text generation model.',
  placement: 'top',
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

export const translateSteps = (steps: Step[], t: any) =>
  steps.map((step) => ({
    ...step,
    title: t(step.title),
    content: t(step.content),
  }));

export const styles = {
  spotlight: {
    borderRadius: '5px',
  },
};
