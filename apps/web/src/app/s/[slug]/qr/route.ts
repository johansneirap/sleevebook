import QRCode from "qrcode";
import { getPublishedBinderBySlug, getSiteUrl } from "../../../../lib/share";

export const dynamic = "force-dynamic";

// Error correction M and a 4-module quiet zone: the standard balance between
// scan reliability and size for print and screens. Dark modules stay near-black.
const QR_OPTIONS = {
  errorCorrectionLevel: "M" as const,
  margin: 4,
  width: 512,
  color: { dark: "#111111", light: "#ffffff" },
};

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const requestUrl = new URL(request.url);

  const publicBinder = await getPublishedBinderBySlug(slug);
  if (!publicBinder) {
    return new Response("Not found", { status: 404 });
  }

  const base = (getSiteUrl() || requestUrl.origin).replace(/\/$/, "");
  const publicUrl = `${base}/s/${slug}`;
  const wantsPng = requestUrl.searchParams.get("format") === "png";
  const wantsDownload = requestUrl.searchParams.get("download") === "1";

  const headers = new Headers({ "Cache-Control": "public, max-age=300" });
  if (wantsDownload) {
    const extension = wantsPng ? "png" : "svg";
    headers.set("Content-Disposition", `attachment; filename="sleevebook-${slug}-qr.${extension}"`);
  }

  if (wantsPng) {
    const png = await QRCode.toBuffer(publicUrl, { ...QR_OPTIONS, type: "png" });
    headers.set("Content-Type", "image/png");
    return new Response(new Uint8Array(png), { headers });
  }

  const svg = await QRCode.toString(publicUrl, { ...QR_OPTIONS, type: "svg" });
  headers.set("Content-Type", "image/svg+xml");
  return new Response(svg, { headers });
}
