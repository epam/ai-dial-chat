import type { DialFileNodeType } from '@epam/ai-dial-react-file-manager';

/**
 * Minimal node shape file-manager selection predicates are evaluated against.
 * Satisfied by both grid rows and `DialFile` controller items, so one
 * predicate can gate manual grid clicks and programmatic selection changes.
 */
export interface FileManagerSelectableNode {
  /** Virtual path of the node. */
  path: string;
  /** Distinguishes folders from files. */
  nodeType: DialFileNodeType;
  /** MIME type of a file node, when known. */
  contentType?: string;
  /** Size in bytes of a file node, when known. */
  contentLength?: number;
}
