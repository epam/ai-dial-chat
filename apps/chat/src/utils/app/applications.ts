import { ModelId } from '@/src/constants/chat';

import DefaultAppIcon from '../../../public/images/icons/message-square-lines-alt.svg';

import {
  HRBuddyIcon,
  HRBuddySquareIcon,
  RagIcon,
  RagSquareIcon,
  WebRagIcon,
  WebRagSquareIcon,
} from '@/src/icons';

export const getApplicationIcon = (appId: string, isSquareIcon = false) => {
  if (appId === ModelId.RAG) {
    return isSquareIcon ? RagSquareIcon : RagIcon;
  }

  if (appId === ModelId.HR_BUDDY) {
    return isSquareIcon ? HRBuddySquareIcon : HRBuddyIcon;
  }

  if (appId === ModelId.WEB_RAG) {
    return isSquareIcon ? WebRagSquareIcon : WebRagIcon;
  }

  return DefaultAppIcon;
};
