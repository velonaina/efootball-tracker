export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-api-key, anthropic-version',
        }
      });
    }

    const url = new URL(request.url);

    if (url.pathname === '/coaching') return handleCoaching(request);
    if (url.pathname === '/chat') return handleGeminiChat(request);
    return handleEfhub(request, url);
  }
};

async function handleCoaching(request) {
  try {
    const body = await request.json();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body)
    });
    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleGeminiChat(request) {
  try {
    const body = await request.json();

    // Vérifier que la clé est disponible
    if (typeof GEMINI_API_KEY === 'undefined' || !GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY non configurée' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_API_KEY;
    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}

async function handleEfhub(request, url) {
  const playerId = url.searchParams.get('id');
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

function parseEfhubPayload(html, playerId) {
  const result = {
    playerId, name: null, ovr: null, position: null,
    playingStyle: null, cardType: null, baseStats: null,
    skills: [], level_cap: null
  };
  const CARD_TYPES = {
    1: 'Standard', 2: 'Featured', 3: 'Epic', 4: 'Iconic',
    5: 'Iconic Moment', 6: 'Featured', 7: 'Featured', 8: 'Epic',
    9: 'Legendary', 10: 'Legendary'
  };
  const statsBlockMatch = html.match(/\\"baseStats\\":\{([^}]+)\}/);
  if (statsBlockMatch) {
    const stats = {};
    (statsBlockMatch[1].match(/\\"(\w+)\\":(\d+)/g) || []).forEach(p => {
      const kv = p.match(/\\"(\w+)\\":(\d+)/);
      if (kv) stats[kv[1]] = +kv[2];
    });
    result.baseStats = stats;
  }
  const posMatches = html.match(/\\"position\\":\\"([A-Z]{2,3})\\"/g) || [];
  if (posMatches.length > 0) {
    const first = posMatches[0].match(/\\"position\\":\\"([A-Z]{2,3})\\"/);
    if (first) result.position = first[1];
  }
  const psAll = [];
  const psRegex = /\\"playingStyle\\":\\"([^\\"]+)\\"/g;
  let psM;
  while ((psM = psRegex.exec(html)) !== null) {
    if (psM[1] !== 'Playing Style') psAll.push(psM[1]);
  }
  if (psAll.length > 0) result.playingStyle = psAll[0];
  const lcMatch = html.match(/\\"initialLevelCap\\":(\d+)/);
  if (lcMatch) result.level_cap = +lcMatch[1];
  if (result.level_cap === 1) {
    result.cardType = 'Trending';
  } else {
    const pidMarker = '\\"playerId\\":\\"' + playerId + '\\"';
    const pidIdx = html.indexOf(pidMarker);
    if (pidIdx >= 0) {
      const snippet = html.substring(pidIdx, pidIdx + 200);
      const ptMatch = snippet.match(/\\"playerType\\":(\d+)/);
      if (ptMatch) result.cardType = CARD_TYPES[+ptMatch[1]] || ('Type ' + ptMatch[1]);
    }
    if (!result.cardType) {
      const typeMatch = html.match(/\\"playerType\\":(\d+)/);
      if (typeMatch) result.cardType = CARD_TYPES[+typeMatch[1]] || null;
    }
  }
  const nameMatch = html.match(/\\"name\\":\\"([^\\"\\\\]+)\\",\\"nameJa\\"/);
  if (nameMatch) result.name = nameMatch[1];
  const ovrMatch = html.match(/\\"overallRating\\":(\d+)/);
  if (ovrMatch) result.ovr = +ovrMatch[1];
  const skillsMatch = html.match(/\\"playerSkills\\":\[([^\]]+)\]/);
  if (skillsMatch) {
    result.skills = (skillsMatch[1].match(/\\"([^\\"\\\\]+)\\"/g) || [])
      .map(s => s.replace(/\\"/g, ''));
  }
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
