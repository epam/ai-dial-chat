export const ROUTES = {
  ROOT: '/',
  LOGIN: '/login',
  CATALOG: '/catalog',
  CONVERSATIONS: '/conversations',
} as const;

export const getConversationRoute = (id: string): string =>
  `${ROUTES.CONVERSATIONS}/${id}`;
