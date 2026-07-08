import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import {
  assertMutationClubScope,
  requireOwner,
  requireOwnerWithClub,
  requireViewer,
} from "./model/viewer";
import { assertClubSubscriptionWritable } from "./model/clubSubscription";
import { assertValidClubPhotoStorage } from "./model/storageUploadValidation";
import {
  isSuspiciousOvernightWindow,
  validateBookableWithinOperating,
} from "@a3/utils/availability";

const operatingHoursValidator = v.object({
  open: v.string(),
  close: v.string(),
  daysOfWeek: v.array(v.number()),
});

function assertHHMM(label: string, s: string): void {
  if (!/^\d{2}:\d{2}$/.test(s)) {
    throw new Error(`DATA_002: ${label} must be HH:MM`);
  }
  const [h, m] = s.split(":").map((x) => Number(x));
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    throw new Error(`DATA_002: ${label} is out of range`);
  }
}

export const getMyClubProfile = query({
  args: {},
  handler: async (ctx) => {
    const owner = requireOwner(await requireViewer(ctx));
    if (owner.clubId === null) {
      return null;
    }
    const club = await ctx.db.get(owner.clubId);
    if (!club) return null;
    const photos = await Promise.all(
      (club.photos ?? []).map(async (storageId) => ({
        storageId,
        url: await ctx.storage.getUrl(storageId as Id<"_storage">),
      })),
    );
    return {
      clubId: club._id,
      name: club.name,
      description: club.description ?? "",
      photos,
      amenities: club.amenities ?? [],
      operatingHours: club.operatingHours ?? null,
      bookingSettings: club.bookingSettings,
      isDiscoverable: club.isDiscoverable,
      location: club.location ?? null,
      subscriptionStatus: club.subscriptionStatus,
      baseRatePerMin: club.baseRatePerMin,
      minBillMinutes: club.minBillMinutes,
      currency: club.currency,
      timezone: club.timezone,
      specialRates: club.specialRates ?? [],
      typeBaseRates: club.typeBaseRates ?? [],
    };
  },
});

export const generateClubPhotoUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const owner = requireOwnerWithClub(await requireViewer(ctx));
    const club = await ctx.db.get(owner.clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateClubDescription = mutation({
  args: {
    clubId: v.id("clubs"),
    description: v.string(),
  },
  handler: async (ctx, { clubId, description }) => {
    const viewer = await requireViewer(ctx);
    assertMutationClubScope(viewer, clubId);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    if (description.length > 500) {
      throw new Error("DATA_002: Description must be 500 characters or less");
    }
    await ctx.db.patch(clubId, { description });
    return { success: true as const };
  },
});

export const toggleDiscoverability = mutation({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const viewer = await requireViewer(ctx);
    assertMutationClubScope(viewer, clubId);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    const next = !club.isDiscoverable;
    await ctx.db.patch(clubId, { isDiscoverable: next });
    return { isDiscoverable: next as boolean };
  },
});

export const uploadClubPhoto = mutation({
  args: {
    clubId: v.id("clubs"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, { clubId, storageId }) => {
    const viewer = await requireViewer(ctx);
    assertMutationClubScope(viewer, clubId);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    const photos = [...(club.photos ?? [])];
    if (photos.length >= 5) {
      throw new Error(
        "Maximum 5 photos allowed. Remove a photo before adding a new one.",
      );
    }
    await assertValidClubPhotoStorage(ctx, storageId);
    photos.push(storageId);
    await ctx.db.patch(clubId, { photos });
    return { success: true as const };
  },
});

export const removeClubPhoto = mutation({
  args: {
    clubId: v.id("clubs"),
    storageId: v.string(),
  },
  handler: async (ctx, { clubId, storageId }) => {
    const viewer = await requireViewer(ctx);
    assertMutationClubScope(viewer, clubId);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    const photos = (club.photos ?? []).filter((id) => id !== storageId);
    await ctx.db.patch(clubId, { photos });
    return { success: true as const };
  },
});

export const updateAmenities = mutation({
  args: {
    clubId: v.id("clubs"),
    amenities: v.array(v.string()),
  },
  handler: async (ctx, { clubId, amenities }) => {
    const viewer = await requireViewer(ctx);
    assertMutationClubScope(viewer, clubId);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);

    const normalized: string[] = [];
    const seen = new Set<string>();
    for (const raw of amenities) {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      if (trimmed.length > 40) {
        throw new Error("DATA_002: Each amenity must be 40 characters or less");
      }
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(trimmed);
    }
    if (normalized.length > 20) {
      throw new Error("DATA_002: Maximum 20 amenities allowed");
    }

    await ctx.db.patch(clubId, { amenities: normalized });
    return { success: true as const };
  },
});

export const updateOperatingHours = mutation({
  args: {
    clubId: v.id("clubs"),
    operatingHours: operatingHoursValidator,
  },
  handler: async (ctx, { clubId, operatingHours }) => {
    const viewer = await requireViewer(ctx);
    assertMutationClubScope(viewer, clubId);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);

    assertHHMM("Open time", operatingHours.open);
    assertHHMM("Close time", operatingHours.close);
    // open == close means "Open 24 hours"; a close only minutes before open is an AM/PM typo.
    if (isSuspiciousOvernightWindow(operatingHours.open, operatingHours.close)) {
      throw new Error(
        "CLUB_004: Close time is only minutes before open time, creating a ~24-hour window. " +
          "For a 24/7 club use \"Open 24 hours\"; otherwise check AM/PM.",
      );
    }
    if (operatingHours.daysOfWeek.length === 0) {
      throw new Error("DATA_002: Select at least one day");
    }
    for (const d of operatingHours.daysOfWeek) {
      if (d < 0 || d > 6 || !Number.isInteger(d)) {
        throw new Error("DATA_002: Invalid day of week");
      }
    }

    const bh = club.bookingSettings.bookableHours;
    if (bh) {
      const result = validateBookableWithinOperating(operatingHours, bh);
      if (!result.ok) {
        throw new Error(`CLUB_004: ${result.message}`);
      }
    }

    await ctx.db.patch(clubId, { operatingHours });
    return { success: true as const };
  },
});

export const updateLocationPin = mutation({
  args: {
    clubId: v.id("clubs"),
    lat: v.number(),
    lng: v.number(),
  },
  handler: async (ctx, { clubId, lat, lng }) => {
    const viewer = await requireViewer(ctx);
    assertMutationClubScope(viewer, clubId);
    const club = await ctx.db.get(clubId);
    if (!club) throw new Error("DATA_003: Club not found");
    assertClubSubscriptionWritable(club);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error("DATA_002: Invalid coordinates");
    }
    await ctx.db.patch(clubId, { location: { lat, lng } });
    return { success: true as const };
  },
});
