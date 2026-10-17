import { ImageResponse } from "next/og";
import {
  FACE_IMAGE_WIDTH,
  FaceImage,
  faceImageHeight,
} from "../../../../../../components/print/face-image";
import { faceFileName, parseFaceParam } from "../../../../../../components/print/print-model";
import {
  collectVariantIds,
  getBinderWithLayout,
  getVariantDisplays,
} from "../../../../../../lib/binders";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ binderId: string; face: string }>;
}

export async function GET(request: Request, { params }: RouteContext) {
  const { binderId, face: faceValue } = await params;
  const face = parseFaceParam(faceValue);

  const binderData = await getBinderWithLayout(binderId);
  if (!binderData || !face || face.sheet > binderData.sheets) {
    return new Response("No encontrado", { status: 404 });
  }

  const { format, pockets, panels } = binderData.layout;
  const displays = await getVariantDisplays(collectVariantIds(pockets));
  const download = new URL(request.url).searchParams.get("download") === "1";

  const headers: Record<string, string> = {
    "Cache-Control": "private, no-cache",
  };
  if (download) {
    headers["Content-Disposition"] =
      `attachment; filename="${faceFileName(binderData.name, face)}"`;
  }

  return new ImageResponse(
    <FaceImage face={face} format={format} pockets={pockets} panels={panels} displays={displays} />,
    {
      width: FACE_IMAGE_WIDTH,
      height: faceImageHeight(format),
      headers,
    },
  );
}
