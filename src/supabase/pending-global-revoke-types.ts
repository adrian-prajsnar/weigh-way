export type PendingGlobalRevokeTokens = {
  sessionId: string;
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  revokeScope: 'global' | 'local';
};
