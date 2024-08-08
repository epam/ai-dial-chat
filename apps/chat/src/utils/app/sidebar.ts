import { CENTRAL_CHAT_MIN_WIDTH } from '@/src/constants/chat';
import { SIDEBAR_MIN_WIDTH } from '@/src/constants/default-ui-settings';

export const centralChatWidth = ({
  oppositeSidebarWidth = SIDEBAR_MIN_WIDTH,
  windowWidth,
  currentSidebarWidth = SIDEBAR_MIN_WIDTH,
}: {
  oppositeSidebarWidth?: number;
  windowWidth: number;
  currentSidebarWidth?: number;
}) => windowWidth - currentSidebarWidth - oppositeSidebarWidth;

export const getNewSidebarWidth = ({
  windowWidth,
  centralChatMinWidth = CENTRAL_CHAT_MIN_WIDTH,
  oppositeSidebarWidth = SIDEBAR_MIN_WIDTH,
}: {
  windowWidth: number;
  centralChatMinWidth?: number;
  oppositeSidebarWidth?: number;
}) => windowWidth - oppositeSidebarWidth - centralChatMinWidth;
