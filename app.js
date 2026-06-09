// --- URL extraction ---

function extractUrls(text) {
  const urlRegex = /https?:\/\/[^\s"'<>)]+/g;
  return [...new Set(text.match(urlRegex) || [])];
}

// --- Platform detection ---

function parseUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');

    // YouTube
    if (host === 'youtube.com' || host === 'youtu.be') {
      let id = null;
      if (host === 'youtu.be') {
        id = u.pathname.slice(1);
      } else {
        id = u.searchParams.get('v');
        if (!id && u.pathname.startsWith('/shorts/')) {
          id = u.pathname.split('/shorts/')[1];
        }
      }
      if (id) return { platform: 'youtube', id, original: url };
    }

    // Spotify
    if (host === 'open.spotify.com') {
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        return { platform: 'spotify', type: parts[0], id: parts[1], original: url };
      }
    }

    // SoundCloud
    if (host === 'soundcloud.com') {
      return { platform: 'soundcloud', id: url, original: url };
    }

    return { platform: 'unknown', original: url };
  } catch {
    return null;
  }
}

// --- Metadata fetching ---

async function fetchMetadata(parsed) {
  const supported = ['youtube', 'spotify', 'soundcloud'];
  if (!supported.includes(parsed.platform)) return null;
  try {
    const res = await fetch(
      `/.netlify/functions/metadata?url=${encodeURIComponent(parsed.original)}&platform=${parsed.platform}`
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    return { artist: data.author, title: data.title };
  } catch {
    return null;
  }
}

// --- Embed HTML ---

function buildEmbedHtml(parsed) {
  switch (parsed.platform) {
    case 'youtube':
      return `<iframe height="315" src="https://www.youtube.com/embed/${parsed.id}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;

    case 'spotify': {
      const type = parsed.type || 'track';
      const height = type === 'track' ? 152 : 352;
      return `<iframe height="${height}" src="https://open.spotify.com/embed/${type}/${parsed.id}?utm_source=generator" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    }

    case 'soundcloud': {
      const encodedUrl = encodeURIComponent(parsed.id);
      return `<iframe height="166" scrolling="no" src="https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23c8a96e&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false" allow="autoplay"></iframe>`;
    }

    default:
      return null;
  }
}

function labelHtml(meta, platform, original) {
  if (meta && meta.artist && meta.title) {
    return `<span class="artist">${meta.artist}</span> — ${meta.title}`;
  }
  // fallback: extract something readable from the URL
  try {
    const u = new URL(original);
    if (platform === 'spotify') {
      const parts = u.pathname.split('/').filter(Boolean);
      return `<span class="artist">${platform}</span> — ${parts.slice(-1)[0].replace(/-/g, ' ')}`;
    }
  } catch {}
  return `<span class="artist">${platform}</span>`;
}

// --- Render ---

function renderPlayers(parsedList) {
  const tracklistEl = document.getElementById('tracklist');
  const playersEl = document.getElementById('players');
  tracklistEl.innerHTML = '';
  playersEl.innerHTML = '';

  if (parsedList.length === 0) return;

  // Tracklist header
  tracklistEl.innerHTML = `<div class="tracklist-header">tracklist</div>`;

  parsedList.forEach((parsed, i) => {
    if (!parsed || parsed.platform === 'unknown') return;

    const num = String(i + 1).padStart(2, '0');
    const embedHtml = buildEmbedHtml(parsed);
    if (!embedHtml) return;

    // --- Tracklist row ---
    const row = document.createElement('div');
    row.className = 'tracklist-row';
    row.id = `trow-${i}`;
    row.innerHTML = `
      <span class="tracklist-num">${num}</span>
      <span class="tracklist-title" id="tmeta-${i}"><span class="loading">loading...</span></span>
      <span class="tracklist-platform">${parsed.platform}</span>
    `;
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => setActiveTrack(i));
    tracklistEl.appendChild(row);

    // --- Player block ---
    const block = document.createElement('div');
    block.className = 'player-block';
    block.id = `block-${i}`;
    block.innerHTML = `
      <div class="player-label">
        <span class="player-label-title" id="pmeta-${i}"><span class="loading">loading...</span></span>
        <span class="player-label-right">
          <span class="player-label-platform">${parsed.platform}</span>
          <a class="open-link" href="${parsed.original}" target="_blank" rel="noopener noreferrer" title="open on ${parsed.platform}">↗</a>
        </span>
      </div>
      ${embedHtml}
      <div class="player-footer">
        <a class="open-btn" href="${parsed.original}" target="_blank" rel="noopener noreferrer" title="open on ${parsed.platform} to save">♡</a>
      </div>
    `;
    playersEl.appendChild(block);

    // Fetch metadata and update tracklist, player label, and nav bar if active
    fetchMetadata(parsed).then(meta => {
      const tEl = document.getElementById(`tmeta-${i}`);
      const pEl = document.getElementById(`pmeta-${i}`);
      const html = labelHtml(meta, parsed.platform, parsed.original);
      if (tEl) tEl.innerHTML = html;
      if (pEl) pEl.innerHTML = html;

      // update nav bar if this is the currently active track
      if (i === activeIndex) {
        const label = tEl ? tEl.textContent : `track ${String(i + 1).padStart(2, '0')}`;
        document.getElementById('now-playing-label').textContent =
          `${String(i + 1).padStart(2, '0')}  ${label}`;
      }
    });
  });

  // Show unsupported links as errors at the bottom
  parsedList.forEach(parsed => {
    if (!parsed || parsed.platform !== 'unknown') return;
    const block = document.createElement('div');
    block.className = 'error-block';
    block.textContent = `unsupported: ${parsed.original}`;
    playersEl.appendChild(block);
  });

  const validList = parsedList.filter(p => p && p.platform !== 'unknown' && buildEmbedHtml(p));
  if (validList.length > 0) initNavBar(validList);
}

