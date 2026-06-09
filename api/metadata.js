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

    // Spotify doesn't return author_name — extract from iframe title attribute
    if (platform === 'spotify' && !author && data.html) {
      const match = data.html.match(/title="Spotify Embed: ([^"]+)"/);
      if (match) {
        // iframe title is "TrackTitle" or "Artist - TrackTitle"
        const parts = match[1].split(' - ');
        if (parts.length >= 2) {
          title = parts.slice(1).join(' - ').trim();
          author = parts[0].trim();
        }
      }
    }

    return res.status(200).json({ title, author });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
