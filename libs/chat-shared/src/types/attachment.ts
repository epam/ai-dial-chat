/** Discriminates the kind of content an attachment carries. */
export enum AttachmentType {
  /** Generic file attachment (non-image). */
  File = 'file',
  /** Raster or vector image. */
  Image = 'image',
  /** A saved prompt snippet. */
  Prompt = 'prompt',
  /** Text pasted directly by the user. */
  Pasted = 'pasted',
}