// --- Shareable URL encoding ---

function encodeLinks(urls) {
  return LZString.compressToEncodedURIComponent(urls.join('\n'));
}

function decodeLinks(encoded) {
  try {
    // support both new (lz-string) and old (btoa) format
    const decompressed = LZString.decompressFromEncodedURIComponent(encoded);
    if (decompressed) return decompressed.split('\n').filter(Boolean);
    return decodeURIComponent(escape(atob(encoded))).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function buildShareUrl(urls) {
  const hash = encodeLinks(urls);
  return `${location.origin}${location.pathname}#${hash}`;
}

async function shortenUrl(longUrl) {
  try {
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const short = (await res.text()).trim();
    if (short.startsWith('https://tinyurl.com/')) return short;
    throw new Error(`unexpected response: ${short}`);
  } catch (e) {
    console.warn('shortening failed:', e.message);
    return longUrl;
  }
}

// --- Copy button ---

function setupCopyButton(longUrl) {
  const btn = document.getElementById('copy-btn');
  const display = document.getElementById('share-url');
  display.textContent = 'shortening...';

  shortenUrl(longUrl).then(shortUrl => {
    display.textContent = shortUrl;
    btn.onclick = () => {
      navigator.clipboard.writeText(shortUrl).then(() => {
        btn.textContent = 'copied ✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'copy link';
          btn.classList.remove('copied');
        }, 2000);
      });
    };
  });
}

// --- Now playing nav ---

let activeIndex = 0;
let totalTracks = 0;
let activeParsedList = [];
let autoplay = false;

function buildAutoplayEmbedHtml(parsed) {
  switch (parsed.platform) {
    case 'youtube':
      return `<iframe height="315" src="https://www.youtube.com/embed/${parsed.id}?autoplay=1" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
    case 'spotify': {
      const type = parsed.type || 'track';
      const height = type === 'track' ? 152 : 352;
      return `<iframe height="${height}" src="https://open.spotify.com/embed/${type}/${parsed.id}?utm_source=generator&autoplay=1" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    }
    case 'soundcloud': {
      const encodedUrl = encodeURIComponent(parsed.id);
      return `<iframe height="166" scrolling="no" src="https://w.soundcloud.com/player/?url=${encodedUrl}&color=%23c8a96e&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false" allow="autoplay"></iframe>`;
    }
    default:
      return null;
  }
}

function stopOtherIframes(exceptIndex) {
  for (let j = 0; j < totalTracks; j++) {
    if (j === exceptIndex) continue;
    const block = document.getElementById(`block-${j}`);
    if (!block) continue;
    const iframe = block.querySelector('iframe');
    if (iframe) {
      const src = iframe.src;
      iframe.src = '';
      iframe.src = src;
    }
  }

  // if autoplay is on, reload the active iframe with autoplay param
  if (autoplay && activeParsedList[exceptIndex]) {
    const block = document.getElementById(`block-${exceptIndex}`);
    if (block) {
      const iframe = block.querySelector('iframe');
      const autoHtml = buildAutoplayEmbedHtml(activeParsedList[exceptIndex]);
      if (iframe && autoHtml) {
        const tmp = document.createElement('div');
        tmp.innerHTML = autoHtml;
        const newIframe = tmp.firstElementChild;
        iframe.replaceWith(newIframe);
      }
    }
  }
}

