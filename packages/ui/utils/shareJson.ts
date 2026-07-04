import { Share, Platform, Alert } from "react-native";

const CSV_SIZE_WARN_BYTES = 2 * 1024 * 1024; // 2 MB — Android Share may silently drop large text

async function loadFileSystem(): Promise<typeof import("expo-file-system/legacy") | null> {
  try {
    return await import("expo-file-system/legacy");
  } catch {
    return null;
  }
}

async function loadSharing(): Promise<typeof import("expo-sharing") | null> {
  try {
    return await import("expo-sharing");
  } catch {
    return null;
  }
}

async function writeCsvToCache(filename: string, csv: string): Promise<string | null> {
  const FileSystem = await loadFileSystem();
  if (!FileSystem) return null;
  const title = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return null;
  const path = `${cacheDir}${title}`;
  await FileSystem.writeAsStringAsync(path, csv, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return path;
}

async function shareFileUri(uri: string): Promise<boolean> {
  const Sharing = await loadSharing();
  if (Sharing && (await Sharing.isAvailableAsync())) {
    await Sharing.shareAsync(uri, {
      mimeType: "text/csv",
      dialogTitle: "Share export",
    });
    return true;
  }
  return false;
}

/**
 * Opens the system share sheet with a spreadsheet (CSV) export.
 * Offers save-to-file (when expo-file-system is available) and share.
 */
export async function shareCsvExport(
  filename: string,
  csv: string,
): Promise<boolean> {
  const title = filename.endsWith(".csv") ? filename : `${filename}.csv`;

  if (Platform.OS === "android" && csv.length > CSV_SIZE_WARN_BYTES) {
    Alert.alert(
      "Export too large",
      "The file is too large to share as text on this device. Please reduce your filter range and try again.",
    );
    return false;
  }

  const fileUri = await writeCsvToCache(title, csv);

  return new Promise((resolve) => {
    const buttons: {
      text: string;
      style?: "cancel" | "default" | "destructive";
      onPress?: () => void;
    }[] = [];

    if (fileUri) {
      buttons.push({
        text: "Save & share file",
        onPress: () => {
          void (async () => {
            try {
              const shared = await shareFileUri(fileUri);
              if (!shared) {
                Alert.alert(
                  "Saved",
                  "Export saved. Install a file manager or spreadsheet app to open it.",
                );
              }
              resolve(shared);
            } catch {
              Alert.alert("Export failed", "Could not share the saved file.");
              resolve(false);
            }
          })();
        },
      });
    }

    buttons.push({
      text: "Share as text",
      onPress: () => {
        void (async () => {
          try {
            const result = await Share.share(
              Platform.select({
                ios: { message: csv, title },
                default: { message: csv, title },
              })!,
            );
            resolve(result.action === Share.sharedAction);
          } catch {
            Alert.alert("Export failed", "Could not open the share sheet.");
            resolve(false);
          }
        })();
      },
    });

    buttons.push({
      text: "Cancel",
      style: "cancel",
      onPress: () => resolve(false),
    });

    Alert.alert("Export ready", "Choose how to save or share your data.", buttons);
  });
}

/** @deprecated Prefer shareCsvExport for user-facing exports. */
export async function shareJsonExport(
  filename: string,
  data: unknown,
): Promise<boolean> {
  const json = JSON.stringify(data, null, 2);
  const title = filename.endsWith(".json") ? filename : `${filename}.json`;
  try {
    const result = await Share.share(
      Platform.select({
        ios: { message: json, title },
        default: { message: json, title },
      })!,
    );
    return result.action === Share.sharedAction;
  } catch {
    Alert.alert("Export failed", "Could not open the share sheet.");
    return false;
  }
}
