import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { JwksClient } from 'jwks-rsa';
import type { User } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';
import { sendPasswordResetCode } from '../services/email.service';

const appleJwksClient = new JwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
});

function signTokens(userId: string) {
  const accessToken = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET!,
    { expiresIn: (process.env.JWT_EXPIRES_IN ?? '15m') as any },
  );
  const refreshToken = jwt.sign(
    { sub: userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as any },
  );
  return { accessToken, refreshToken };
}

function safeUser(user: User) {
  const { passwordHash: _, provider: __, providerId: ___, rankTier, ...rest } = user;
  return { ...rest, rankTier: rankTier.toLowerCase() };
}

async function generateUniqueUsername(base: string): Promise<string> {
  const sanitized = base
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 16) || 'user';

  let username = sanitized;
  let suffix = 1;
  while (suffix <= 9999) {
    const exists = await prisma.user.findUnique({ where: { username } });
    if (!exists) return username;
    username = `${sanitized.slice(0, 12)}_${suffix++}`;
  }
  return `user_${Date.now().toString(36)}`;
}

async function findOrCreateSocialUser(params: {
  email: string;
  provider: string;
  providerId: string;
  displayName?: string | null;
}): Promise<User> {
  const { provider, providerId, displayName } = params;
  // Normalise email so social and email/password accounts are always consistent
  const email = params.email.toLowerCase().trim();

  const byProvider = await prisma.user.findFirst({ where: { provider, providerId } });
  if (byProvider) return byProvider;

  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    return prisma.user.update({ where: { id: byEmail.id }, data: { provider, providerId } });
  }

  const username = await generateUniqueUsername(displayName ?? email.split('@')[0]);
  return prisma.user.create({ data: { email, username, provider, providerId } });
}

async function verifyAppleToken(identityToken: string): Promise<{ sub: string; email?: string }> {
  const decoded = jwt.decode(identityToken, { complete: true });
  if (!decoded || typeof decoded === 'string' || !decoded.header.kid) {
    throw new AppError('Invalid Apple identity token', 401);
  }
  const signingKey = await appleJwksClient.getSigningKey(decoded.header.kid);
  const payload = jwt.verify(identityToken, signingKey.getPublicKey(), {
    algorithms: ['RS256'],
    issuer: 'https://appleid.apple.com',
    audience: process.env.APPLE_APP_BUNDLE_ID ?? 'com.socialess.app',
  }) as jwt.JwtPayload;
  if (!payload.sub) throw new AppError('Invalid Apple token payload', 401);
  return { sub: payload.sub, email: payload.email };
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { username, password } = req.body as {
      email: string; username: string; password: string;
    };
    // Always normalise email server-side so DB is always lowercase
    const email = (req.body.email as string).toLowerCase().trim();

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing?.email === email) throw new AppError('An account with this email already exists', 409);
    if (existing?.username === username) throw new AppError('This username is already taken', 409);

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, username, passwordHash },
      select: { id: true, email: true, username: true, level: true, currentStreak: true, totalStreak: true, createdAt: true, gems: true },
    });

    const tokens = signTokens(user.id);
    res.status(201).json({ user, tokens });
  } catch (err) { next(err); }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { password } = req.body as { email: string; password: string };
    const email = (req.body.email as string).toLowerCase().trim();

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('No account found with this email address', 401);

    if (!user.passwordHash) {
      throw new AppError(
        `This account uses ${user.provider === 'google' ? 'Google' : user.provider === 'apple' ? 'Apple' : 'social'} sign-in. Please use that option to log in.`,
        400,
      );
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Incorrect password', 401);

    const tokens = signTokens(user.id);
    res.json({ user: safeUser(user), tokens });
  } catch (err) { next(err); }
}

export async function googleAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { accessToken } = req.body as { accessToken: string };
    if (!accessToken) throw new AppError('Access token required', 400);

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!userInfoRes.ok) throw new AppError('Invalid Google access token', 401);

    const googleUser = await userInfoRes.json() as {
      sub: string;
      email: string;
      name?: string;
      email_verified: boolean;
    };
    if (!googleUser.email || !googleUser.email_verified) {
      throw new AppError('Google account has no verified email', 400);
    }

    const user = await findOrCreateSocialUser({
      email: googleUser.email,
      provider: 'google',
      providerId: googleUser.sub,
      displayName: googleUser.name,
    });

    const tokens = signTokens(user.id);
    res.json({ user: safeUser(user), tokens });
  } catch (err) { next(err); }
}

