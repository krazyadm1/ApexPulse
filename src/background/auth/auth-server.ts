import http from 'http';
import { AUTH_CALLBACK_PORT } from '../../shared/constants';
import { handleSteamCallback, handleDiscordCallback } from './auth-manager';

let server: http.Server | null = null;

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ApexPulse - Login Success</title>
  <style>
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0a0e17;
      color: #e0e6ed;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .checkmark {
      font-size: 4rem;
      color: #00d4ff;
      margin-bottom: 1rem;
    }
    h1 {
      color: #00d4ff;
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    p {
      color: #8892a4;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">&#10003;</div>
    <h1>Success!</h1>
    <p>You can close this tab and return to ApexPulse.</p>
  </div>
</body>
</html>`;

const ERROR_HTML = (message: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ApexPulse - Login Error</title>
  <style>
    body {
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      background: #0a0e17;
      color: #e0e6ed;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .icon {
      font-size: 4rem;
      color: #ff4d6a;
      margin-bottom: 1rem;
    }
    h1 {
      color: #ff4d6a;
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
    p {
      color: #8892a4;
      font-size: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">&#10007;</div>
    <h1>Login Failed</h1>
    <p>${message}</p>
  </div>
</body>
</html>`;

function respond(res: http.ServerResponse, statusCode: number, html: string): void {
  res.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

export function startAuthServer(): void {
  if (server) return;

  server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${AUTH_CALLBACK_PORT}`);

    if (req.method === 'GET' && url.pathname === '/auth/steam/callback') {
      try {
        const success = await handleSteamCallback(url.href);
        if (success) {
          respond(res, 200, SUCCESS_HTML);
        } else {
          respond(res, 400, ERROR_HTML('Steam login could not be verified. Please try again.'));
        }
      } catch (err) {
        console.error('[AuthServer] Steam callback error:', err);
        respond(res, 500, ERROR_HTML('An unexpected error occurred during Steam login.'));
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/auth/discord/callback') {
      const code = url.searchParams.get('code');
      if (!code) {
        respond(res, 400, ERROR_HTML('Missing authorization code from Discord.'));
        return;
      }
      try {
        const success = await handleDiscordCallback(code);
        if (success) {
          respond(res, 200, SUCCESS_HTML);
        } else {
          respond(res, 400, ERROR_HTML('Discord login could not be completed. Please try again.'));
        }
      } catch (err) {
        console.error('[AuthServer] Discord callback error:', err);
        respond(res, 500, ERROR_HTML('An unexpected error occurred during Discord login.'));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  server.listen(AUTH_CALLBACK_PORT, '127.0.0.1', () => {
    console.log(`[AuthServer] Listening on http://127.0.0.1:${AUTH_CALLBACK_PORT}`);
  });

  server.on('error', (err) => {
    console.error('[AuthServer] Failed to start:', err);
    server = null;
  });
}

export function stopAuthServer(): void {
  if (server) {
    server.close(() => {
      console.log('[AuthServer] Stopped');
    });
    server = null;
  }
}
