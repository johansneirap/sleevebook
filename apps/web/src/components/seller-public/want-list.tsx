"use client";

import type { Currency, SellerContact } from "@sleevebook/binder-core";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { WantCatalogEntry } from "./types";
import type { WantListItem } from "./want-list-text";

const STORAGE_PREFIX = "sleevebook:lista:";

function readStoredCodes(slug: string): string[] {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${slug}`);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    // Storage blocked or corrupt: the list simply starts empty.
    return [];
  }
}

function writeStoredCodes(slug: string, codes: string[]): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${slug}`, JSON.stringify(codes));
  } catch {
    // Storage blocked: the list still works for this visit.
  }
}

export interface WantListValue {
  slug: string;
  binderName: string;
  currency: Currency;
  contact: SellerContact;
  /** Absolute URL of the public page once mounted, relative before that. */
  url: string;
  items: WantListItem[];
  has: (code: string) => boolean;
  toggle: (code: string) => void;
  remove: (code: string) => void;
}

const WantListContext = createContext<WantListValue | null>(null);

/** The buyer's list, or null outside seller mode. */
export function useWantList(): WantListValue | null {
  return useContext(WantListContext);
}

export function hasContact(contact: SellerContact): boolean {
  return Boolean(contact.whatsapp || contact.instagram || contact.email);
}

export function SellerPublicProvider({
  slug,
  binderName,
  currency,
  contact,
  catalog,
  children,
}: {
  slug: string;
  binderName: string;
  currency: Currency;
  contact: SellerContact;
  catalog: Record<string, WantCatalogEntry>;
  children: ReactNode;
}) {
  const [codes, setCodes] = useState<string[]>([]);
  const [origin, setOrigin] = useState("");

  // Loaded after mount so the server render and the first client render match.
  useEffect(() => {
    setOrigin(window.location.origin);
    setCodes(
      readStoredCodes(slug).filter((code) => {
        const entry = catalog[code];
        return entry !== undefined && entry.status !== "vendido";
      }),
    );
  }, [slug, catalog]);

  const items = useMemo<WantListItem[]>(
    () =>
      codes.flatMap((code) => {
        const entry = catalog[code];
        return entry
          ? [
              {
                pocketCode: code,
                name: entry.name,
                number: entry.number,
                setName: entry.setName,
                price: entry.price,
              },
            ]
          : [];
      }),
    [codes, catalog],
  );

  const has = useCallback((code: string) => codes.includes(code), [codes]);

  const persist = useCallback(
    (next: string[]) => {
      setCodes(next);
      writeStoredCodes(slug, next);
    },
    [slug],
  );

  const toggle = useCallback(
    (code: string) => {
      if (catalog[code]?.status === "vendido") {
        return;
      }
      persist(codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]);
    },
    [catalog, codes, persist],
  );

  const remove = useCallback(
    (code: string) => persist(codes.filter((c) => c !== code)),
    [codes, persist],
  );

  const value = useMemo<WantListValue>(
    () => ({
      slug,
      binderName,
      currency,
      contact,
      url: origin ? `${origin}/s/${slug}` : `/s/${slug}`,
      items,
      has,
      toggle,
      remove,
    }),
    [slug, binderName, currency, contact, origin, items, has, toggle, remove],
  );

  return <WantListContext.Provider value={value}>{children}</WantListContext.Provider>;
}