export async function appleAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const { identityToken, fullName } = req.body as {
      identityToken: string;
      fullName?: { givenName?: string | null; familyName?: string | null } | null;
    };
    if (!identityToken) throw new AppError('Identity token required', 400);

    const { sub: appleId, email } = await verifyAppleToken(identityToken);

    if (!email) {
      // Apple only returns email on first sign-in — look up by providerId
      const existing = await prisma.user.findFirst({ where: { provider: 'apple', providerId: appleId } });
      if (!existing) {
        throw new AppError('Could not retrieve your email from Apple. Please sign in with Apple again from a fresh session.', 400);
      }
      const tokens = signTokens(existing.id);
      return res.json({ user: safeUser(existing), tokens });
    }

    const displayName = [fullName?.givenName, fullName?.familyName].filter(Boolean).join(' ') || undefined;
    const user = await findOrCreateSocialUser({
      email,
      provider: 'apple',
      providerId: appleId,
      displayName,
    });

    const tokens = signTokens(user.id);
    res.json({ user: safeUser(user), tokens });
  } catch (err) { next(err); }
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email: rawEmail } = req.body as { email: string };
    if (!rawEmail) throw new AppError('Email is required', 400);

    const email = rawEmail.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    // If user doesn't exist, return generic message to prevent email enumeration
    if (!user) {
      res.json({ message: 'If an account with that email exists, a code has been sent.' });
      return;
    }

    // If user signed up with Google / Apple (no password), tell them explicitly
    // rather than silently succeeding without sending any code.
    if (!user.passwordHash) {
      const provider = user.provider === 'google' ? 'Google'
        : user.provider === 'apple' ? 'Apple'
        : 'social sign-in';
      throw new AppError(
        `This account uses ${provider}. Please sign in with ${provider} instead of resetting your password.`,
        400,
      );
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiry = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await prisma.user.update({
      where: { id: user.id },
      data: { resetCode: code, resetCodeExpiry: expiry },
    });

    await sendPasswordResetCode(user.email, code);
    res.json({ message: 'If an account with that email exists, a code has been sent.' });
  } catch (err) { next(err); }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, code, newPassword } = req.body as {
      email: string; code: string; newPassword: string;
    };
    if (!email || !code || !newPassword) throw new AppError('Email, code, and new password are required', 400);
    if (newPassword.length < 8) throw new AppError('Password must be at least 8 characters', 400);
    if (!/\d/.test(newPassword)) throw new AppError('Password must contain at least one number', 400);

    // email is already normalised by normalizeEmail() validator on the route
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.resetCode || !user.resetCodeExpiry) {
      throw new AppError('Invalid or expired reset code', 400);
    }
    if (user.resetCode !== code.trim()) {
      throw new AppError('Incorrect reset code', 400);
    }
    if (user.resetCodeExpiry < new Date()) {
      throw new AppError('Reset code has expired. Please request a new one.', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetCode: null, resetCodeExpiry: null },
    });

    res.json({ message: 'Password reset successfully. You can now sign in.' });
  } catch (err) { next(err); }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    if (!refreshToken) throw new AppError('Refresh token required', 400);
    const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { sub: string };
    const tokens = signTokens(payload.sub);
    res.json(tokens);
  } catch {
    next(new AppError('Invalid refresh token', 401));
  }
}

export async function logout(_req: Request, res: Response) {
  res.json({ message: 'Logged out' });
}

export async function getMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, email: true, username: true, avatar: true, level: true,
        currentStreak: true, totalStreak: true, lastActiveDate: true,
        createdAt: true, gems: true,
        rankPoints: true, rankTier: true, rankedWins: true, rankedLosses: true,
      },
    });
    if (!user) throw new AppError('User not found', 404);
    res.json({ ...user, rankTier: user.rankTier.toLowerCase() });
  } catch (err) { next(err); }
}

export async function updatePushToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pushToken } = req.body as { pushToken: string };
    await prisma.user.update({ where: { id: req.userId }, data: { pushToken } });
    res.json({ message: 'Push token updated' });
  } catch (err) { next(err); }
}

export async function updateMe(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { username, avatar } = req.body as { username?: string; avatar?: string };
    const update: Record<string, string> = {};

    if (username !== undefined) {
      const trimmed = username.trim();
      if (trimmed.length < 3 || trimmed.length > 20) {
        throw new AppError('Username must be 3–20 characters', 422);
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        throw new AppError('Username can only contain letters, numbers and underscores', 422);
      }
      // Check uniqueness (exclude self)
      const conflict = await prisma.user.findFirst({
        where: { username: trimmed, NOT: { id: req.userId } },
      });
      if (conflict) throw new AppError('This username is already taken', 409);
      update.username = trimmed;
    }

    if (avatar !== undefined) {
      // Accept a data-URI (base64 image from the mobile client)
      if (avatar && !avatar.startsWith('data:image/')) {
        throw new AppError('Avatar must be a valid image data URI', 422);
      }
      update.avatar = avatar;
    }

    if (Object.keys(update).length === 0) {
      throw new AppError('Nothing to update', 400);
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data:  update,
      select: {
        id: true, email: true, username: true, avatar: true, level: true,
        currentStreak: true, totalStreak: true, lastActiveDate: true,
        createdAt: true, gems: true,
        rankPoints: true, rankTier: true, rankedWins: true, rankedLosses: true,
      },
    });

    res.json({ ...user, rankTier: user.rankTier.toLowerCase() });
  } catch (err) { next(err); }
}
