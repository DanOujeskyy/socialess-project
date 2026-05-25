import type { Pose } from '@tensorflow-models/pose-detection';

export const KP = {
  NOSE: 0,
  LEFT_EYE: 1, RIGHT_EYE: 2,
  LEFT_EAR: 3, RIGHT_EAR: 4,
  LEFT_SHOULDER: 5, RIGHT_SHOULDER: 6,
  LEFT_ELBOW: 7, RIGHT_ELBOW: 8,
  LEFT_WRIST: 9, RIGHT_WRIST: 10,
  LEFT_HIP: 11, RIGHT_HIP: 12,
  LEFT_KNEE: 13, RIGHT_KNEE: 14,
  LEFT_ANKLE: 15, RIGHT_ANKLE: 16,
} as const;

export interface Point2D {
  x: number;
  y: number;
  score?: number;
}

/** Angle in degrees at vertex B, between rays BA and BC. */
export function getAngle(a: Point2D, b: Point2D, c: Point2D): number {
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const mag = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y);
  if (mag === 0) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, dot / mag))) * 180) / Math.PI;
}

export function getKeypoint(pose: Pose, idx: number, minScore = 0.25): Point2D | null {
  const kp = pose.keypoints[idx];
  if (!kp || (kp.score ?? 0) < minScore) return null;
  return { x: kp.x, y: kp.y, score: kp.score };
}

export function avgScore(pose: Pose, indices: number[]): number {
  if (!indices.length) return 0;
  return indices.reduce((s, i) => s + (pose.keypoints[i]?.score ?? 0), 0) / indices.length;
}

export const SKELETON_CONNECTIONS: [number, number][] = [
  [KP.LEFT_EAR,      KP.LEFT_EYE],
  [KP.LEFT_EYE,      KP.NOSE],
  [KP.NOSE,          KP.RIGHT_EYE],
  [KP.RIGHT_EYE,     KP.RIGHT_EAR],
  [KP.LEFT_SHOULDER, KP.RIGHT_SHOULDER],
  [KP.LEFT_SHOULDER, KP.LEFT_ELBOW],
  [KP.LEFT_ELBOW,    KP.LEFT_WRIST],
  [KP.RIGHT_SHOULDER,KP.RIGHT_ELBOW],
  [KP.RIGHT_ELBOW,   KP.RIGHT_WRIST],
  [KP.LEFT_SHOULDER, KP.LEFT_HIP],
  [KP.RIGHT_SHOULDER,KP.RIGHT_HIP],
  [KP.LEFT_HIP,      KP.RIGHT_HIP],
  [KP.LEFT_HIP,      KP.LEFT_KNEE],
  [KP.LEFT_KNEE,     KP.LEFT_ANKLE],
  [KP.RIGHT_HIP,     KP.RIGHT_KNEE],
  [KP.RIGHT_KNEE,    KP.RIGHT_ANKLE],
];
