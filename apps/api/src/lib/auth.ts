export interface AuthProvider {
  verify(token: string | undefined): Promise<{ userId: string } | null>;
}

// Dev stub: treats the bearer token as a literal userId.
// Swap this for a Clerk/Auth0 JWT verifier — nothing else changes.
export const stubAuthProvider: AuthProvider = {
  async verify(token) {
    if (!token) return null;
    return { userId: token };
  },
};
