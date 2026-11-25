/** Parses an `Accept-Encoding` header into lower-cased codings and their q-values. */
export const parseAcceptEncoding = (header: string): Map<string, number> => {
  const codings = new Map<string, number>();
  for (const part of header.split(',')) {
    const [name, ...parameters] = part.trim().toLowerCase().split(';');
    if (!name) continue;
    const quality = parameters
      .map((parameter) => parameter.trim())
      .find((parameter) => parameter.startsWith('q='));
    const value = quality === undefined ? 1 : Number(quality.slice(2));
    codings.set(name, Number.isFinite(value) ? value : 0);
  }
  return codings;
};

/** Returns the `Accept-Encoding` q-value for one coding, `*` included, or 0 when it is not accepted. */
export const acceptedQuality = (
  codings: Map<string, number>,
  coding: string,
): number => codings.get(coding) ?? codings.get('*') ?? 0;
