export interface PlaybackAttachmentType {
  title: string;
  index: string | number;
}

export interface ActiveMessage {
  content: string;
  custom_content?: {
    attachments?: PlaybackAttachmentType[];
  };
}
