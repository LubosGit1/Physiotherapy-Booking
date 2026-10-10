import type { NextAuthConfig } from "next-auth";
import { homeFor, pageAccess, type Role } from "@/lib/access";

const AUTH_PAGES = ["/login", "/register"];

/** Edge-safe part of the Auth.js config, shared with middleware (no database, no bcrypt). */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const role = auth?.user?.role;
      if (role && AUTH_PAGES.includes(nextUrl.pathname)) return Response.redirect(new URL(homeFor(role), nextUrl));

      const decision = pageAccess(nextUrl.pathname, role);
      if (decision === "forbidden") return Response.redirect(new URL("/forbidden", nextUrl));
      return decision === "allow"; // false sends the visitor to /login?callbackUrl=…
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: Role }).role;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === "string") session.user.id = token.id;
      session.user.role = token.role as Role;
      return session;
    },
  },
} satisfies NextAuthConfig;
