export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    const url = new URL(request.url);
    const playerId = url.searchParams.get('id');
    const debug = url.searchParams.get('debug') === '1';

    if (!playerId || !/^\d+$/.test(playerId)) {
      return new Response(JSON.stringify({ error: 'Invalid player ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    try {
      const r = await fetch(`https://efhub.com/players/${playerId}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
        }
      });

      const html = await r.text();

      if (debug) {
        // Chercher "condition" dans le payload
        const condIdx = html.indexOf('"condition"');
        const condSnippet = condIdx >= 0 ? html.substring(condIdx - 20, condIdx + 100) : 'NOT FOUND';
        
        // Chercher aussi playerType avec contexte
        const ptIdx = html.indexOf('\\"playerType\\"');
        const ptSnippet = ptIdx >= 0 ? html.substring(ptIdx - 20, ptIdx + 150) : 'NOT FOUND';

        // Tester tous les regex possible pour condition
        const r1 = (html.match(/\\"condition\\":\\"([^\\"]+)\\"/) || [])[1] || null;
        const r2 = (html.match(/"condition":"([^"]+)"/) || [])[1] || null;
        const r3 = (html.match(/condition\\":\\"([^\\"]+)\\"/) || [])[1] || null;

        return new Response(JSON.stringify({
          condSnippet,
          ptSnippet,
          r1, r2, r3
        }, null, 2), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      }

      const data = parseEfhubPayload(html, playerId);
      data._hasFullData = !!(data.baseStats);

      return new Response(JSON.stringify(data), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600'
        }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }
  }
};

function parseEfhubPayload(html, playerId) {
  const result = {
    playerId, name: null, ovr: null, position: null,
    playingStyle: null, cardType: null, baseStats: null,
    skills: [], level_cap: null
  };

  // Mapping condition → label affiché
  const CONDITION_MAP = {
    'basic': 'Standard',
    'featured': 'Featured',
    'epic': 'Epic',
    'iconic': 'Iconic',
    'iconicMoment': 'Iconic Moment',
    'legend': 'Legend',
    'trending': 'Trending',
  };

  // baseStats
  const statsBlockMatch = html.match(/\\"baseStats\\":\{([^}]+)\}/);
  if (statsBlockMatch) {
    const stats = {};
    (statsBlockMatch[1].match(/\\"(\w+)\\":(\d+)/g) || []).forEach(p => {
      const kv = p.match(/\\"(\w+)\\":(\d+)/);
      if (kv) stats[kv[1]] = +kv[2];
    });
    result.baseStats = stats;
  }

  // position
  const posMatches = html.match(/\\"position\\":\\"([A-Z]{2,3})\\"/g) || [];
  if (posMatches.length > 0) {
    const first = posMatches[0].match(/\\"position\\":\\"([A-Z]{2,3})\\"/);
    if (first) result.position = first[1];
  }

  // playingStyle
  const psAll = [];
  const psRegex = /\\"playingStyle\\":\\"([^\\"]+)\\"/g;
  let psM;
  while ((psM = psRegex.exec(html)) !== null) {
    if (psM[1] !== 'Playing Style') psAll.push(psM[1]);
  }
  if (psAll.length > 0) result.playingStyle = psAll[0];

  // level_cap
  const lcMatch = html.match(/\\"initialLevelCap\\":(\d+)/);
  if (lcMatch) result.level_cap = +lcMatch[1];

  // cardType — lire le champ "condition" depuis le payload efhub
  // C'est le vrai label natif d'efhub, pas notre mapping
  const condMatch = html.match(/\\"condition\\":\\"([^\\"]+)\\"/);
  if (condMatch) {
    const raw = condMatch[1];
    result.cardType = CONDITION_MAP[raw] || raw;
  }

  // Fallback : si level_cap === 1 c'est Trending
  if (result.level_cap === 1) {
    result.cardType = 'Trending';
  }

  // name
  const nameMatch = html.match(/\\"name\\":\\"([^\\"\\\\]+)\\",\\"nameJa\\"/);
  if (nameMatch) result.name = nameMatch[1];

  // OVR
  const ovrMatch = html.match(/\\"overallRating\\":(\d+)/);
  if (ovrMatch) result.ovr = +ovrMatch[1];

  // skills
  const skillsMatch = html.match(/\\"playerSkills\\":\[([^\]]+)\]/);
  if (skillsMatch) {
    result.skills = (skillsMatch[1].match(/\\"([^\\"\\\\]+)\\"/g) || [])
      .map(s => s.replace(/\\"/g, ''));
  }

  // Fallback og:meta
  if (!result.name || !result.position) {
    const descMatch = html.match(/og:description[^>]*content="([^"]+)"/) ||
                      html.match(/content="([^"]+)"[^>]*og:description/);
    if (descMatch) {
      const m = descMatch[1].match(/^(.+?)\s+[—–-]+\s+(\d+)\s+OVR\s+([A-Z]+)/);
      if (m) {
        if (!result.name) result.name = m[1].trim();
        if (!result.ovr) result.ovr = +m[2];
        if (!result.position) result.position = m[3];
      }
    }
  }

  return result;
}
