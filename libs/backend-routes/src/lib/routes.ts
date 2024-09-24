export const routes = {
  '/api/:slug*': import('./pages/api/[...slug]'),
};
