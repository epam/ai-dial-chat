import type {
  ConversationTransferProgress,
  ConversationTransferProgressUnits,
} from '@epam/ai-dial-chat-shared';

/**
 * The three stages every transfer job moves through. `Transfer` is the only
 * one whose work is subdivided, because its unit count is discovered rather
 * than known at enqueue time.
 */
export enum ConversationTransferPhase {
  /** Fetching the conversation, listing conversations, or parsing the import file. */
  Prepare = 'prepare',
  /** Downloading or uploading the discovered units. */
  Transfer = 'transfer',
  /** Serializing, building the archive, or saving the conversations. */
  Finalize = 'finalize',
}

/** Which weight table a job uses. */
export enum ConversationTransferKind {
  ExportSingle = 'exportSingle',
  ExportSingleWithAttachments = 'exportSingleWithAttachments',
  ExportAll = 'exportAll',
  Import = 'import',
}

/** Share of a job's 100 percentage points that each phase is worth. */
interface PhaseWeights {
  [ConversationTransferPhase.Prepare]: number;
  [ConversationTransferPhase.Transfer]: number;
  [ConversationTransferPhase.Finalize]: number;
}

/**
 * Per-kind phase weights, each summing to 100. Fixed rather than derived from
 * the unit count so that discovering how many attachments a job has subdivides
 * work still to do instead of moving the indicator backwards.
 */
export const TRANSFER_PHASE_WEIGHTS: Record<
  ConversationTransferKind,
  PhaseWeights
> = {
  [ConversationTransferKind.ExportSingle]: {
    [ConversationTransferPhase.Prepare]: 20,
    [ConversationTransferPhase.Transfer]: 0,
    [ConversationTransferPhase.Finalize]: 80,
  },
  [ConversationTransferKind.ExportSingleWithAttachments]: {
    [ConversationTransferPhase.Prepare]: 15,
    [ConversationTransferPhase.Transfer]: 70,
    [ConversationTransferPhase.Finalize]: 15,
  },
  [ConversationTransferKind.ExportAll]: {
    [ConversationTransferPhase.Prepare]: 20,
    [ConversationTransferPhase.Transfer]: 70,
    [ConversationTransferPhase.Finalize]: 10,
  },
  [ConversationTransferKind.Import]: {
    [ConversationTransferPhase.Prepare]: 10,
    [ConversationTransferPhase.Transfer]: 70,
    [ConversationTransferPhase.Finalize]: 20,
  },
};

/** Percentage a fully settled job reports. */
export const TRANSFER_PROGRESS_COMPLETE = 100;

const PHASE_ORDER: ConversationTransferPhase[] = [
  ConversationTransferPhase.Prepare,
  ConversationTransferPhase.Transfer,
  ConversationTransferPhase.Finalize,
];

/** Sum of the weights of every phase preceding `phase`. */
const weightBefore = (
  weights: PhaseWeights,
  phase: ConversationTransferPhase,
): number =>
  PHASE_ORDER.slice(0, PHASE_ORDER.indexOf(phase)).reduce(
    (total, earlier) => total + weights[earlier],
    0,
  );

/** Arguments for {@link computeTransferPercent}. */
export interface ComputeTransferPercentParams {
  /** Which weight table applies. */
  kind: ConversationTransferKind;
  /** The phase currently advancing. */
  phase: ConversationTransferPhase;
  /**
   * Units settled within `phase`. Omit (or pass `total: 0`) for a phase whose
   * work is not subdivided; its whole weight is then credited at once.
   */
  completed?: number;
  /** Units `phase` will settle in total. */
  total?: number;
}

/**
 * Returns the job's completion as an integer 0–100: every earlier phase's
 * weight in full, plus `phase`'s weight scaled by `completed / total`. A phase
 * with no units to settle is credited in full, so a conversation with no
 * attachments never stalls at the start of the transfer phase.
 */
export const computeTransferPercent = ({
  kind,
  phase,
  completed = 0,
  total = 0,
}: ComputeTransferPercentParams): number => {
  const weights = TRANSFER_PHASE_WEIGHTS[kind];
  const settledFraction = total > 0 ? Math.min(completed / total, 1) : 1;
  const percent =
    weightBefore(weights, phase) + weights[phase] * settledFraction;

  return Math.round(Math.min(Math.max(percent, 0), TRANSFER_PROGRESS_COMPLETE));
};

/** Builds the progress patch for a phase, carrying its unit readout when the phase has units. */
export const buildTransferProgress = (
  params: ComputeTransferPercentParams,
  units?: ConversationTransferProgressUnits,
): ConversationTransferProgress => ({
  percent: computeTransferPercent(params),
  units,
});
