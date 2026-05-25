import { getAngle, getKeypoint, avgScore, KP } from './poseUtils';
import type { Pose } from '@tensorflow-models/pose-detection';

export type ExerciseType = 'clicks' | 'squats';

/** Movement phase within a single rep cycle. */
export type RepPhase =
  | 'idle'        // no user visible / not started
  | 'standing'    // upright / arms-extended start position
  | 'descending'  // moving toward bottom
  | 'down'        // at bottom of movement
  | 'ascending';  // returning to start

export interface RepState {
  phase: RepPhase;
  repCount: number;
  currentAngle: number;
  poseConfidence: number;

  // Internal phase tracking
  phaseFrameCount: number;
  lastRepTimestamp: number;
  phaseEnteredAt: number;

  // Anti-cheat: track lowest angle since last standing position
  sessionMinAngle: number;

  // Feedback flags
  isInvalidated: boolean;

  // Server-side validation: timestamps of each counted rep
  repTimestamps: number[];
}

// ─── Thresholds ──────────────────────────────────────────────────────────────

const MIN_CONFIDENCE          = 0.28;  // min keypoint confidence to process
const MIN_FRAMES_PER_PHASE    = 3;     // frames required to confirm phase change
const MIN_REP_DURATION_MS     = 800;   // minimum full-rep duration (anti-fast-spam)
const MAX_REPS_PER_SECOND     = 2.0;   // hard cap on rep rate

// Squats — hip–knee–ankle angle
const SQUAT_STAND_DEG  = 158;  // knee angle when standing straight
const SQUAT_DOWN_DEG   = 108;  // knee angle at squat depth
const SQUAT_MIN_RANGE  = 40;   // minimum required range-of-motion

// Push-ups — shoulder–elbow–wrist angle
const PUSHUP_STAND_DEG = 152;  // elbow angle when arms extended
const PUSHUP_DOWN_DEG  =  88;  // elbow angle at chest-near-floor position
const PUSHUP_MIN_RANGE =  55;  // minimum required range-of-motion

// ─── Public API ───────────────────────────────────────────────────────────────

export function createInitialRepState(): RepState {
  return {
    phase: 'idle',
    repCount: 0,
    currentAngle: 180,
    poseConfidence: 0,
    phaseFrameCount: 0,
    lastRepTimestamp: 0,
    phaseEnteredAt: Date.now(),
    sessionMinAngle: 180,
    isInvalidated: false,
    repTimestamps: [],
  };
}

export function processFrame(
  state: RepState,
  pose: Pose | null,
  exerciseType: ExerciseType,
  nowMs: number = Date.now(),
): RepState {
  if (!pose) return { ...state, poseConfidence: 0 };
  return exerciseType === 'squats'
    ? runSquats(state, pose, nowMs)
    : runPushups(state, pose, nowMs);
}

// ─── Exercise-specific angle extraction ──────────────────────────────────────

function runSquats(state: RepState, pose: Pose, nowMs: number): RepState {
  const conf = avgScore(pose, [KP.LEFT_HIP, KP.LEFT_KNEE, KP.LEFT_ANKLE,
                               KP.RIGHT_HIP, KP.RIGHT_KNEE, KP.RIGHT_ANKLE]);
  const ns: RepState = { ...state, poseConfidence: conf };
  if (conf < MIN_CONFIDENCE) return ns;

  const lh = getKeypoint(pose, KP.LEFT_HIP);
  const lk = getKeypoint(pose, KP.LEFT_KNEE);
  const la = getKeypoint(pose, KP.LEFT_ANKLE);
  const rh = getKeypoint(pose, KP.RIGHT_HIP);
  const rk = getKeypoint(pose, KP.RIGHT_KNEE);
  const ra = getKeypoint(pose, KP.RIGHT_ANKLE);

  let angle: number | null = null;
  if (lh && lk && la && rh && rk && ra)
    angle = (getAngle(lh, lk, la) + getAngle(rh, rk, ra)) / 2;
  else if (lh && lk && la) angle = getAngle(lh, lk, la);
  else if (rh && rk && ra) angle = getAngle(rh, rk, ra);

  if (angle === null) return ns;
  ns.currentAngle = angle;
  return machine(ns, angle, SQUAT_STAND_DEG, SQUAT_DOWN_DEG, SQUAT_MIN_RANGE, nowMs);
}

