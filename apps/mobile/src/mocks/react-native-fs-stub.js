// Stub for react-native-fs — required by @tensorflow/tfjs-react-native's bundleResourceIO
// but not used in this app (we load models from CDN, not local bundle resources).
module.exports = {
  readFile: () => Promise.reject(new Error('react-native-fs not available')),
  writeFile: () => Promise.reject(new Error('react-native-fs not available')),
  exists: () => Promise.resolve(false),
  mkdir: () => Promise.resolve(),
  DocumentDirectoryPath: '',
  CachesDirectoryPath: '',
};
