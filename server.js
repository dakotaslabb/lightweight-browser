const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/proxy', async (req, res) => {
  let targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('Missing target URL');
  }

  // Prepend https:// if protocol is omitted
  if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
    targetUrl = 'https://' + targetUrl;
  }

  try {
    const parsed = new URL(targetUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    clearTimeout(timeout);

    const finalUrl = response.url;
    const contentType = response.headers.get('content-type') || 'text/html';

    // Remove frame and CSP headers to allow rendering inside iframe
    res.removeHeader('X-Frame-Options');
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('Content-Security-Policy-Report-Only');

    if (contentType.includes('text/html')) {
      let html = await response.text();

      // Remove meta tags that enforce CSP or frame restrictions
      html = html.replace(/<meta[^>]*http-equiv=["']?(Content-Security-Policy|X-Frame-Options)["']?[^>]*>/gi, '');

      // Injected helper script to forward link clicks and title/URL updates to the parent browser shell
      const injectedScript = `
<script>
(function() {
  const currentUrl = ${JSON.stringify(finalUrl)};
  function notifyParent() {
    try {
      window.parent.postMessage({
        type: 'BROWSER_NAVIGATED',
        url: currentUrl,
        title: document.title || currentUrl
      }, '*');
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', notifyParent);
  } else {
    notifyParent();
  }

  // Intercept link clicks so navigation happens through the parent browser frame
  document.addEventListener('click', function(e) {
    const anchor = e.target.closest('a');
    if (anchor && anchor.href) {
      const href = anchor.href;
      if (href.startsWith('http://') || href.startsWith('https://')) {
        e.preventDefault();
        window.parent.postMessage({ type: 'BROWSER_NAVIGATE_TO', url: href }, '*');
      }
    }
  }, true);
})();
</script>
`;

      // Inject <base> tag to correctly resolve relative resources
      const baseTag = `<base href="${finalUrl}">`;

      if (/<head[^>]*>/i.test(html)) {
        html = html.replace(/<head[^>]*>/i, `$&${baseTag}${injectedScript}`);
      } else {
        html = `${baseTag}${injectedScript}${html}`;
      }

      res.status(response.status);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    } else {
      // Non-HTML content (images, styles, json, etc.)
      const arrayBuffer = await response.arrayBuffer();
      res.status(response.status);
      res.setHeader('Content-Type', contentType);
      return res.send(Buffer.from(arrayBuffer));
    }
  } catch (err) {
    const isTimeout = err.name === 'AbortError';
    const errorMessage = isTimeout ? 'Request timed out after 12 seconds.' : (err.message || 'Unknown network error');

    res.status(502).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Unable to Load Page</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #121212; color: #e0e0e0; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .error-card { background: #1e1e1e; border: 1px solid #333; border-radius: 8px; padding: 2rem; max-width: 480px; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
          h2 { color: #ff6b6b; margin-top: 0; font-size: 1.25rem; }
          p { color: #a0a0a0; font-size: 0.95rem; line-height: 1.5; word-break: break-all; }
          .btn { background: #3b82f6; color: white; border: none; padding: 0.5rem 1.25rem; border-radius: 6px; font-size: 0.9rem; cursor: pointer; margin-top: 1rem; }
          .btn:hover { background: #2563eb; }
        </style>
      </head>
      <body>
        <div class="error-card">
          <h2>Failed to Load Website</h2>
          <p>Target: <code>${targetUrl}</code></p>
          <p>${errorMessage}</p>
          <button class="btn" onclick="location.reload()">Retry</button>
        </div>
      </body>
      </html>
    `);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Lightweight Browser running at http://localhost:${PORT}`);
});
