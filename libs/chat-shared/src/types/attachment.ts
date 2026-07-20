/** Discriminates why an attachment upload failed. Only set when `status === RequestStatus.Error`. */
export enum AttachmentErrorReason {
  /** Upload failed because the device was offline. */
  Network = 'network',
  /** File MIME type is not in the deployment's inputAttachmentTypes list. */
  UnsupportedType = 'unsupported-type',
}

/** Discriminates the kind of content an attachment carries. */
export enum AttachmentType {
  /** Generic file attachment (non-image, non-audio). */
  File = 'file',
  /** Raster or vector image. */
  Image = 'image',
  /** Audio file that can be played inline. */
  Audio = 'audio',
  /** A saved prompt snippet. */
  Prompt = 'prompt',
  /** Text pasted directly by the user. */
  Pasted = 'pasted',
  /** A link to a file or webpage. */
  Link = 'link',
}
