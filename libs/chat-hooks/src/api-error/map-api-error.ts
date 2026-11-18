/**
 * Returns `operation` with a rejection replaced by the error `mapError` builds
 * for it. A rejection `mapError` has no replacement for is rethrown unchanged.
 * Reading an API error body is asynchronous, so the mapping lives here rather
 * than in a synchronous predicate.
 * @param operation - the request whose rejection may need a typed error
 * @param mapError - resolves the replacement error, or `undefined` to keep the original
 */
export const withApiErrorMapping =
  <Args extends unknown[], Result>(
    operation: (...args: Args) => Promise<Result>,
    mapError: (error: unknown) => Promise<unknown>,
  ) =>
  async (...args: Args): Promise<Result> => {
    try {
      return await operation(...args);
    } catch (error) {
      const mapped = await mapError(error);
      if (mapped !== undefined) throw mapped;
      throw error;
    }
  };
