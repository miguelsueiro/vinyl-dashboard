import { createClient } from "@supabase/supabase-js";
import type { ItemColeccionDiscogs } from "../lib/types";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const discogsToken = process.env.DISCOGS_TOKEN!;
const discogsUsername = process.env.DISCOGS_USERNAME || "crackrecords";

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixFormats() {
  console.log("🚀 Starting format backfill from Discogs...");

  let allReleases: ItemColeccionDiscogs[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const res = await fetch(
      `https://api.discogs.com/users/${discogsUsername}/collection/folders/0/releases?page=${page}&per_page=100`,
      { headers: { Authorization: `Discogs token=${discogsToken}`, "User-Agent": "VinylFormatFix/1.0" } }
    );
    const data = await res.json() as { releases: ItemColeccionDiscogs[]; pagination: { pages: number } };
    allReleases = allReleases.concat(data.releases);
    totalPages = data.pagination.pages;
    page++;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`📦 Fetched ${allReleases.length} releases. Updating formats...`);
  let updated = 0;

  for (const release of allReleases) {
    const info = release.basic_information;
    if (!info) continue;
    const fullFormat = [
      info.formats?.[0]?.name,
      ...(info.formats?.[0]?.descriptions || [])
    ].filter(Boolean).join(", ");

    const { error } = await supabase
      .from("records")
      .update({ format: fullFormat })
      .eq("discogs_release_id", release.id);

    if (!error) {
      updated++;
      console.log(`  ✅ [${updated}/${allReleases.length}] ${info.title} → ${fullFormat}`);
    } else {
      console.error(`  ❌ ${info.title}:`, error.message);
    }

    // Rate limiting básico
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n🏁 Done! ${updated}/${allReleases.length} records updated.`);
}

fixFormats();
