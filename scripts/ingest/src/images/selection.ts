import type { VariantImageUrls } from "./pipeline";

/** Source images copied per run unless --cap says otherwise (one image = one variant). */
export const DEFAULT_IMAGE_CAP = 500;
export const IMAGE_CONCURRENCY = 4;
/** Pause after each image, per worker, so the source CDN sees a steady trickle. */
export const IMAGE_REQUEST_DELAY_MS = 250;
export const IMAGE_BATCH_SIZE = 200;
export const IMAGE_ATTEMPTS = 3;

export interface ImageJobArgs {
  /** Also copy the rest of the catalog after the referenced variants. */
  all: boolean;
  /** With --all: catalog variants considered in this run (default: no limit beyond the cap). */
  limit: number | null;
  /** Source images copied or attempted in this run, referenced and catalog together. */
  cap: number;
  dryRun: boolean;
}

function positiveInteger(flag: string, raw: string | undefined): number {
  const value = Number(raw);
  if (raw === undefined || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${flag} needs a positive whole number`);
  }
  return value;
}

export function parseImageArgs(argv: string[]): ImageJobArgs {
  const args: ImageJobArgs = { all: false, limit: null, cap: DEFAULT_IMAGE_CAP, dryRun: false };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index] ?? "";
    const [flag, inlineValue] = arg.includes("=") ? arg.split(/=(.*)/s) : [arg, undefined];
    const readValue = () => inlineValue ?? argv[++index];

    switch (flag) {
      case "--all":
        args.all = true;
        break;
      case "--dry-run":
        args.dryRun = true;
        break;
      case "--limit":
        args.limit = positiveInteger("--limit", readValue());
        break;
      case "--cap":
        args.cap = positiveInteger("--cap", readValue());
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.limit !== null && !args.all) {
    throw new Error("--limit only applies together with --all");
  }
  return args;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The pokemontcg.io image to copy: the large one when there is one, else the small one. */
export function pokemontcgSourceUrl(images: unknown): string | null {
  if (!isRecord(images) || !isRecord(images["pokemontcg.io"])) {
    return null;
  }
  const source = images["pokemontcg.io"];
  const url = source.large ?? source.small;
  return typeof url === "string" && url.length > 0 ? url : null;
}

/** A variant already has R2 copies once images.r2 is present. */
export function hasR2Images(images: unknown): boolean {
  return isRecord(images) && images.r2 !== undefined && images.r2 !== null;
}

/** Same key the catalog ingest builds: `${pokemontcg card id}-${variant}`, e.g. "sv1-112-normal". */
export function variantKeyOf(externalCardId: string, variant: string): string {
  return `${externalCardId}-${variant}`;
}

/** Keeps the pokemontcg.io entry and adds the R2 URLs next to it. */
export function mergeR2Images(images: unknown, urls: VariantImageUrls): Record<string, unknown> {
  const base = isRecord(images) ? images : {};
  return {
    ...base,
    r2: { thumbnail: urls.thumbnail, medium: urls.medium, high: urls.high },
  };
}

/**
 * A readable one-line description. Network failures from the AWS client are
 * AggregateErrors with an empty message, so their inner errors are used.
 */
export function describeError(error: unknown): string {
  if (error instanceof AggregateError) {
    const inner = error.errors.map(describeError).join("; ");
    return inner || error.name;
  }
  if (error instanceof Error) {
    return error.message ? `${error.name}: ${error.message}` : error.name;
  }
  return String(error);
}

/**
 * Runs `task`, retrying on any error with exponential backoff. The last error
 * is rethrown. `sleep` is injectable so tests do not wait.
 */
export async function withRetry<T>(
  task: () => Promise<T>,
  options: {
    attempts?: number;
    baseDelayMs?: number;
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  const {
    attempts = IMAGE_ATTEMPTS,
    baseDelayMs = 1_000,
    sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
  } = options;

  for (let attempt = 1; ; attempt++) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= attempts) {
        throw error;
      }
      await sleep(baseDelayMs * 2 ** (attempt - 1));
    }
  }
}
