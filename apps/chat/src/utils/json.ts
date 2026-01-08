export const safeParseJSON = (
  jsonData: string | undefined,
  errorMessage: string,
  logger: { error: (...args: unknown[]) => void },
) => {
  try {
    if (!jsonData) {
      return {};
    }
    return JSON.parse(jsonData);
  } catch (err) {
    logger.error(errorMessage, err);
    throw Error(`${errorMessage}: ${err}`);
  }
};
