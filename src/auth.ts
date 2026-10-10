import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import { currentTime } from "./server/clock";
import { consumeRateLimit, LOGIN_LIMIT, loginKey, resetRateLimit } from "./server/rate-limit";
import { verifyCredentials } from "./server/services/users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials) {
        const email = String(credentials?.email ?? "");
        // Counted here so the limit also covers direct calls to the Auth.js endpoint.
        const limit = await consumeRateLimit(loginKey(email), LOGIN_LIMIT, await currentTime());
        if (!limit.allowed) return null;

        const user = await verifyCredentials(credentials);
        if (user) await resetRateLimit(loginKey(email));
        return user;
      },
    }),
  ],
  logger: {
    error(error) {
      if (error instanceof CredentialsSignin) return; // a wrong password is not a server error
      console.error(error);
    },
  },
});
