import type { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/error.middleware';
import type { AuthRequest } from '../middleware/auth.middleware';

function signTokens(userId: string) {
  const accessToken = jwt.sign(
    { sub: userId },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '15m' },
  );
  const refreshToken = jwt.sign(
    { sub: userId },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d' },
  );
  return { accessToken, refreshToken };
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 422);

    const { email, username, password } = req.body as {
      email: string; username: string; password: string;
    };

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing?.email === email) throw new AppError('Email already registered', 409);
    if (existing?.username === username) throw new AppError('Username already taken', 409);

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
    const { email, password } = req.body as { email: string; password: string };

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError('Invalid credentials', 401);

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new AppError('Invalid credentials', 401);

    const tokens = signTokens(user.id);
    const { passwordHash: _, ...safeUser } = user;
    res.json({ user: safeUser, tokens });
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
      select: { id: true, email: true, username: true, avatar: true, level: true, currentStreak: true, totalStreak: true, lastActiveDate: true, createdAt: true, gems: true },
    });
    if (!user) throw new AppError('User not found', 404);
    res.json(user);
  } catch (err) { next(err); }
}

export async function updatePushToken(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { pushToken } = req.body as { pushToken: string };
    await prisma.user.update({ where: { id: req.userId }, data: { pushToken } });
    res.json({ message: 'Push token updated' });
  } catch (err) { next(err); }
}
