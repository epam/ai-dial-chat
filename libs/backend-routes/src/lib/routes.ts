export const lazyRoutes = {
    "/api/:slug*": import('./pages/api/[...slug]'),
};
