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

    const response = await fetch(oembedUrl);
    if (!response.ok) throw new Error(`oembed fetch failed: ${response.status}`);
    const data = await response.json();

    return res.status(200).json({ title: data.title, author: data.author_name });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
