import type { CSSProperties } from "react";

export interface PanelCellProps {
  asset: string;
  rows: number;
  cols: number;
  crop: { x: number; y: number; zoom: number };
  style?: CSSProperties;
}

export function PanelCell({ asset, rows, cols, crop, style }: PanelCellProps) {
  return (
    <div
      style={{
        gridColumn: `span ${cols}`,
        gridRow: `span ${rows}`,
        position: "relative",
        overflow: "hidden",
        borderRadius: 3,
        // Hairline drawn over the art (inset shadows would sit under the image).
        outline: "1px solid rgba(255,255,255,0.1)",
        outlineOffset: -1,
        ...style,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: arbitrary pasted URL, no next/image domain allowlist for user-supplied art */}
      <img
        src={asset}
        alt=""
        style={{
          position: "absolute",
          width: `${crop.zoom}%`,
          height: `${crop.zoom}%`,
          left: `${crop.x}%`,
          top: `${crop.y}%`,
          transform: "translate(-50%, -50%)",
          maxWidth: "none",
          maxHeight: "none",
          objectFit: "cover",
        }}
      />
    </div>
  );
}
