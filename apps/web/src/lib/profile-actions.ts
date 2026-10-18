"use server";

import { currencySchema, sellerContactSchema } from "@sleevebook/binder-core";
import { profile, user } from "@sleevebook/db";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { AccountField, AccountState } from "../components/profile/account-state";
import { db } from "./db";
import { assertUser } from "./session";

const HANDLE_PATTERN = /^[a-z0-9-]{3,24}$/;
const TAKEN_MESSAGE = "Ese nombre de usuario ya está tomado";

const MESSAGES: Record<AccountField, string> = {
  name: "Escribe un nombre de 1 a 60 caracteres.",
  handle: "Usa de 3 a 24 letras minúsculas, números o guiones.",
  bio: "La bio no puede superar los 280 caracteres.",
  whatsapp: "Usa 8 a 15 dígitos con código de país, sin + ni espacios. Ej: 56912345678.",
  instagram: "Usuario de Instagram: letras, números, puntos y guiones bajos (máx. 30).",
  email: "Correo no válido.",
  preferredCurrency: "Elige una moneda.",
};

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === "23505";
}

/** Saves the account (name, handle, currency), the profile (bio, contact, privacy) of the signed-in user. */
export async function saveAccount(
  _previous: AccountState,
  formData: FormData,
): Promise<AccountState> {
  const owner = await assertUser();
  const errors: AccountState["errors"] = {};

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 1 || name.length > 60) {
    errors.name = MESSAGES.name;
  }

  const handle = String(formData.get("handle") ?? "")
    .trim()
    .toLowerCase();
  if (!HANDLE_PATTERN.test(handle)) {
    errors.handle = MESSAGES.handle;
  }

  const bio = String(formData.get("bio") ?? "").trim();
  if (bio.length > 280) {
    errors.bio = MESSAGES.bio;
  }

  const whatsappRaw = String(formData.get("whatsapp") ?? "").replace(/[\s+\-()]/g, "");
  const instagramRaw = String(formData.get("instagram") ?? "")
    .trim()
    .replace(/^@/, "");
  const emailRaw = String(formData.get("email") ?? "").trim();
  const contactParsed = sellerContactSchema.safeParse({
    whatsapp: whatsappRaw === "" ? undefined : whatsappRaw,
    instagram: instagramRaw === "" ? undefined : instagramRaw,
    email: emailRaw === "" ? undefined : emailRaw,
  });
  if (!contactParsed.success) {
    for (const issue of contactParsed.error.issues) {
      const field = issue.path[0];
      if (field === "whatsapp" || field === "instagram" || field === "email") {
        errors[field] = MESSAGES[field];
      }
    }
  }

  const currencyParsed = currencySchema.safeParse(formData.get("preferredCurrency"));
  if (!currencyParsed.success) {
    errors.preferredCurrency = MESSAGES.preferredCurrency;
  }

  if (Object.keys(errors).length > 0) {
    return { status: "error", message: "Revisa los campos marcados.", errors };
  }

  const [current] = await db
    .select({ handle: user.handle })
    .from(user)
    .where(eq(user.id, owner.id));
  const previousHandle = current?.handle ?? owner.handle;

  const [taken] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.handle, handle), ne(user.id, owner.id)));
  if (taken) {
    return { status: "error", errors: { handle: TAKEN_MESSAGE } };
  }

  const toggles = {
    isPublic: formData.get("isPublic") === "on",
    wishlistPublic: formData.get("wishlistPublic") === "on",
    tradesOptIn: formData.get("tradesOptIn") === "on",
  };
  const contact = contactParsed.success ? contactParsed.data : {};
  const updatedAt = new Date();

  try {
    await db.transaction(async (tx) => {
      await tx
        .insert(profile)
        .values({ userId: owner.id, bio, contact, ...toggles, updatedAt })
        .onConflictDoUpdate({
          target: profile.userId,
          set: { bio, contact, ...toggles, updatedAt },
        });
      await tx
        .update(user)
        .set({
          name,
          handle,
          preferredCurrency: currencyParsed.data ?? "usd",
          updatedAt,
        })
        .where(eq(user.id, owner.id));
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { status: "error", errors: { handle: TAKEN_MESSAGE } };
    }
    throw error;
  }

  revalidatePath("/cuenta");
  revalidatePath(`/u/${previousHandle}`);
  if (handle !== previousHandle) {
    revalidatePath(`/u/${handle}`);
  }
  return { status: "saved", message: "Cambios guardados.", errors: {} };
}
