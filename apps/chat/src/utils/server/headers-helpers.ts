export const cleanHeaderDirectives = (directives: string) =>
  directives.replace(/\s{2,}/g, ' ').trim();
