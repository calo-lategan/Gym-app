// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// 3D models ship as binary glTF assets.
config.resolver.assetExts.push('glb');

module.exports = config;
