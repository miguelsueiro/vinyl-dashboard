const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const token = env.match(/DISCOGS_TOKEN=(.*)/)[1].trim().replace(/['"]/g, '');

async function fetchStats(id) {
  const res = await fetch(`https://api.discogs.com/marketplace/price_suggestions/${id}`, {
    headers: { 'Authorization': `Discogs token=${token}`, 'User-Agent': 'VinylIntelligence/1.0' }
  });
  const data = await res.json();
  console.log(`Release ${id} price_suggestions:`, JSON.stringify(data, null, 2));
}

fetchStats(732580);
