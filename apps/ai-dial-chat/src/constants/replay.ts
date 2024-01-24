import { Replay } from '@/src/types/chat';

export const defaultReplay: Replay = {
  isReplay: false,
  replayUserMessagesStack: [],
  activeReplayIndex: 0,
};
