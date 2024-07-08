import { Step } from 'react-joyride';

import { TFunction } from 'next-i18next';

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
    target: `#${TourGuideId.modelSelection}`,
    title: 'Models',
    content:
      'Pernod Ricard GPT provides several models to generate text, images and even ask questions to documents. GPT-4 Vision integrates text and image comprehension for seamless content analysis and generation.',
    placement: 'right',
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
    target: `#${TourGuideId.startDiscussion}`,
    title: 'Start a discussion',
    content:
      'You can input your question in the below and validate with enter or click on the button. Answers will appear from top to down.',
    placement: 'top',
  },
  {
    target: `#${TourGuideId.chatHistory}`,
    title: 'History',
    content:
      'This is your chat history! You can find every conversation you had here. It will allow you to retrieve previous responses from the different models you used.',
    placement: 'right',
  },
  {
    target: `#${TourGuideId.exploreAllApplications}`,
    title: 'Explore all applications',
    content:
      'This is where you can find all of the custom applications hosted on PR GPT. Feel free to browse through them and try them!',
    placement: 'right',
  },
  {
    target: `#${TourGuideId.promptBank}`,
    title: 'Prompt bank',
    content:
      'This is your prompt bank. Soon, you will have a dedicated tour guide to help you understand how to use them or even create some, tailored to your needs. You can simply click on a prompt to launch it immediately.',
    placement: 'left',
  },
  {
    target: `#${TourGuideId.newPrompt}`,
    title: 'Create a new prompt',
    content:
      'This is where you can create your own new prompts ! Store them in dedicated folders to keep your prompt bank well organized!',
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

export const APPLICATION_ACTIONS_STEP = {
  target: `#${TourGuideId.applicationActions}`,
  title: 'Applications',
  content:
    'This is where you will find all of the custom applications hosted on PR GPT. Feel free to browse throughand try them!',
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
