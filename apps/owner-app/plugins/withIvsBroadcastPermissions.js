const { withInfoPlist, withAndroidManifest } = require("@expo/config-plugins");

const CAMERA_USAGE =
  "A3 Billiards needs camera access to broadcast live games from your club.";
const MIC_USAGE =
  "A3 Billiards needs microphone access to include audio in live broadcasts.";

function withIvsBroadcastPermissions(config) {
  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.NSCameraUsageDescription =
      cfg.modResults.NSCameraUsageDescription ?? CAMERA_USAGE;
    cfg.modResults.NSMicrophoneUsageDescription =
      cfg.modResults.NSMicrophoneUsageDescription ?? MIC_USAGE;
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }
    const perms = manifest["uses-permission"];
    const names = new Set(
      perms.map((p) => p.$?.["android:name"]).filter(Boolean),
    );
    for (const perm of [
      "android.permission.CAMERA",
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
    ]) {
      if (!names.has(perm)) {
        perms.push({ $: { "android:name": perm } });
      }
    }
    return cfg;
  });

  return config;
}

module.exports = withIvsBroadcastPermissions;
