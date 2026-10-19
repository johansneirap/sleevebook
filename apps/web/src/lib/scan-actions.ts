"use server";

import type { ScanResult } from "./scan-types";
import { assertUser } from "./session";

// Placeholder until the Fase 5 scan backend lands (agent D replaces this file).
export async function scanCard(_formData: FormData): Promise<ScanResult> {
  await assertUser();
  return { status: "disabled", candidates: [], message: "El escaneo aún no está disponible." };
}
