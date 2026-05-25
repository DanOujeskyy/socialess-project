const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Stub optional peer deps that are eagerly imported by @tensorflow packages
// but not needed for our MoveNet-on-React-Native use case:
//   react-native-fs              — bundleResourceIO (we load models from CDN)
//   @mediapipe/pose              — BlazePose MediaPipe backend (we use MoveNet only)
//   @tensorflow/tfjs-backend-webgpu — WebGPU backend (not available on React Native)
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  'react-native-fs':                path.resolve(__dirname, 'src/mocks/react-native-fs-stub.js'),
  '@mediapipe/pose':                path.resolve(__dirname, 'src/mocks/mediapipe-pose-stub.js'),
  '@tensorflow/tfjs-backend-webgpu':path.resolve(__dirname, 'src/mocks/tfjs-backend-webgpu-stub.js'),
};

module.exports = config;
