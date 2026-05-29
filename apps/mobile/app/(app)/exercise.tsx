/**
 * ExerciseScreen — real-time AI pose detection
 *
 * Visual stack (bottom → top):
 *  1. CameraView       full screen, full brightness, MUTED (no shutter sound ever)
 *  2. Svg overlay      AnimatedLine bones + AnimatedCircle joints, driven by
 *                      Reanimated spring-physics SharedValues → 60 fps skeleton
 *  3. Edge gradients   thin dark fade at top & bottom for text readability only
 *  4. UI chrome        top bar, rep counter, phase pill, done button
 *
 * Inference pipeline (primary — GL texture, zero JPEG / disk I/O):
 *   Hidden 1×1 GLView → createCameraTextureAsync(camRef) → fromTexture (192×192)
 *   → MoveNet CPU → update SharedValues via withSpring → skeleton animates smoothly
 *
 * Fallback (if GL texture creation fails at runtime):
 *   takePictureAsync (muted, quality 0.1) → decodeJpeg → MoveNet → same skeleton
 */

import React, {
  useState, useCallback, useRef, useEffect, memo, useMemo,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Dimensions, StatusBar, PixelRatio,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { GLView } from 'expo-gl';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Circle } from 'react-native-svg';
import Animated, {
  useAnimatedProps, withSpring, makeMutable,
  type SharedValue,
} from 'react-native-reanimated';
import * as tf from '@tensorflow/tfjs-core';

import { Colors, FontSize, FontWeight, Spacing, Radius } from '../../src/theme';
import {
  initPoseDetector, detectPoseFromJpeg, detectPoseFromTensor, isPoseDetectorReady,
} from '../../src/services/poseDetection.service';
import {
  createInitialRepState, processFrame,
  type ExerciseType, type RepState, type RepPhase,
} from '../../src/utils/exerciseAlgorithms';
import { SKELETON_CONNECTIONS } from '../../src/utils/poseUtils';
import { useTimeStore } from '../../src/store/time.store';
import { activitiesService } from '../../src/services/activities.service';
import type { Pose } from '@tensorflow-models/pose-detection';

// GL camera utilities — direct subpath import (no "exports" map in package.json)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { fromTexture, detectGLCapabilities } from '@tensorflow/tfjs-react-native/dist/camera/camera';

// ─── Animated SVG primitives ─────────────────────────────────────────────────
const AnimatedLine   = Animated.createAnimatedComponent(Line);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ─── Constants ────────────────────────────────────────────────────────────────
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const SP = { damping: 20, stiffness: 200, mass: 0.5 } as const;

// MoveNet Lightning optimal input resolution (width must be multiple of 4)
const INFER_W = 192;
const INFER_H = 192;

type ScreenPhase = 'loading' | 'permission' | 'countdown' | 'tracking' | 'results';
type KpSV = { x: SharedValue<number>; y: SharedValue<number>; v: SharedValue<boolean> };

// ─── Phase helpers ────────────────────────────────────────────────────────────
function pColor(phase: RepPhase): string {
  switch (phase) {
    case 'idle':       return '#94A3B8';
    case 'standing':   return '#22C55E';
    case 'descending': return '#FB923C';
    case 'down':       return '#A78BFA';
    case 'ascending':  return '#38BDF8';
  }
}
function pLabel(phase: RepPhase): string {
  switch (phase) {
    case 'idle':       return 'Get Ready…';
    case 'standing':   return 'READY  ✓';
    case 'descending': return 'DOWN  ↓';
    case 'down':       return 'BOTTOM  ✓';
    case 'ascending':  return 'UP  ↑';
  }
}

// ─── Exercise config ──────────────────────────────────────────────────────────
const CONFIGS = {
  clicks: {
    label: 'Push ups', emoji: '🤸',
    hint: 'Lie down in push-up position. Place the phone on the floor to the side — the camera must see your shoulders and hands.',
  },
  squats: {
    label: 'Squats', emoji: '🏋️',
    hint: 'Stand facing the camera. Place the phone at hip height — your full body must be visible.',
  },
} as const;

