type AppendLog = (line: string) => void;

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message ? error.message : String(error);

/** Runs a sandbox action and reports failures to both DevTools and Event log. */
export const runLoggedOverlayAction = async <T>(
  actionName: string,
  action: () => Promise<T>,
  formatSuccess: (response: T) => string,
  appendLog: AppendLog,
): Promise<void> => {
  try {
    appendLog(formatSuccess(await action()));
  } catch (error) {
    const message = `${actionName} failed -> ${getErrorMessage(error)}`;
    console.error(`[ChatOverlay sandbox] ${message}`, error);
    appendLog(message);
  }
};
