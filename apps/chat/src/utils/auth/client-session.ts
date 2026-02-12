export function isClientSessionValid(session: unknown | null) {
  return (
    session &&
    (session as { data?: { error?: string } }).data?.error !==
      'RefreshAccessTokenError'
  );
}
