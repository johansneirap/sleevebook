import {
  type Currency,
  currencySchema,
  type SellerContact,
  sellerContactSchema,
} from "@sleevebook/binder-core";
import {
  binder,
  card,
  cardVariant,
  profile,
  set,
  shareLink,
  user,
  wishlistItem,
} from "@sleevebook/db";
import { and, desc, eq } from "drizzle-orm";
import { db } from "./db";

/** Public-facing settings of one user. A missing profile row means these defaults. */
export interface Profile {
  bio: string;
  contact: SellerContact;
  isPublic: boolean;
  wishlistPublic: boolean;
  tradesOptIn: boolean;
}

export const DEFAULT_PROFILE: Profile = {
  bio: "",
  contact: {},
  isPublic: true,
  wishlistPublic: true,
  tradesOptIn: true,
};

export async function getProfile(userId: string): Promise<Profile> {
  const [row] = await db.select().from(profile).where(eq(profile.userId, userId));
  if (!row) {
    return { ...DEFAULT_PROFILE, contact: {} };
  }
  return {
    bio: row.bio ?? "",
    contact: sellerContactSchema.catch({}).parse(row.contact ?? {}),
    isPublic: row.isPublic,
    wishlistPublic: row.wishlistPublic,
    tradesOptIn: row.tradesOptIn,
  };
}

/** The account fields plus the profile, read straight from the DB (not the session). */
export interface AccountSettings {
  id: string;
  name: string;
  handle: string;
  image: string | null;
  preferredCurrency: Currency;
  profile: Profile;
}

export async function getAccountSettings(userId: string): Promise<AccountSettings | null> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      handle: user.handle,
      image: user.image,
      preferredCurrency: user.preferredCurrency,
    })
    .from(user)
    .where(eq(user.id, userId));
  if (!row) {
    return null;
  }
  return {
    ...row,
    preferredCurrency: currencySchema.catch("usd").parse(row.preferredCurrency),
    profile: await getProfile(userId),
  };
}

export interface PublicProfile {
  user: { id: string; name: string; handle: string; image: string | null };
  profile: Profile;
}

/** The public page of `handle`, or null when the user doesn't exist or the profile is private. */
export async function getPublicProfileByHandle(handle: string): Promise<PublicProfile | null> {
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      handle: user.handle,
      image: user.image,
      bio: profile.bio,
      contact: profile.contact,
      isPublic: profile.isPublic,
      wishlistPublic: profile.wishlistPublic,
      tradesOptIn: profile.tradesOptIn,
    })
    .from(user)
    .leftJoin(profile, eq(profile.userId, user.id))
    .where(eq(user.handle, handle));
  if (!row) {
    return null;
  }
  const publicProfile: Profile = {
    bio: row.bio ?? "",
    contact: sellerContactSchema.catch({}).parse(row.contact ?? {}),
    isPublic: row.isPublic ?? DEFAULT_PROFILE.isPublic,
    wishlistPublic: row.wishlistPublic ?? DEFAULT_PROFILE.wishlistPublic,
    tradesOptIn: row.tradesOptIn ?? DEFAULT_PROFILE.tradesOptIn,
  };
  if (!publicProfile.isPublic) {
    return null;
  }
  return {
    user: { id: row.id, name: row.name, handle: row.handle, image: row.image },
    profile: publicProfile,
  };
}

export interface PublicWishlistItem {
  id: string;
  name: string;
  number: string;
  setName: string;
  variant: string;
  imageUrl: string | null;
}

/** Wishlist entries shown on a public profile (the caller checks wishlistPublic). */
export async function getPublicWishlist(userId: string, limit = 60): Promise<PublicWishlistItem[]> {
  const rows = await db
    .select({
      id: wishlistItem.id,
      name: card.name,
      number: card.number,
      setName: set.name,
      variant: cardVariant.variant,
      images: cardVariant.images,
    })
    .from(wishlistItem)
    .innerJoin(cardVariant, eq(cardVariant.id, wishlistItem.variantId))
    .innerJoin(card, eq(card.id, cardVariant.cardId))
    .innerJoin(set, eq(set.id, card.setId))
    .where(eq(wishlistItem.userId, userId))
    .orderBy(desc(wishlistItem.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    number: row.number,
    setName: row.setName,
    variant: row.variant,
    imageUrl: extractThumbUrl(row.images),
  }));
}

interface StoredImages {
  "pokemontcg.io"?: { small?: string; large?: string };
  r2?: { thumbnail: string; medium: string; high: string };
}

/** Thumbnail first: the wishlist grid is small. */
function extractThumbUrl(images: unknown): string | null {
  const stored = images as StoredImages | null;
  return stored?.r2?.thumbnail ?? stored?.["pokemontcg.io"]?.small ?? stored?.r2?.medium ?? null;
}

export interface PublicBinderRow {
  id: string;
  name: string;
  slug: string;
  goalId: string | null;
}

/** Binders shown on a public profile: published AND shared with visibility "public". */
export async function getPublicBinderRows(userId: string): Promise<PublicBinderRow[]> {
  return db
    .select({
      id: binder.id,
      name: binder.name,
      slug: shareLink.slug,
      goalId: binder.goalId,
    })
    .from(binder)
    .innerJoin(shareLink, eq(shareLink.binderId, binder.id))
    .where(
      and(
        eq(binder.userId, userId),
        eq(binder.status, "published"),
        eq(shareLink.visibility, "public"),
      ),
    )
    .orderBy(desc(binder.createdAt));
}
