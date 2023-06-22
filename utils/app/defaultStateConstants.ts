import { Replay } from "@/types/chat";

export const defaultReplay: Replay = {
    isReplay: false,
    replayUserMessagesStack: [],
    activeReplayIndex: 0,
  };