// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 3D models ship as binary glTF assets.
config.resolver.assetExts.push('glb');

// On native, `require('three')` (from the CommonJS build of @react-three/fiber)
// resolves to three's deprecated CommonJS entry, which calls Node's
// process.emitWarning as it loads. React Native has no such function, so the
// app crashed on launch. That entry only re-exports the ES module, so resolve
// every import of `three` to the ES module directly.
const threeModule = path.join(path.dirname(require.resolve('three')), 'three.module.js');
const resolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') return { type: 'sourceFile', filePath: threeModule };
  return (resolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = config;
