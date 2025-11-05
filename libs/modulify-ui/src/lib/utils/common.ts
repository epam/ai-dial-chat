export const isObjectType = (
  valueToCheck: unknown,
  propsInObject?: string[],
) => {
  return (
    Object.prototype.toString.call(valueToCheck) === '[object Object]' &&
    propsInObject?.every(
      (prop) => prop in (valueToCheck as Record<string, unknown>),
    )
  );
};
