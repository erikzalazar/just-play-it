exports.handler = async function (event) {
  const { url, platform } = event.queryStringParameters || {};

  if (!url || !platform) {
    return { statusCode: 400, body: JSON.stringify({ error: 'missing url or platform' }) };
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
      return { statusCode: 400, body: JSON.stringify({ error: 'unsupported platform' }) };
    }

    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error(`oembed fetch failed: ${res.status}`);
    const data = await res.json();

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: data.title, author: data.author_name })
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