function setActiveTrack(i) {
  const prevBlock = document.getElementById(`block-${activeIndex}`);
  const prevRow = document.getElementById(`trow-${activeIndex}`);
  if (prevBlock) prevBlock.classList.remove('active');
  if (prevRow) prevRow.classList.remove('active');

  activeIndex = i;

  const block = document.getElementById(`block-${i}`);
  const row = document.getElementById(`trow-${i}`);
  if (block) {
    block.classList.add('active');
    block.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (row) row.classList.add('active');

  // update label
  const metaEl = document.getElementById(`tmeta-${i}`);
  const label = metaEl ? metaEl.textContent : `track ${String(i + 1).padStart(2, '0')}`;
  document.getElementById('now-playing-label').textContent =
    `${String(i + 1).padStart(2, '0')}  ${label}`;

  // update heart link
  const heartEl = document.getElementById('nav-heart');
  if (heartEl && activeParsedList[i]) {
    heartEl.href = activeParsedList[i].original;
    heartEl.title = `open on ${activeParsedList[i].platform} to save`;
  }

  document.getElementById('prev-btn').disabled = i === 0;
  document.getElementById('next-btn').disabled = i === totalTracks - 1;

  stopOtherIframes(i);
}

function initNavBar(parsedList) {
  activeParsedList = parsedList;
  totalTracks = parsedList.length;
  activeIndex = 0;
  document.getElementById('now-playing-bar').classList.remove('hidden');
  setActiveTrack(0);
}

document.getElementById('autoplay-btn').addEventListener('click', () => {
  autoplay = !autoplay;
  const btn = document.getElementById('autoplay-btn');
  btn.textContent = `autoplay: ${autoplay ? 'on' : 'off'}`;
  btn.classList.toggle('on', autoplay);
});

document.getElementById('prev-btn').addEventListener('click', () => {
  if (activeIndex > 0) setActiveTrack(activeIndex - 1);
});

document.getElementById('next-btn').addEventListener('click', () => {
  if (activeIndex < totalTracks - 1) setActiveTrack(activeIndex + 1);
});

// --- View switching ---

let currentUrls = [];

function showPlayerView(urls) {
  currentUrls = urls;
  document.getElementById('input-view').classList.add('hidden');
  document.getElementById('player-view').classList.remove('hidden');

  const parsed = urls.map(parseUrl).filter(Boolean);
  renderPlayers(parsed);

  const shareUrl = buildShareUrl(urls);
  setupCopyButton(shareUrl);
  history.replaceState(null, '', `#${encodeLinks(urls)}`);
}

function showInputView() {
  document.getElementById('player-view').classList.add('hidden');
  document.getElementById('now-playing-bar').classList.add('hidden');
  document.getElementById('input-view').classList.remove('hidden');
  history.replaceState(null, '', location.pathname);
}

// --- Init ---

document.getElementById('generate-btn').addEventListener('click', () => {
  const text = document.getElementById('url-input').value;
  const urls = extractUrls(text);
  if (urls.length === 0) return;
  showPlayerView(urls);
});

document.getElementById('share-all-btn').addEventListener('click', async () => {
  const btn = document.getElementById('share-all-btn');
  btn.textContent = 'shortening...';
  const longUrl = buildShareUrl(currentUrls);
  const shortUrl = await shortenUrl(longUrl);
  if (navigator.share) {
    navigator.share({ title: 'just play it', url: shortUrl });
    btn.textContent = 'share this playlist';
  } else {
    navigator.clipboard.writeText(shortUrl).then(() => {
      btn.textContent = 'link copied ✓';
      btn.classList.add('copied');
      setTimeout(() => {
        btn.textContent = 'share this playlist';
        btn.classList.remove('copied');
      }, 2000);
    });
  }
});

document.getElementById('back-btn').addEventListener('click', showInputView);

window.addEventListener('load', () => {
  const hash = location.hash.slice(1);
  if (hash) {
    const urls = decodeLinks(hash);
    if (urls.length > 0) showPlayerView(urls);
  }
});