// ─── BoneViz ──────────────────────────────────────────────────────────────────
const BoneViz = memo(function BoneViz({
  kp1, kp2, colorSv,
}: { kp1: KpSV; kp2: KpSV; colorSv: SharedValue<string> }) {
  const pos = useAnimatedProps(() => ({
    x1: kp1.x.value, y1: kp1.y.value,
    x2: kp2.x.value, y2: kp2.y.value,
    opacity: kp1.v.value && kp2.v.value ? 1 : 0,
  }));
  const fill = useAnimatedProps(() => ({
    x1: kp1.x.value, y1: kp1.y.value,
    x2: kp2.x.value, y2: kp2.y.value,
    stroke: colorSv.value,
    opacity: kp1.v.value && kp2.v.value ? 1 : 0,
  }));
  return (
    <>
      <AnimatedLine animatedProps={pos} stroke="rgba(0,0,0,0.55)" strokeWidth={14} strokeLinecap="round" />
      <AnimatedLine animatedProps={fill} strokeWidth={7} strokeLinecap="round" />
    </>
  );
});

// ─── JointViz ─────────────────────────────────────────────────────────────────
const JointViz = memo(function JointViz({
  kp, colorSv,
}: { kp: KpSV; colorSv: SharedValue<string> }) {
  const shadow = useAnimatedProps(() => ({
    cx: kp.x.value, cy: kp.y.value, opacity: kp.v.value ? 0.55 : 0,
  }));
  const disc = useAnimatedProps(() => ({
    cx: kp.x.value, cy: kp.y.value, fill: colorSv.value, opacity: kp.v.value ? 1 : 0,
  }));
  return (
    <>
      <AnimatedCircle animatedProps={shadow} r={14} fill="black" />
      <AnimatedCircle animatedProps={disc} r={9} stroke="rgba(255,255,255,0.9)" strokeWidth={2.5} />
    </>
  );
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64);
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
  return b;
}

