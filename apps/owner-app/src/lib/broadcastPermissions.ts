import * as ImagePicker from "expo-image-picker";
import { Alert, Linking, PermissionsAndroid, Platform } from "react-native";

export type BroadcastPermissionResult =
  | { granted: true }
  | { granted: false; message: string };

export async function hasBroadcastPermissions(): Promise<boolean> {
  if (Platform.OS === "android") {
    const [camera, mic] = await Promise.all([
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA),
      PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO),
    ]);
    return camera && mic;
  }

  const camera = await ImagePicker.getCameraPermissionsAsync();
  return camera.granted;
}

export async function requestBroadcastPermissions(): Promise<BroadcastPermissionResult> {
  if (Platform.OS === "android") {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.CAMERA,
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    ]);
    const camera =
      results[PermissionsAndroid.PERMISSIONS.CAMERA] ===
      PermissionsAndroid.RESULTS.GRANTED;
    const mic =
      results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ===
      PermissionsAndroid.RESULTS.GRANTED;
    if (!camera && !mic) {
      return {
        granted: false,
        message: "Camera and microphone access are required to go live.",
      };
    }
    if (!camera) {
      return { granted: false, message: "Camera access is required to go live." };
    }
    if (!mic) {
      return {
        granted: false,
        message: "Microphone access is required to include audio in the broadcast.",
      };
    }
    return { granted: true };
  }

  const camera = await ImagePicker.requestCameraPermissionsAsync();
  if (!camera.granted) {
    return {
      granted: false,
      message: "Camera access is required to go live.",
    };
  }

  // iOS microphone is requested by the IVS broadcast SDK when streaming starts.
  return { granted: true };
}

export function promptOpenSettings(
  message: string,
  labels?: { title?: string; notNow?: string; openSettings?: string },
): void {
  Alert.alert(labels?.title ?? "Permission required", message, [
    { text: labels?.notNow ?? "Not now", style: "cancel" },
    {
      text: labels?.openSettings ?? "Open settings",
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}
