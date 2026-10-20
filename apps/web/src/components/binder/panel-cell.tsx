import type { CSSProperties } from "react";

export interface PanelCellProps {
  asset: string;
  rows: number;
  cols: number;
  crop: { x: number; y: number; zoom: number };
  style?: CSSProperties;
}

// A panel spans several pockets and sits under one transparent sleeve.
export function PanelCell({ asset, rows, cols, crop, style }: PanelCellProps) {
  return (
    <div
      style={{
        gridColumn: `span ${cols}`,
        gridRow: `span ${rows}`,
        position: "relative",
        overflow: "hidden",
        borderRadius: 6,
        // Hairline drawn over the art (inset shadows would sit under the image).
        outline: "1px solid rgba(27,32,51,0.14)",
        outlineOffset: -1,
        boxShadow: "0 1px 3px rgba(27,32,51,0.2)",
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
