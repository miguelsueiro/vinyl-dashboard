const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const SUPABASE_URL = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const SUPABASE_KEY = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/['"]/g, '');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  const { data: records, error } = await supabase
    .from('records')
    .select('discogs_release_id, artist, title');
  
  if (error) console.error(error);
  
  const suspicious = records.filter(r => 
    r.title.includes('Halloween') || 
    r.title.includes('Porcupine') || 
    r.title.includes('Eraserhead') || 
    r.title.includes('Anarchy')
  );

  console.log("Found records:", suspicious);

  for (const record of suspicious) {
    const { data: prices } = await supabase
      .from('market_prices')
      .select('*')
      .eq('release_id', record.discogs_release_id.toString())
      .order('created_at', { ascending: false })
      .limit(1);
    console.log(`Prices for ${record.artist} - ${record.title}:`, prices);
  }
}

run();
