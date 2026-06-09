export default async function handler(req, res) {
  const { url, platform } = req.query;

  if (!url || !platform) {
    return res.status(400).json({ error: 'missing url or platform' });
  }

  try {
    let oembedUrl;

    if (platform === 'youtube') {
      oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    } else if (platform === 'spotify') {
      oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`;
    } else if (platform === 'soundcloud') {
      oembedUrl = `https://soundcloud.com/oembed?url=${encodeURIComponent(url)}&format=json`;
    } else {
      return res.status(400).json({ error: 'unsupported platform' });
    }

    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; just-play-it/1.0)',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const text = await response.text();
      return res.status(500).json({ error: `oembed ${response.status}`, detail: text.slice(0, 200) });
    }

    const data = await response.json();

    let title = data.title;
    let author = data.author_name || null;

    // Spotify oEmbed has no artist — fetch the track page and scrape og:description
    if (platform === 'spotify' && !author) {
      try {
        const pageRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; just-play-it/1.0)' }
        });
        const html = await pageRes.text();
        // og:description is typically "Artist · Song · Year"
        const metaMatch = html.match(/<meta property="og:description" content="([^"]+)"/);
        if (metaMatch) {
          const desc = metaMatch[1];
          const parts = desc.split(' · ');
          if (parts.length >= 1) author = parts[0].trim();
        }
      } catch {}
    }

    return res.status(200).json({ title, author });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
