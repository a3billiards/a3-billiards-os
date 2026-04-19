// Metro config for pnpm monorepo (Expo SDK 55+)
// - watchFolders: monorepo root so Metro picks up symlinked packages
// - nodeModulesPaths: app + monorepo root for hoisted/non-hoisted deps
// - disableHierarchicalLookup: pnpm doesn't put deps in parent node_modules
// - unstable_enableSymlinks: required for pnpm's symlinked store
// - extraNodeModules singletons: prevent duplicate React/Expo copies

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

config.resolver.disableHierarchicalLookup = true;
config.resolver.unstable_enableSymlinks = true;
config.resolver.unstable_enablePackageExports = true;

const singletons = [
  "react",
  "react-dom",
  "react-native",
  "expo",
  "expo-router",
  "expo-modules-core",
  "expo-constants",
  "@expo/metro-runtime",
];
config.resolver.extraNodeModules = singletons.reduce((acc, name) => {
  acc[name] = path.resolve(projectRoot, "node_modules", name);
  return acc;
}, {});

module.exports = config;
