import { createDb } from "@sleevebook/db";
import { downloadAndExtract } from "./download.js";
import type { ImagePipelineConfig } from "./images/pipeline.js";
import { createS3Storage } from "./images/storage.js";
import { loadCatalogSource } from "./source.js";
import { upsertCatalog } from "./upsert.js";

function buildImagePipeline(): ImagePipelineConfig | undefined {
  const endpoint = process.env.S3_ENDPOINT;
  const bucket = process.env.S3_BUCKET;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const publicAssetsUrl = process.env.PUBLIC_ASSETS_URL;

  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey || !publicAssetsUrl) {
    console.log("S3 env vars not set; skipping the image pipeline (catalog-only ingest).");
    return undefined;
  }

  return {
    storage: createS3Storage({ endpoint, bucket, accessKeyId, secretAccessKey }),
    publicAssetsUrl,
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log("Downloading pokemon-tcg-data...");
  const extractedDir = await downloadAndExtract();

  console.log("Reading catalog source...");
  const source = await loadCatalogSource(extractedDir);

  const imagePipeline = buildImagePipeline();

  const db = createDb(databaseUrl);
  try {
    console.log("Upserting catalog...");
    const summary = await upsertCatalog(db, source, imagePipeline);
    console.log(summary);
  } finally {
    await db.$client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
