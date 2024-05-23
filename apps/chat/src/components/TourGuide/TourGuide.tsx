import React, { useEffect, useState } from 'react';
import Joyride, { CallBackProps, Step } from 'react-joyride';

import { useTranslation } from 'next-i18next';

import { Conversation } from '@/src/types/chat';
import { Translation } from '@/src/types/translation';

import { ConversationsSelectors } from '@/src/store/conversations/conversations.reducers';
import { useAppDispatch, useAppSelector } from '@/src/store/hooks';
import { UIActions, UISelectors } from '@/src/store/ui/ui.reducers';

import { TourGuideId } from '@/src/constants/share';

import {
  FinalTooltip,
  Tooltip,
  WelcomeTooltip,
} from '@/src/components/TourGuide/components';

import {
  DEFAULT_STEPS,
  SETTINGS_STEP,
  TourStepAction,
  TourStepType,
  handleBodyScroll,
  isTargetInDocument,
  styles,
  translateSteps,
} from './TourGuide.props';

const TourGuide = () => {
  const dispatch = useAppDispatch();
  const showPromptBar = useAppSelector(UISelectors.selectShowPromptbar);
  const showChatBar = useAppSelector(UISelectors.selectShowChatbar);
  const tourStepIndex = useAppSelector(UISelectors.selectTourStepIndex);
  const isTourRun = useAppSelector(UISelectors.selectIsTourRun);
  const conversations = useAppSelector(
    ConversationsSelectors.selectConversations,
  );
  const currentChatId = useAppSelector(
    ConversationsSelectors.selectSelectedConversationsIds,
  );

  const { t } = useTranslation(Translation.TourGuide);

  const [isClient, setIsClient] = useState(false);
  const [steps, setSteps] = useState(DEFAULT_STEPS);

  const conversation = conversations.find(
    (chat) => chat?.id === currentChatId?.[0],
  );
  const isEmptyConversation = !(
    (conversation as Conversation)?.messages?.length > 0
  );

  const isFirstStep = tourStepIndex === 0;
  const isLastStep = steps?.length - 1 === tourStepIndex;

  const tooltipComponent = isFirstStep
    ? WelcomeTooltip
    : isLastStep
      ? FinalTooltip
      : Tooltip;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (isTourRun && (!showPromptBar || !showChatBar)) {
      dispatch(UIActions.setShowPromptbar(true));
      dispatch(UIActions.setShowChatbar(true));
    }
  }, [showPromptBar, showChatBar, isTourRun]);

  useEffect(() => {
    if (!isEmptyConversation) {
      const updatedSteps = steps.map((step) =>
        step.target === `#${TourGuideId.modelSelection}` ? SETTINGS_STEP : step,
      );

      setSteps(updatedSteps);
    } else setSteps(DEFAULT_STEPS);
  }, [isEmptyConversation]);

  const handleJoyrideCallback = ({
    action,
    index,
    type,
    status,
    lifecycle,
    step,
  }: CallBackProps) => {
    handleBodyScroll(status, lifecycle); //To fix the built-in bug in react-joyride for target: body

    if (!isTargetInDocument(step.target as string)) {
      dispatch(UIActions.setTourStepIndex(index + 1));
    }

    switch (true) {
      case type === TourStepType.tourEnd ||
        action === TourStepAction.skip ||
        action === TourStepAction.close:
        dispatch(UIActions.setTourRun(false));
        dispatch(UIActions.setTourStepIndex(0));
        break;
      case type === TourStepType.stepAfter && action === TourStepAction.prev:
        dispatch(UIActions.setTourStepIndex(index - 1));
        break;
      case type === TourStepType.stepAfter:
        dispatch(UIActions.setTourStepIndex(index + 1));
        break;
    }
  };

  return (
    isClient && (
      <Joyride
        tooltipComponent={tooltipComponent}
        steps={translateSteps(steps as Step[], t)}
        stepIndex={tourStepIndex}
        run={isTourRun}
        continuous
        showSkipButton
        disableScrollParentFix
        spotlightPadding={7}
        callback={handleJoyrideCallback}
        disableOverlayClose
        styles={styles}
      />
    )
  );
};

export { TourGuide };
