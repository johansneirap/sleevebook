import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";

const POKEMON_TCG_DATA_TARBALL =
  "https://codeload.github.com/PokemonTCG/pokemon-tcg-data/tar.gz/refs/heads/master";

export async function downloadAndExtract(
  tarballUrl: string = POKEMON_TCG_DATA_TARBALL,
): Promise<string> {
  const destDir = await mkdtemp(join(tmpdir(), "sleevebook-ingest-"));
  const response = await fetch(tarballUrl);
  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${tarballUrl}: ${response.status}`);
  }

  await pipeline(Readable.fromWeb(response.body), tar.extract({ cwd: destDir }));

  return destDir;
}