function runPushups(state: RepState, pose: Pose, nowMs: number): RepState {
  const conf = avgScore(pose, [KP.LEFT_SHOULDER, KP.LEFT_ELBOW, KP.LEFT_WRIST,
                               KP.RIGHT_SHOULDER, KP.RIGHT_ELBOW, KP.RIGHT_WRIST]);
  const ns: RepState = { ...state, poseConfidence: conf };
  if (conf < MIN_CONFIDENCE) return ns;

  const ls = getKeypoint(pose, KP.LEFT_SHOULDER);
  const le = getKeypoint(pose, KP.LEFT_ELBOW);
  const lw = getKeypoint(pose, KP.LEFT_WRIST);
  const rs = getKeypoint(pose, KP.RIGHT_SHOULDER);
  const re = getKeypoint(pose, KP.RIGHT_ELBOW);
  const rw = getKeypoint(pose, KP.RIGHT_WRIST);

  let angle: number | null = null;
  if (ls && le && lw && rs && re && rw)
    angle = (getAngle(ls, le, lw) + getAngle(rs, re, rw)) / 2;
  else if (ls && le && lw) angle = getAngle(ls, le, lw);
  else if (rs && re && rw) angle = getAngle(rs, re, rw);

  if (angle === null) return ns;
  ns.currentAngle = angle;
  return machine(ns, angle, PUSHUP_STAND_DEG, PUSHUP_DOWN_DEG, PUSHUP_MIN_RANGE, nowMs);
}

// ─── Core state machine ───────────────────────────────────────────────────────

function machine(
  state: RepState,
  angle: number,
  standThreshold: number,
  downThreshold: number,
  minRange: number,
  nowMs: number,
): RepState {
  const ns = { ...state };
  const isStanding = angle >= standThreshold;
  const isDown     = angle <= downThreshold;

  // Always track minimum angle for range-of-motion anti-cheat
  if (angle < ns.sessionMinAngle) ns.sessionMinAngle = angle;

  switch (state.phase) {
    case 'idle': {
      if (isStanding) {
        ns.phaseFrameCount++;
        if (ns.phaseFrameCount >= MIN_FRAMES_PER_PHASE * 2) {
          ns.phase = 'standing';
          ns.phaseFrameCount = 0;
          ns.phaseEnteredAt = nowMs;
          ns.sessionMinAngle = angle;
        }
      } else {
        ns.phaseFrameCount = Math.max(0, ns.phaseFrameCount - 1);
      }
      break;
    }

    case 'standing': {
      // Reset minimum angle while staying at top — ensures we measure from current position
      ns.sessionMinAngle = angle;
      if (isDown) {
        ns.phaseFrameCount++;
        if (ns.phaseFrameCount >= MIN_FRAMES_PER_PHASE) {
          ns.phase = 'down';
          ns.phaseFrameCount = 0;
          ns.phaseEnteredAt = nowMs;
        }
      } else if (!isStanding) {
        ns.phase = 'descending';
        ns.phaseFrameCount = 0;
      }
      break;
    }

    case 'descending': {
      if (isDown) {
        ns.phaseFrameCount++;
        if (ns.phaseFrameCount >= MIN_FRAMES_PER_PHASE) {
          ns.phase = 'down';
          ns.phaseFrameCount = 0;
          ns.phaseEnteredAt = nowMs;
        }
      } else if (isStanding) {
        // Went back up without going deep enough — abort, no rep
        ns.phase = 'standing';
        ns.phaseFrameCount = 0;
        ns.sessionMinAngle = angle;
      }
      break;
    }

    case 'down': {
      // Just wait — stay in down until user starts coming up
      if (!isDown) {
        ns.phase = 'ascending';
        ns.phaseFrameCount = 0;
      }
      break;
    }

    case 'ascending': {
      if (isStanding) {
        ns.phaseFrameCount++;
        if (ns.phaseFrameCount >= MIN_FRAMES_PER_PHASE) {
          // ── Anti-cheat checks ───────────────────────────────────────────
          const repDuration   = nowMs - state.phaseEnteredAt;
          const timeSinceLast = state.lastRepTimestamp === 0
            ? Infinity : nowMs - state.lastRepTimestamp;
          const actualRange   = standThreshold - ns.sessionMinAngle;

          const tooFast  = repDuration  < MIN_REP_DURATION_MS;
          const tooSoon  = timeSinceLast < (1000 / MAX_REPS_PER_SECOND);
          const tooShort = actualRange   < minRange;

          if (!tooFast && !tooSoon && !tooShort) {
            ns.repCount++;
            ns.lastRepTimestamp = nowMs;
            ns.repTimestamps    = [...state.repTimestamps, nowMs];
            ns.isInvalidated    = false;
          } else {
            // Provide visual feedback but do NOT count
            ns.isInvalidated = true;
          }

          ns.phase          = 'standing';
          ns.phaseFrameCount = 0;
          ns.phaseEnteredAt  = nowMs;
          ns.sessionMinAngle = angle;
        }
      } else if (isDown) {
        // Bounced back down mid-ascent
        ns.phase = 'down';
        ns.phaseFrameCount = 0;
      }
      break;
    }
  }

  return ns;
}
