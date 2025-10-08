import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
const prisma = require('../../../lib/prisma');

// Security: require NEXTAUTH_SECRET in production
if (process.env.NODE_ENV === 'production' && !process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET environment variable is required in production for NextAuth');
}

export default NextAuth({
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (!email || !password) return null;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          console.log('[nextauth] authorize: user not found for', email);
          return null;
        }
        if (!user.password_hash) {
          // No password set (legacy/demo user) - deny by default for security
          console.log('[nextauth] authorize: user has no password_hash, denying', email);
          return null;
        }
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
          console.log('[nextauth] authorize: password mismatch for', email);
          return null;
        }
        console.log('[nextauth] authorize: success for', email, 'id=', user.id);
        return { id: user.id, name: user.name || null, email: user.email };
      }
    })
  ],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 30 }, // 30 days
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Ensure userId is always a string when set from the DB
        token.userId = user.id ? String(user.id) : token.userId;
        token.name = user.name || token.name;
        token.email = user.email || token.email;
        console.log('[nextauth] jwt callback - created token for user:', token.userId, 'email:', token.email);
      } else {
        // token-only refresh - keep existing token.userId
        console.log('[nextauth] jwt callback - token refresh, userId:', token.userId);
      }
      return token;
    },
    async session({ session, token }) {
      session.user = session.user || {};
      session.user.id = token.userId;
      session.user.name = token.name || session.user.name;
      session.user.email = token.email || session.user.email;
      console.log('[nextauth] session callback - session for user:', session.user.id);
      return session;
    }
  },
  events: {
    async signIn(message) {
      // message = { user, account, profile, isNewUser }
      console.log('[nextauth] event signIn', { user: message.user?.id || message.user, isNewUser: message.isNewUser });
    },
    async signOut(message) {
      console.log('[nextauth] event signOut', message);
    }
  },
  secret: process.env.NEXTAUTH_SECRET || 'dev-nextauth-secret',
  cookies: {
    // Use reasonable defaults and enforce secure cookies in production
    sessionToken: {
      name: 'next-auth.session-token',
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // In dev (http) we must not use SameSite=None+Secure or the cookie won't be set
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      }
    }
    ,
    csrfToken: {
      name: 'next-auth.csrf-token',
      options: {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        path: '/',
      }
    }
  }
});
