export const PREDEFINED_TABLE_TYPES = [
  { id: "american", label: "American Pool" },
  { id: "french", label: "French Billiards" },
  { id: "snooker", label: "Snooker" },
  { id: "8-ball", label: "8-Ball" },
  { id: "9-ball", label: "9-Ball" },
] as const;

export const CUSTOM_TABLE_TYPE_ID = "__custom__";

export function normalizeTableTypeId(value: string): string {
  return value.trim().toLowerCase();
}

export function tableTypeLabel(typeId: string): string {
  const key = normalizeTableTypeId(typeId);
  const preset = PREDEFINED_TABLE_TYPES.find((t) => t.id === key);
  if (preset) return preset.label;
  return key
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function groupTablesByFloor<T extends { floor?: string | null }>(
  items: T[],
): Array<{ floor: string; items: T[] }> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const floor = item.floor?.trim() || "Main floor";
    const list = map.get(floor) ?? [];
    list.push(item);
    map.set(floor, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([floor, floorItems]) => ({ floor, items: floorItems }));
}
