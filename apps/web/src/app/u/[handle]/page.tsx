import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ProfileHeader,
  PublicBinders,
  PublicWishlist,
} from "../../../components/profile/public-sections";
import { SiteNav } from "../../../components/site/site-nav";
import "../../../components/library/catalog.css";
import { getGoalProgress } from "../../../lib/goals";
import {
  getPublicBinderRows,
  getPublicProfileByHandle,
  getPublicWishlist,
} from "../../../lib/profile";

interface PageProps {
  params: Promise<{ handle: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { handle } = await params;
  const data = await getPublicProfileByHandle(handle);
  if (!data) {
    return { title: "Perfil no disponible — Sleevebook", robots: { index: false, follow: false } };
  }
  return { title: `${data.user.name} (@${data.user.handle}) — Sleevebook` };
}

export default async function PublicProfilePage({ params }: PageProps) {
  const { handle } = await params;
  const data = await getPublicProfileByHandle(handle);
  if (!data) {
    notFound();
  }
  const { user: owner, profile: saved } = data;

  const binderRows = await getPublicBinderRows(owner.id);
  const binders = await Promise.all(
    binderRows.map(async (row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      progress: row.goalId ? await getGoalProgress(row.id) : null,
    })),
  );
  const wishlist = saved.wishlistPublic ? await getPublicWishlist(owner.id) : null;

  return (
    <>
      <SiteNav />
      <main className="sb-catalog-page">
        <ProfileHeader
          name={owner.name}
          handle={owner.handle}
          image={owner.image}
          bio={saved.bio}
          contact={saved.contact}
        />
        <PublicBinders binders={binders} />
        {wishlist && <PublicWishlist items={wishlist} />}
      </main>
    </>
  );
}
