/**
 * Labels for the built-in instructions markdown viewer (`MDMessageViewer`),
 * used when the host does not supply `renderInstructions`. Ignored when
 * `renderInstructions` is supplied — the host's renderer owns its own labels.
 */
export interface ScheduledTaskInstructionsMarkdownLabels {
  /** Accessible label for the copy button on a fenced code block. Defaults to `'Copy code'`. */
  codeBlockCopyLabel?: string;
  /** Status announced after a fenced code block has been copied. Defaults to `'Copied!'`. */
  codeBlockCopiedLabel?: string;
  /** Accessible label for the download button on a fenced code block. Defaults to `'Download code'`. */
  codeBlockDownloadLabel?: string;
  /** Accessible label for a table's horizontally scrollable region. Defaults to `'Scrollable table'`. */
  tableScrollRegionAriaLabel?: string;
  /** Accessible label for a block formula's horizontally scrollable region. Defaults to `'Scrollable formula'`. */
  mathScrollRegionAriaLabel?: string;
}
