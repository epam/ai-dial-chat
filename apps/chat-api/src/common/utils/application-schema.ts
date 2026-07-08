/* TODO: this matches on schema id substring because DIAL Core does not yet
   expose a stable capability/type field for schemas. Replace with a proper
   identifier once one is available — don't keep relying on schema id string
   matching. */
export const isQuickAppSchema = (schemaId?: string): boolean =>
  schemaId?.includes('quickapps2') ?? false;
