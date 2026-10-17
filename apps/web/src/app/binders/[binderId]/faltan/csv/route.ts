import { loadMissingList, parseSort } from "../missing-list";

interface RouteContext {
  params: Promise<{ binderId: string }>;
}

const HEADER = ["name", "set", "number", "variant", "price", "currency"];

/** RFC 4180 field quoting; the output is read by Excel, so commas and quotes must survive. */
function csvField(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

function asciiFilename(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return slug || "binder";
}

export async function GET(request: Request, { params }: RouteContext): Promise<Response> {
  const { binderId } = await params;
  const sort = parseSort(new URL(request.url).searchParams.get("orden") ?? undefined);

  const list = await loadMissingList(binderId, sort);
  if (!list) {
    return new Response("No encontrado", { status: 404 });
  }

  const decimals = list.currency === "clp" ? 0 : 2;
  const lines = [HEADER.join(",")];
  for (const row of list.rows) {
    lines.push(
      [
        row.name,
        row.setName,
        row.number,
        row.variant,
        row.price === null ? "" : row.price.toFixed(decimals),
        list.currency.toUpperCase(),
      ]
        .map(csvField)
        .join(","),
    );
  }

  // BOM first so Excel reads the file as UTF-8 and keeps accents intact.
  const body = `﻿${lines.join("\r\n")}\r\n`;
  const filename = `faltan-${asciiFilename(list.binderName)}.csv`;

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
