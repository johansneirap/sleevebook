"use server";

import {
  currencySchema,
  type ListingStatus,
  listingStatusSchema,
  sellerContactSchema,
} from "@sleevebook/binder-core";
import { binder, DEV_USER_ID, pocketListing } from "@sleevebook/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { parsePriceInput } from "../components/seller/listing-model";
import type { SettingsState } from "../components/seller/settings-state";
import { getBinderWithLayout } from "./binders";
import { db } from "./db";
import { getShareLinkForBinder } from "./share";

const binderIdSchema = z.uuid();

const CONTACT_MESSAGES: Record<"whatsapp" | "instagram" | "email", string> = {
  whatsapp: "Usa 8 a 15 dígitos con código de país, sin + ni espacios. Ej: 56912345678.",
  instagram: "Usuario de Instagram: letras, números, puntos y guiones bajos (máx. 30).",
  email: "Correo no válido.",
};

async function revalidateSellerPaths(binderId: string): Promise<void> {
  revalidatePath(`/binders/${binderId}/vender`);
  revalidatePath(`/binders/${binderId}`);
  const share = await getShareLinkForBinder(binderId);
  if (share) {
    revalidatePath(`/s/${share.slug}`);
  }
}

/** Saves mode, display currency and contact channels of a binder. */
export async function saveSellerSettings(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const binderId = String(formData.get("binderId") ?? "");
  if (!binderIdSchema.safeParse(binderId).success) {
    return { status: "error", message: "No encontramos este binder.", errors: {} };
  }

  const errors: SettingsState["errors"] = {};

  const modeParsed = z.enum(["collection", "seller"]).safeParse(formData.get("mode"));
  if (!modeParsed.success) {
    errors.mode = "Elige un modo.";
  }
  const currencyParsed = currencySchema.safeParse(formData.get("currency"));
  if (!currencyParsed.success) {
    errors.currency = "Elige una moneda.";
  }

  const whatsappRaw = String(formData.get("whatsapp") ?? "").replace(/[\s+\-()]/g, "");
  const instagramRaw = String(formData.get("instagram") ?? "")
    .trim()
    .replace(/^@/, "");
  const emailRaw = String(formData.get("email") ?? "").trim();

  const contactInput = {
    whatsapp: whatsappRaw === "" ? undefined : whatsappRaw,
    instagram: instagramRaw === "" ? undefined : instagramRaw,
    email: emailRaw === "" ? undefined : emailRaw,
  };
  const contactParsed = sellerContactSchema.safeParse(contactInput);
  if (!contactParsed.success) {
    for (const issue of contactParsed.error.issues) {
      const field = issue.path[0];
      if (field === "whatsapp" || field === "instagram" || field === "email") {
        errors[field] = CONTACT_MESSAGES[field];
      }
    }
  }

  if (!modeParsed.success || !currencyParsed.success || !contactParsed.success) {
    return { status: "error", message: "Revisa los campos marcados.", errors };
  }

  await db
    .update(binder)
    .set({
      mode: modeParsed.data,
      currency: currencyParsed.data,
      sellerContact: contactParsed.data,
    })
    .where(and(eq(binder.id, binderId), eq(binder.userId, DEV_USER_ID)));

  await revalidateSellerPaths(binderId);
  return { status: "saved", message: "Configuración guardada.", errors: {} };
}

export interface ListingChange {
  pocketCode: string;
  status: ListingStatus;
  /** Raw price text in the binder currency; empty = no asking price. */
  price: string;
}

export interface ListingsSaveResult {
  ok: boolean;
  message: string;
  /** Per-pocket problems, keyed by pocket code. */
  errors: Record<string, string>;
}

const listingChangeSchema = z.object({
  pocketCode: z.string().max(32),
  status: listingStatusSchema,
  price: z.string().max(32),
});

/**
 * Upserts listing rows for the given card pockets (onConflictDoUpdate on
 * binderId + pocketCode). A pocket back to "disponible" without price is
 * deleted: that is the default state anyway.
 */
export async function saveListings(
  binderId: string,
  changes: ListingChange[],
): Promise<ListingsSaveResult> {
  if (!binderIdSchema.safeParse(binderId).success) {
    return { ok: false, message: "No encontramos este binder.", errors: {} };
  }
  const parsedChanges = z.array(listingChangeSchema).max(5000).safeParse(changes);
  if (!parsedChanges.success) {
    return { ok: false, message: "Los cambios no son válidos.", errors: {} };
  }

  const [owned] = await db
    .select({ currency: binder.currency })
    .from(binder)
    .where(and(eq(binder.id, binderId), eq(binder.userId, DEV_USER_ID)));
  if (!owned) {
    return { ok: false, message: "No encontramos este binder.", errors: {} };
  }
  const currency = currencySchema.catch("usd").parse(owned.currency);

  const data = await getBinderWithLayout(binderId);
  if (!data) {
    return { ok: false, message: "No encontramos este binder.", errors: {} };
  }
  const cardCodes = new Set(
    Object.entries(data.layout.pockets)
      .filter(([, content]) => content.kind === "card")
      .map(([code]) => code),
  );

  const errors: Record<string, string> = {};
  const writes: Array<{ pocketCode: string; status: ListingStatus; price: number | null }> = [];

  for (const change of parsedChanges.data) {
    const code = change.pocketCode;
    if (!cardCodes.has(code)) {
      errors[code] = "Esta casilla no es una carta.";
      continue;
    }
    const price = parsePriceInput(change.price);
    if (!price.ok) {
      errors[code] = price.error;
      continue;
    }
    writes.push({ pocketCode: code, status: change.status, price: price.value });
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Revisa los precios marcados. No se guardó nada.", errors };
  }

  await db.transaction(async (tx) => {
    for (const write of writes) {
      const isDefault = write.status === "disponible" && write.price === null;
      if (isDefault) {
        await tx
          .delete(pocketListing)
          .where(
            and(
              eq(pocketListing.binderId, binderId),
              eq(pocketListing.pocketCode, write.pocketCode),
            ),
          );
        continue;
      }
      const price = write.price === null ? null : write.price.toFixed(2);
      await tx
        .insert(pocketListing)
        .values({
          binderId,
          pocketCode: write.pocketCode,
          status: write.status,
          price,
          currency,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [pocketListing.binderId, pocketListing.pocketCode],
          set: {
            status: write.status,
            price,
            currency,
            updatedAt: new Date(),
          },
        });
    }
  });

  await revalidateSellerPaths(binderId);
  return {
    ok: true,
    message: `${writes.length} ${writes.length === 1 ? "cambio guardado" : "cambios guardados"}.`,
    errors: {},
  };
}
