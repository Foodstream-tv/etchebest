// https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// react-native-webrtc imports `event-target-shim/index`, a subpath that package does not
// list in its "exports". Metro resolves it by file anyway but warns on every start;
// point it at the public entry instead (same module).
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const name = moduleName === 'event-target-shim/index' ? 'event-target-shim' : moduleName;
  return (upstreamResolveRequest ?? context.resolveRequest)(context, name, platform);
};

module.exports = config;
