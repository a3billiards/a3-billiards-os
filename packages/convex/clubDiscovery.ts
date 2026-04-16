import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { requireCustomer, requireViewer } from "./model/viewer";
import { haversineKm } from "@a3/utils/geo";

function capitalizeTableType(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("-");
}

export const searchClubs = query({
  args: {
    searchText: v.optional(v.string()),
    userLat: v.optional(v.number()),
    userLng: v.optional(v.number()),
    radiusKm: v.optional(v.number()),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireCustomer(await requireViewer(ctx));
    const radius = args.radiusKm ?? 50;
    const rawLimit = args.limit ?? 20;
    const cursor = args.cursor ?? 0;
    const trimmed = args.searchText?.trim();
    const hasSearch = Boolean(trimmed && trimmed.length > 0);
    const hasGps =
      args.userLat !== undefined &&
      args.userLng !== undefined &&
      Number.isFinite(args.userLat) &&
      Number.isFinite(args.userLng);

    const active = await ctx.db
      .query("clubs")
      .withIndex("by_subscriptionStatus", (q) => q.eq("subscriptionStatus", "active"))
      .collect();
    const grace = await ctx.db
      .query("clubs")
      .withIndex("by_subscriptionStatus", (q) => q.eq("subscriptionStatus", "grace"))
      .collect();

    // TODO: migrate to Algolia/Typesense geospatial index when club count exceeds ~5,000.
    let candidates: Doc<"clubs">[] = [...active, ...grace].filter((c) => c.isDiscoverable);

    if (hasSearch) {
      const q = trimmed!.toLowerCase();
      candidates = candidates.filter((c) => c.name.toLowerCase().includes(q));
    }

    if (hasGps) {
      candidates = candidates.filter((c) => {
        if (!c.location) return false;
        const d = haversineKm(args.userLat!, args.userLng!, c.location.lat, c.location.lng);
        return d <= radius;
      });
    }

    type Row = { club: Doc<"clubs">; distanceKm: number | null };
    const withDist: Row[] = candidates.map((club) => {
      let distanceKm: number | null = null;
      if (hasGps && club.location) {
        distanceKm = haversineKm(
          args.userLat!,
          args.userLng!,
          club.location.lat,
          club.location.lng,
        );
      }
      return { club, distanceKm };
    });

    if (hasGps) {
      withDist.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    } else {
      withDist.sort((a, b) => a.club.name.localeCompare(b.club.name));
    }

    const page = withDist.slice(cursor, cursor + rawLimit);

    return Promise.all(
      page.map(async ({ club, distanceKm }) => {
        const tables = await ctx.db
          .query("tables")
          .withIndex("by_club", (q) => q.eq("clubId", club._id))
          .collect();
        const typeSet = new Set<string>();
        for (const t of tables) {
          if (t.isActive && t.tableType) {
            typeSet.add(capitalizeTableType(t.tableType));
          }
        }
        const tableTypes = [...typeSet].sort((a, b) => a.localeCompare(b));
        const firstPhoto = club.photos?.[0];
        const thumbnailUrl = firstPhoto
          ? await ctx.storage.getUrl(firstPhoto as Id<"_storage">)
          : null;
        return {
          clubId: club._id,
          name: club.name,
          address: club.address,
          distanceKm: hasGps ? distanceKm : null,
          thumbnailUrl,
          tableTypes,
          operatingHours: club.operatingHours ?? null,
          bookingEnabled: club.bookingSettings.enabled,
        };
      }),
    );
  },
});

export const getClubProfile = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    requireCustomer(await requireViewer(ctx));
    const club = await ctx.db.get(clubId);
    if (!club || club.subscriptionStatus === "frozen" || !club.isDiscoverable) {
      return null;
    }

    const tables = await ctx.db
      .query("tables")
      .withIndex("by_club", (q) => q.eq("clubId", club._id))
      .collect();
    const counts = new Map<string, number>();
    for (const t of tables) {
      if (!t.isActive || !t.tableType) continue;
      const key = t.tableType.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const tableTypes = [...counts.entries()]
      .map(([type, count]) => ({ type: capitalizeTableType(type), count }))
      .sort((a, b) => a.type.localeCompare(b.type));

    const photoUrls: string[] = [];
    for (const id of club.photos ?? []) {
      const url = await ctx.storage.getUrl(id as Id<"_storage">);
      if (url) photoUrls.push(url);
    }

    return {
      clubId: club._id,
      name: club.name,
      address: club.address,
      description: club.description ?? null,
      photoUrls,
      amenities: club.amenities ?? [],
      operatingHours: club.operatingHours ?? null,
      tableTypes,
      baseRatePerMin: club.baseRatePerMin,
      currency: club.currency,
      specialRates: club.specialRates.map((r) => ({
        id: r.id,
        label: r.label,
        ratePerMin: r.ratePerMin,
        startTime: r.startTime,
        endTime: r.endTime,
        daysOfWeek: r.daysOfWeek,
      })),
      bookingEnabled: club.bookingSettings.enabled,
      timezone: club.timezone,
      location: club.location ?? null,
    };
  },
});

export const getCustomerVisitCountAtClub = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, { clubId }) => {
    const viewer = requireCustomer(await requireViewer(ctx));
    const rows = await ctx.db
      .query("sessionLogs")
      .withIndex("by_customer_club", (q) =>
        q.eq("customerId", viewer.userId).eq("clubId", clubId),
      )
      .collect();
    return { count: rows.length };
  },
});
