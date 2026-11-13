/**
 * Where an environment admission function reports what it dropped. The ENV
 * provider passes callbacks bound to its own `Logger`, so messages and levels
 * stay those operators already see; a pure function never constructs a logger.
 */
export interface AdmissionLog {
  readonly warn: (message: string) => void;
  readonly error: (message: string) => void;
}