// ─── ExerciseScreen ───────────────────────────────────────────────────────────
export default function ExerciseScreen() {
  const { type } = useLocalSearchParams<{ type: string }>();
  const exType: ExerciseType = type === 'squats' ? 'squats' : 'clicks';
  const cfg = CONFIGS[exType];
  const insets = useSafeAreaInsets();

  const [permission, requestPermission] = useCameraPermissions();
  const [screen,   setScreen]   = useState<ScreenPhase>('loading');
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [display,  setDisplay]  = useState<RepState>(createInitialRepState());
  const [syncing,  setSyncing]  = useState(false);
  const [conf,     setConf]     = useState(0);

  const camRef       = useRef<CameraView>(null);
  const glViewRef    = useRef<GLView>(null);
  const stateRef     = useRef<RepState>(createInitialRepState());
  const activeRef    = useRef(false);
  const camReadyRef  = useRef(false);
  // Fallback-only refs
  const capturingRef = useRef(false);
  const loopRef      = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // GL stream refs
  const glStreamRef  = useRef(false);   // true when GL texture loop is running
  const inferringRef = useRef(false);   // prevent overlapping inferences
  const glRafRef     = useRef<number | undefined>(undefined);
  // UI refresh
  const uiRef        = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const { addTime, incrementClicks, incrementSquats, getEffectiveActivityRate } = useTimeStore();
  const rate = getEffectiveActivityRate(exType === 'clicks' ? 'clicks' : 'squats');

  // ── Shared values for 17 keypoints ──────────────────────────────────────────
  const kpSV = useMemo<KpSV[]>(
    () => Array.from({ length: 17 }, () => ({
      x: makeMutable(SCREEN_W / 2),
      y: makeMutable(SCREEN_H / 2),
      v: makeMutable(false as boolean),
    })),
    [],
  );
  const colorSv = useMemo(() => makeMutable(pColor('idle')), []);

  // ── Map pose keypoints to screen SharedValues ────────────────────────────────
  // flipX = true  → snapshot path (capture is not mirrored, preview is → we flip)
  // flipX = false → GL texture path (texture already matches the mirrored preview)
  const applyPose = useCallback((
    pose: Pose, imgW: number, imgH: number, phase: RepPhase, flipX = true,
  ) => {
    const sx = SCREEN_W / imgW;
    const sy = SCREEN_H / imgH;
    pose.keypoints.forEach((kp, i) => {
      const vis = (kp.score ?? 0) > 0.25;
      kpSV[i].v.value = vis;
      if (vis) {
        const x = flipX ? SCREEN_W - kp.x * sx : kp.x * sx;
        kpSV[i].x.value = withSpring(x, SP);
        kpSV[i].y.value = withSpring(kp.y * sy, SP);
      }
    });
    colorSv.value = pColor(phase);
  }, [kpSV, colorSv]);

  // ── Stop everything ───────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    activeRef.current    = false;
    capturingRef.current = false;
    glStreamRef.current  = false;
    if (glRafRef.current !== undefined) {
      cancelAnimationFrame(glRafRef.current);
      glRafRef.current = undefined;
    }
    clearTimeout(loopRef.current);
    clearInterval(uiRef.current);
  }, []);

  // ── Init ─────────────────────────────────────────────────────────────────────
  useEffect(() => {
    let dead = false;
    (async () => {
      if (!permission?.granted) {
        const r = await requestPermission();
        if (!r.granted || dead) { if (!dead) setScreen('permission'); return; }
      }
      try {
        await initPoseDetector(p => { if (!dead) setProgress(p); });
        if (!dead) startCountdown();
      } catch {
        if (!dead) Alert.alert('Error', 'Could not load the AI model.', [
          { text: 'Go Back', onPress: () => router.back() },
        ]);
      }
    })();
    return () => { dead = true; stopAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Countdown ────────────────────────────────────────────────────────────────
  const startCountdown = () => {
    setScreen('countdown');
    let n = 3; setCountdown(n);
    const t = setInterval(() => {
      n--;
      setCountdown(n);
      if (n > 0) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (n <= 0) {
        clearInterval(t);
        stateRef.current = createInitialRepState();
        activeRef.current = true;
        setScreen('tracking');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        // UI refresh loop (reads stateRef every 150ms)
        uiRef.current = setInterval(() => {
          if (activeRef.current) setDisplay({ ...stateRef.current });
        }, 150);
        // GL stream should already be warming up via onGLContextCreate.
        // runLoop() is kept as a safety net in case GL stream isn't ready yet —
        // glStreamRef.current = true will stop it once GL takes over.
        runLoop();
      }
    }, 1000);
  };

  // ── GL camera stream (PRIMARY) ────────────────────────────────────────────────
  // Called when the tiny hidden GLView creates its WebGL context.
  // Tries createCameraTextureAsync → fromTexture → MoveNet in a rAF loop.
  // Sets glStreamRef.current = true on success, which stops the fallback runLoop.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onGLContextCreate = useCallback(async (gl: any) => {
    try {
      // Wait for the camera session to be ready (up to 12 s)
      let waited = 0;
      while (!camReadyRef.current && waited < 12000) {
        await new Promise<void>(r => setTimeout(r, 100));
        waited += 100;
      }
      if (!camReadyRef.current) throw new Error('Camera not ready');

      // One-time GL capability probe for optimal pixel readback
      await detectGLCapabilities(gl as unknown as WebGL2RenderingContext);

      // Bind the live camera output as a GL texture on the hidden GLView
      const cameraTexture = await glViewRef.current!.createCameraTextureAsync(camRef.current!);

      // Success — GL stream takes over from the snapshot fallback
      glStreamRef.current = true;

      const loop = () => {
        if (!glStreamRef.current) return;   // stopped by stopAll()

        // Extract a 192×192 tensor from the GL camera texture.
        // fromTexture does: shader resize → gl.readPixels → tf.tensor3d (CPU, int32)
        // Source dims don't matter when useCustomShadersToResize=false.
        if (!inferringRef.current && isPoseDetectorReady()) {
          let tensor: tf.Tensor3D | null = null;
          try {
            tensor = fromTexture(
              gl as unknown as WebGL2RenderingContext,
              cameraTexture,
              { width: 1920, height: 1080, depth: 4 },   // placeholder — ignored by GL bilinear resize
              { width: INFER_W, height: INFER_H, depth: 3 },
              false,   // useCustomShadersToResize
            ) as tf.Tensor3D;
          } catch { /* skip frame on GL error */ }

          if (tensor) {
            inferringRef.current = true;
            const t = tensor;
            detectPoseFromTensor(t)
              .then(pose => {
                tf.dispose(t);
                inferringRef.current = false;
                if (pose && activeRef.current) {
                  const prev = stateRef.current.repCount;
                  stateRef.current = processFrame(stateRef.current, pose, exType, Date.now());
                  if (stateRef.current.repCount > prev) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  }
                  const c = pose.keypoints.slice(5, 17)
                    .reduce((s, kp) => s + (kp.score ?? 0), 0) / 12;
                  setConf(c);
                  // GL texture is already mirrored (matches the live preview) → no flip
                  applyPose(pose, INFER_W, INFER_H, stateRef.current.phase, false);
                }
              })
              .catch(() => {
                tf.dispose(t);
                inferringRef.current = false;
              });
          }
        }

        // expo-gl requires endFrameEXP every RAF tick (even with no visible rendering)
        (gl as any).endFrameEXP();
        glRafRef.current = requestAnimationFrame(loop);
      };

      glRafRef.current = requestAnimationFrame(loop);

    } catch (e) {
      // GL texture approach not available on this device/OS — snapshot fallback handles it
      console.warn('[ExerciseScreen] GL stream unavailable, snapshot fallback active:', e);
      // runLoop() is already running (started from startCountdown), nothing to do here
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exType, applyPose]);

  // ── Snapshot fallback loop ────────────────────────────────────────────────────
  // Used when GL texture creation fails OR as a safety net until GL starts.
  // Automatically yields once glStreamRef.current becomes true.
  const runLoop = () => {
    const tick = async () => {
      if (!activeRef.current) return;
      if (glStreamRef.current) return;  // GL stream has taken over — stop

      if (!capturingRef.current && camReadyRef.current && camRef.current) {
        capturingRef.current = true;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const snap = await (camRef.current as any).takePictureAsync({
            quality: 0.1, base64: true, skipProcessing: true, exif: false,
          }) as Record<string, any>;

          if (snap?.base64 && activeRef.current && !glStreamRef.current) {
            const pose = await detectPoseFromJpeg(b64ToBytes(snap.base64));
            if (pose && activeRef.current) {
              const w = snap.width  ?? SCREEN_W;
              const h = snap.height ?? SCREEN_H;
              const prev = stateRef.current.repCount;
              stateRef.current = processFrame(stateRef.current, pose, exType, Date.now());
              if (stateRef.current.repCount > prev) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }
              const c = pose.keypoints.slice(5, 17)
                .reduce((s, kp) => s + (kp.score ?? 0), 0) / 12;
              setConf(c);
              applyPose(pose, w, h, stateRef.current.phase);
            }
          }
        } catch { /* keep loop alive */ }
        finally { capturingRef.current = false; }
      }

      if (activeRef.current && !glStreamRef.current) {
        loopRef.current = setTimeout(tick, 70);
      }
    };
    tick();
  };

  // ── Finish / Submit ───────────────────────────────────────────────────────────
  const finish = useCallback(() => {
    stopAll();
    setDisplay({ ...stateRef.current });
    setScreen('results');
  }, [stopAll]);

  const submit = useCallback(async () => {
    const count = stateRef.current.repCount;
    if (count === 0) { router.back(); return; }
    setSyncing(true);
    try {
      const res = exType === 'clicks'
        ? await activitiesService.recordClicks(count)
        : await activitiesService.recordSquats(count);
      addTime(res.secondsAdded);
      if (exType === 'clicks') incrementClicks(count); else incrementSquats(count);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch {
      Alert.alert('Save Error', 'Please try again.', [
        { text: 'Retry', onPress: submit },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } finally { setSyncing(false); }
  }, [exType, addTime, incrementClicks, incrementSquats]);

  // ── Derived ───────────────────────────────────────────────────────────────────
  const earned    = Math.round(display.repCount * rate);
  const camOn     = screen === 'countdown' || screen === 'tracking';
  const skeletonOn = screen === 'countdown' || screen === 'tracking';
  const pc        = pColor(display.phase);
  const confColor = conf > 0.55 ? '#22C55E' : conf > 0.28 ? '#FB923C' : '#EF4444';
  const confLabel = conf > 0.55 ? 'Good Shot' : conf > 0.28 ? 'Weak Shot' : "Can't See You";

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* 1 ── LIVE CAMERA — full brightness, fully muted ────────────────────── */}
      {camOn && permission?.granted && (
        <>
          <CameraView
            ref={camRef}
            style={StyleSheet.absoluteFillObject}
            facing="front"
            mute                           // suppress ALL camera sounds
            onCameraReady={() => { camReadyRef.current = true; }}
          />

          {/* Hidden 1×1 GLView — solely for GL camera texture extraction.
              createCameraTextureAsync(camRef) binds the camera as a GL texture;
              fromTexture reads pixels each RAF tick for MoveNet inference.
              Zero impact on the visible CameraView preview above. */}
          <GLView
            ref={glViewRef}
            style={s.glView}
            onContextCreate={onGLContextCreate as any}
          />
        </>
      )}

      {/* 2 ── ANIMATED SKELETON — SVG overlay, fully transparent bg ────────── */}
      {skeletonOn && (
        <Svg
          style={StyleSheet.absoluteFillObject}
          width={SCREEN_W}
          height={SCREEN_H}
          pointerEvents="none"
        >
          {SKELETON_CONNECTIONS.map(([i, j], idx) => (
            <BoneViz key={idx} kp1={kpSV[i]} kp2={kpSV[j]} colorSv={colorSv} />
          ))}
          {kpSV.map((kp, i) => (
            <JointViz key={i} kp={kp} colorSv={colorSv} />
          ))}
        </Svg>
      )}

      {/* 3 ── EDGE GRADIENTS — only for text readability ────────────────────── */}
      {camOn && (
        <>
          <LinearGradient
            colors={['rgba(0,0,0,0.65)', 'rgba(0,0,0,0)']}
            style={s.gradTop}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']}
            style={s.gradBottom}
            pointerEvents="none"
          />
        </>
      )}

      {/* ═══ LOADING ══════════════════════════════════════════════════════════ */}
      {screen === 'loading' && (
        <View style={s.center}>
          <Text style={s.emoji}>{cfg.emoji}</Text>
          <Text style={s.h1}>{cfg.label}</Text>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={s.muted}>Loading AI model… {Math.round(progress * 100)}%</Text>
        </View>
      )}

      {/* ═══ PERMISSION ═══════════════════════════════════════════════════════ */}
      {screen === 'permission' && (
        <View style={s.center}>
          <Text style={s.emoji}>📸</Text>
          <Text style={s.h1}>Camera Access</Text>
          <Text style={s.body}>Camera access is needed to track your movement and count reps.</Text>
          <TouchableOpacity style={s.btn} onPress={requestPermission}>
            <Text style={s.btnText}>Allow Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.muted}>Go Back</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ═══ COUNTDOWN ════════════════════════════════════════════════════════ */}
      {screen === 'countdown' && (
        <View style={s.cdWrap} pointerEvents="none">
          <Text style={s.cdNum}>{countdown === 0 ? 'GO!' : countdown}</Text>
          <View style={s.hintBox}>
            <Text style={s.hintText}>{cfg.hint}</Text>
          </View>
        </View>
      )}

      {/* ═══ TRACKING ═════════════════════════════════════════════════════════ */}
      {screen === 'tracking' && (
        <>
          {/* Top bar */}
          <View style={[s.topBar, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity style={s.closeBtn} onPress={finish} hitSlop={16}>
              <Text style={s.closeTxt}>✕</Text>
            </TouchableOpacity>
            <Text style={s.topTitle}>{cfg.label}</Text>
            <View style={s.sigRow}>
              <View style={[s.sigDot, { backgroundColor: confColor }]} />
              <Text style={[s.sigLabel, { color: confColor }]}>{confLabel}</Text>
            </View>
          </View>

          {/* Phase pill */}
          <View style={s.pillWrap} pointerEvents="none">
            <View style={[s.pill, { backgroundColor: pc + '25', borderColor: pc + '80' }]}>
              <Text style={[s.pillTxt, { color: pc }]}>{pLabel(display.phase)}</Text>
            </View>
          </View>

          {/* Rep counter */}
          <View style={[s.repBlock, { bottom: insets.bottom + 86 }]} pointerEvents="none">
            <Text style={s.repNum}>{display.repCount}</Text>
            <Text style={s.repLbl}>reps</Text>
            {display.repCount > 0 && (
              <View style={s.earnPill}>
                <Text style={s.earnTxt}>+{earned}s screentime</Text>
              </View>
            )}
          </View>

          {/* Anti-cheat warning */}
          {display.isInvalidated && (
            <View style={[s.bubble, s.bubbleWarn]} pointerEvents="none">
              <Text style={s.bubbleWarnTxt}>⚠️  Too fast or insufficient range of motion</Text>
            </View>
          )}

          {/* Positioning hint when signal is poor */}
          {conf < 0.28 && !display.isInvalidated && (
            <View style={s.bubble} pointerEvents="none">
              <Text style={s.bubbleTxt}>📷  {cfg.hint}</Text>
            </View>
          )}

          {/* Done button */}
          <View style={[s.btmBar, { paddingBottom: insets.bottom + 10 }]}>
            <TouchableOpacity style={s.doneBtn} onPress={finish}>
              <Text style={s.doneTxt}>Done</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ═══ RESULTS ══════════════════════════════════════════════════════════ */}
      {screen === 'results' && (
        <LinearGradient
          colors={['#06060F', '#0E0B1F', '#06060F']}
          style={[s.results, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]}
        >
          <Text style={s.emoji}>{cfg.emoji}</Text>
          <Text style={s.h1}>{cfg.label}</Text>
          <Text style={s.resultsSub}>Workout Results</Text>

          <View style={s.card}>
            <View style={s.cardAccent} />
            <Text style={s.bigNum}>{display.repCount}</Text>
            <Text style={s.cardLbl}>
              {display.repCount === 1 ? 'verified rep' : 'verified reps'}
            </Text>
            {display.repCount > 0 && (
              <View style={s.cardEarnPill}>
                <Text style={s.cardEarnTxt}>= +{earned}s screentime</Text>
              </View>
            )}
          </View>

          {display.repCount === 0 && (
            <Text style={s.zeroHint}>
              No reps were recorded.{'\n'}
              Make sure the camera can see your full body and try again.
            </Text>
          )}

          <View style={s.actions}>
            {display.repCount > 0 && (
              <TouchableOpacity
                style={[s.saveBtn, syncing && { opacity: 0.5 }]}
                onPress={submit}
                disabled={syncing}
              >
                {syncing
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <Text style={s.saveTxt}>Save  +{earned}s  ✓</Text>
                }
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.discardBtn} onPress={() => router.back()}>
              <Text style={s.discardTxt}>
                {display.repCount === 0 ? 'Go Back' : 'Discard'}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const VIOLET = '#8B5CF6';
const GREEN  = '#22C55E';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  // Hidden GL context view — 1×1, off-screen, zero visual impact
  glView: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 2,
    height: 2,
    opacity: 0,
  },

  // Edge gradients
  gradTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  gradBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 220 },

  // Loading / Permission
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing['2xl'], gap: Spacing.base,
    backgroundColor: '#06060F',
  },
  emoji: { fontSize: 72 },
  h1: {
    fontSize: FontSize['2xl'], fontWeight: FontWeight.heavy,
    color: Colors.text, textAlign: 'center',
  },
  barTrack: {
    width: '75%', height: 5,
    backgroundColor: '#1A1A2E', borderRadius: Radius.full, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: VIOLET, borderRadius: Radius.full },
  body: {
    fontSize: FontSize.sm, color: Colors.textSecondary,
    textAlign: 'center', lineHeight: 20,
  },
  muted: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  btn: {
    backgroundColor: VIOLET, borderRadius: Radius.xl,
    paddingHorizontal: Spacing['2xl'], paddingVertical: Spacing.md, marginTop: Spacing.sm,
  },
  btnText: { color: '#FFF', fontSize: FontSize.base, fontWeight: FontWeight.bold },

  // Countdown
  cdWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center', gap: Spacing.xl,
  },
  cdNum: {
    fontSize: 132, fontWeight: '900', color: '#FFF',
    textShadowColor: VIOLET, textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 36,
  },
  hintBox: {
    backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: Radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: Spacing.xl, paddingVertical: Spacing.base, marginHorizontal: Spacing.xl,
  },
  hintText: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 20 },

  // Top bar
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.sm,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeTxt: { color: '#FFF', fontSize: 16, fontWeight: FontWeight.bold },
  topTitle: {
    fontSize: FontSize.lg, fontWeight: FontWeight.bold, color: '#FFF', letterSpacing: 0.4,
    textShadowColor: 'rgba(0,0,0,0.8)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  sigRow: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  sigDot:   { width: 8, height: 8, borderRadius: 4 },
  sigLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold },

  // Phase pill
  pillWrap: {
    position: 'absolute', top: '13%', left: 0, right: 0,
    alignItems: 'center', zIndex: 10,
  },
  pill: { paddingHorizontal: Spacing.lg, paddingVertical: 7, borderRadius: Radius.full, borderWidth: 1 },
  pillTxt: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, letterSpacing: 1.1 },

  // Rep counter
  repBlock: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 10 },
  repNum: {
    fontSize: 96, fontWeight: '900', color: '#FFF', lineHeight: 100,
    textShadowColor: 'rgba(0,0,0,0.9)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  repLbl: {
    fontSize: FontSize.base, color: 'rgba(255,255,255,0.6)',
    fontWeight: FontWeight.medium, marginTop: -4, letterSpacing: 0.5,
  },
  earnPill: {
    marginTop: Spacing.xs, backgroundColor: GREEN + '25',
    borderRadius: Radius.full, borderWidth: 1, borderColor: GREEN + '55',
    paddingHorizontal: Spacing.base, paddingVertical: 4,
  },
  earnTxt: { fontSize: FontSize.sm, color: GREEN, fontWeight: FontWeight.semibold },

  // Feedback bubbles
  bubble: {
    position: 'absolute', bottom: '20%', left: Spacing.xl, right: Spacing.xl, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: Radius.xl, padding: Spacing.base,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  bubbleWarn: { backgroundColor: 'rgba(251,146,60,0.15)', borderColor: 'rgba(251,146,60,0.4)' },
  bubbleTxt:     { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  bubbleWarnTxt: {
    fontSize: FontSize.sm, color: '#FB923C', fontWeight: FontWeight.medium, textAlign: 'center',
  },

  // Bottom bar
  btmBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
    paddingHorizontal: Spacing.xl,
  },
  doneBtn: {
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: Radius.xl, paddingVertical: 16,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
  },
  doneTxt: { color: '#FFF', fontSize: FontSize.base, fontWeight: FontWeight.semibold, letterSpacing: 0.5 },

  // Results
  results: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: Spacing.xl, gap: Spacing.base,
  },
  resultsSub: {
    fontSize: FontSize.xs, color: 'rgba(255,255,255,0.35)',
    letterSpacing: 2, textTransform: 'uppercase' as const, marginTop: -4,
  },
  card: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 24, paddingVertical: Spacing['3xl'], paddingHorizontal: Spacing.xl,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    marginVertical: Spacing.sm, gap: Spacing.xs, overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute', top: 0, left: '15%', right: '15%', height: 2,
    backgroundColor: VIOLET, borderRadius: 1,
  },
  bigNum: {
    fontSize: 88, fontWeight: '900', color: '#FFF', lineHeight: 92,
    textShadowColor: VIOLET + '88', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 18,
  },
  cardLbl: { fontSize: FontSize.lg, color: 'rgba(255,255,255,0.5)', fontWeight: FontWeight.medium },
  cardEarnPill: {
    marginTop: Spacing.sm, backgroundColor: GREEN + '20',
    borderRadius: Radius.full, borderWidth: 1, borderColor: GREEN + '40',
    paddingHorizontal: Spacing.lg, paddingVertical: 6,
  },
  cardEarnTxt: { fontSize: FontSize.base, color: GREEN, fontWeight: FontWeight.bold },
  zeroHint: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 20 },
  actions: { width: '100%', gap: Spacing.sm, marginTop: Spacing.sm },
  saveBtn: { backgroundColor: VIOLET, borderRadius: Radius.xl, paddingVertical: 18, alignItems: 'center' },
  saveTxt: { color: '#FFF', fontSize: FontSize.lg, fontWeight: FontWeight.bold, letterSpacing: 0.5 },
  discardBtn: { paddingVertical: Spacing.base, alignItems: 'center' },
  discardTxt: { color: 'rgba(255,255,255,0.3)', fontSize: FontSize.base },
});
