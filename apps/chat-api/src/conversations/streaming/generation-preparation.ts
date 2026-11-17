import {
  HttpException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ConversationGenerationService,
  GenerationCancelReason,
  type GenerationLease,
} from '../generation/conversation-generation.service';
import { GenerationPreparationStep } from '../generation/generation.types';

const PREPARATION_EXPIRED = Symbol('preparation-expired');

/*
 * A start-state write that failed for a reason other than a refusal may still have been
 * stored by DIAL Core (a timeout, a 5xx), so its marker must be released.
 */
export const isStartWriteOutcomeUnknown = (error: unknown): boolean =>
  !(error instanceof HttpException) || error.getStatus() >= 500;

/*
 * Raised when preparation stops without its step having failed: it outlived
 * `GENERATION_PREPARATION_TIMEOUT_MS`, or shutdown released the entry. Its own
 * type lets the pre-stream `catch` blocks tell it apart from a step that
 * rejected: a rejected step is finished and releases the key at once, while
 * an abandoned one may still write, so its key is released only when it
 * settles (`generation-registry`).
 */
export class GenerationPreparationInterruptedException extends ServiceUnavailableException {}

/*
 * The interruption by process shutdown. Unlike an abandoned step, nothing is pending:
 * the worker settles its own entry at once, after releasing a marker it stored, so the
 * shutdown flush need not wait for it (`generation-registry`).
 */
export class GenerationShutdownInterruptedException extends GenerationPreparationInterruptedException {}

/** Whether a pre-stream failure leaves the worker to settle its own entry now. */
export const isSettledByWorker = (error: unknown): boolean =>
  !(error instanceof GenerationPreparationInterruptedException) ||
  error instanceof GenerationShutdownInterruptedException;

/**
 * Runs once an abandoned step settles, before its entry settles; receives the step's
 * rejection, or `undefined` when it resolved.
 */
export type AfterAbandonedStep = (error: unknown) => Promise<void>;

/** One generation's preparation bound: a single timer raced by each step. */
export interface PreparationDeadline {
  /**
   * Starts `operation` and awaits it unless the deadline elapses first, in
   * which case the preparation is abandoned and
   * `GenerationPreparationInterruptedException` is thrown. Also throws it when
   * the step resolved after shutdown released the entry, so nothing further
   * runs. A step that rejects rethrows its own error.
   */
  run<T>(
    step: GenerationPreparationStep,
    operation: () => Promise<T>,
    afterAbandoned?: AfterAbandonedStep,
  ): Promise<T>;
  /** Clears the timer; idempotent. */
  end(): void;
}

/**
 * Arms and enforces the preparation bound of foreground generations. Owned by
 * `ConversationStreamingService`, which passes its own logger.
 */
export class GenerationPreparation {
  constructor(
    private readonly generationService: ConversationGenerationService,
    private readonly logger: Logger,
    private readonly timeoutMs: number,
  ) {}

  /**
   * Arms the preparation bound for `lease`. When it elapses while a step is
   * pending, the worker stops waiting and runs nothing further; the registry
   * releases the entry's subscribers but keeps its key until that step
   * settles, because a `Promise.race` does not stop a remote write
   * (`generation-registry`).
   * @param lease - the preparing generation's lease
   */
  start(lease: GenerationLease): PreparationDeadline {
    let isExpired = false;
    let timer: NodeJS.Timeout | undefined;
    const expired = new Promise<typeof PREPARATION_EXPIRED>((resolve) => {
      timer = setTimeout(() => {
        isExpired = true;
        resolve(PREPARATION_EXPIRED);
      }, this.timeoutMs);
    });
    const end = (): void => clearTimeout(timer);

    const abandon = (
      step: GenerationPreparationStep,
      pending?: Promise<unknown>,
      afterAbandoned?: AfterAbandonedStep,
    ): never => {
      end();
      this.generationService.abandonPreparation(lease, step);
      if (pending) {
        void this.releaseAfterAbandonedStep(
          lease,
          step,
          pending,
          afterAbandoned,
        );
      } else {
        /* Nothing was dispatched, so nothing can still write. */
        this.generationService.error(lease);
      }
      throw new GenerationPreparationInterruptedException(
        'Generation preparation timed out',
      );
    };
    /*
     * Shutdown cancels a preparing foreground entry and keeps its key for the worker to
     * settle, or has already released it.
     */
    const assertStillOwned = (): void => {
      const cancellation = this.generationService.getCancellation(lease);
      if (
        cancellation &&
        cancellation.reason !== GenerationCancelReason.Shutdown
      ) {
        return;
      }
      end();
      throw new GenerationShutdownInterruptedException(
        'Generation preparation was interrupted by shutdown',
      );
    };

    return {
      end,
      run: async <T>(
        step: GenerationPreparationStep,
        operation: () => Promise<T>,
        afterAbandoned?: AfterAbandonedStep,
      ): Promise<T> => {
        if (isExpired) return abandon(step);
        const pending = operation();
        let result: T | typeof PREPARATION_EXPIRED;
        try {
          result = await Promise.race([pending, expired]);
        } catch (err) {
          /*
           * A rejected step keeps its own error even when shutdown released
           * the entry meanwhile; callers that continue after a rejection
           * check ownership themselves.
           */
          end();
          throw err;
        }
        if (result === PREPARATION_EXPIRED) {
          return abandon(step, pending, afterAbandoned);
        }
        assertStillOwned();
        return result;
      },
    };
  }

  /**
   * Frees an abandoned preparation's key once its pending step resolves or
   * rejects — the only point at which it can no longer write. The step's
   * result is discarded; a rejection is logged rather than left unhandled.
   * @param lease - the abandoned generation's lease
   * @param step - the step that was pending at the deadline
   * @param pending - that step's promise
   */
  private async releaseAfterAbandonedStep(
    lease: GenerationLease,
    step: GenerationPreparationStep,
    pending: Promise<unknown>,
    afterAbandoned?: AfterAbandonedStep,
  ): Promise<void> {
    let failure: unknown;
    try {
      await pending;
      this.logger.debug(`Abandoned preparation step settled: ${step}`);
    } catch (err) {
      failure = err;
      this.logger.warn(`Abandoned preparation step failed: ${step}`, err);
    }
    try {
      await afterAbandoned?.(failure);
    } finally {
      this.generationService.error(lease);
    }
  }
}
