import { ModelId } from '@/src/constants/chat';

import DefaultAppIcon from '../../../public/images/icons/message-square-lines-alt.svg';

import {
  HRBuddyIcon,
  HRBuddySquareIcon,
  RagIcon,
  RagSquareIcon,
} from '@/src/icons';

export const getApplicationIcon = (appId: string, isSquareIcon = false) => {
  if (appId === ModelId.RAG) {
    return isSquareIcon ? RagSquareIcon : RagIcon;
  }

  if (appId === ModelId.HR_BUDDY) {
    return isSquareIcon ? HRBuddySquareIcon : HRBuddyIcon;
  }

  return DefaultAppIcon;
};
