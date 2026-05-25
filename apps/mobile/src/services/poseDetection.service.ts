// IMPORTANT: import react-native backend FIRST — registers the RN execution backend
import '@tensorflow/tfjs-react-native';
// Use tfjs-core directly (avoids the Node.js-only tf.node.js entrypoint in @tensorflow/tfjs)
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-cpu';  // fallback CPU backend
import * as poseDetection from '@tensorflow-models/pose-detection';
import { decodeJpeg } from '@tensorflow/tfjs-react-native';

let detector: poseDetection.PoseDetector | null = null;
let initPromise: Promise<poseDetection.PoseDetector> | null = null;

export async function initPoseDetector(
  onProgress?: (p: number) => void,
): Promise<poseDetection.PoseDetector> {
  if (detector) return detector;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    onProgress?.(0.05);
    await tf.ready();
    onProgress?.(0.40);

    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        enableSmoothing: true,
      },
    );
    onProgress?.(1.0);
    return detector;
  })();

  return initPromise;
}

/** Decode a JPEG Uint8Array, run MoveNet, return the first pose or null. */
export async function detectPoseFromJpeg(
  jpegBytes: Uint8Array,
): Promise<poseDetection.Pose | null> {
  if (!detector) return null;
  let imageTensor: tf.Tensor3D | null = null;
  try {
    imageTensor = decodeJpeg(jpegBytes, 3);
    const poses = await detector.estimatePoses(imageTensor, {
      maxPoses: 1,
      flipHorizontal: false,
    });
    return poses[0] ?? null;
  } catch {
    return null;
  } finally {
    if (imageTensor) tf.dispose(imageTensor);
  }
}

/** Run MoveNet inference on a pre-built tensor.
 *  Caller is responsible for disposing the tensor after this resolves. */
export async function detectPoseFromTensor(
  tensor: tf.Tensor3D,
): Promise<poseDetection.Pose | null> {
  if (!detector) return null;
  try {
    const poses = await detector.estimatePoses(tensor, {
      maxPoses: 1,
      flipHorizontal: false,
    });
    return poses[0] ?? null;
  } catch {
    return null;
  }
}

export function isPoseDetectorReady(): boolean {
  return detector !== null;
}

export function disposePoseDetector(): void {
  detector?.dispose();
  detector = null;
  initPromise = null;
}
