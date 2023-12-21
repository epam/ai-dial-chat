export interface PlaybackAttachment {
  title: string;
  index: string | number;
}

export interface ActiveMessage {
  content: string;
  custom_content?: {
    attachments?: PlaybackAttachment[];
  };
}
