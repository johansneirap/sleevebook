export interface Format {
  rows: number;
  cols: number;
}

export function pocketsPerSide(format: Format): number {
  return format.rows * format.cols;
}

export function pocketsPerSheet(format: Format): number {
  return pocketsPerSide(format) * 2;
}

export function capacity(format: Format, sheets: number): number {
  return pocketsPerSheet(format) * sheets;
}
