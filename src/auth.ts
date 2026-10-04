import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export function googleSignInConfigured() {
  return Boolean(process.env.AUTH_SECRET?.trim() && process.env.AUTH_GOOGLE_ID?.trim() && process.env.AUTH_GOOGLE_SECRET?.trim());
}

export const { handlers, auth } = NextAuth({
  providers: [Google({ authorization: { params: { scope: "openid email profile", prompt: "select_account" } } })],
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
  trustHost: true,
  callbacks: {
    signIn({ account, profile }) {
      return account?.provider === "google" && profile?.email_verified === true && typeof profile.sub === "string";
    },
    jwt({ token, account }) {
      if (account?.provider === "google") token.sub = account.providerAccountId;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
