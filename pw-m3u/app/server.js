// -----------------------------------------------------------------------------
// Dependencies
// -----------------------------------------------------------------------------
import express from 'express';
import cors from 'cors';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import { EncryptJWT, jwtDecrypt } from 'jose';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

// --- PERFORMANCE UPDATE ---
import cluster from 'cluster';
import os from 'os';

// -----------------------------------------------------------------------------
// Main Application Logic
// -----------------------------------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(`✅ Primary process ${process.pid} is running.`);
  console.log(`Forking server for ${numCPUs} CPU cores.`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    console.error(`Worker ${worker.process.pid} died. Forking a new one...`);
    cluster.fork();
  });

} else {
  // --- WORKER PROCESS ---
  if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET environment variable is not set.");
    process.exit(1);
  }
  const secretKey = crypto.createHash('sha256').update(process.env.JWT_SECRET).digest();
  const alg = 'dir';
  const enc = 'A256GCM';

 
  const app = express();
 app.use(cors());


// Helper to get access token with fallback logic
async function getAccessToken() {
    // Define the fallback token
        const fallbackToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3Njk4NDM3NjEuMTkyLCJkYXRhIjp7Il9pZCI6IjYyY2UwZDBhMjE2ZGNmMDAxOGRiMzM0OSIsInVzZXJuYW1lIjoiOTMzNTIyMDY4MSIsImZpcnN0TmFtZSI6IklhdiIsImxhc3ROYW1lIjoicGFuZGV5Iiwib3JnYW5pemF0aW9uIjp7Il9pZCI6IjVlYjM5M2VlOTVmYWI3NDY4YTc5ZDE4OSIsIndlYnNpdGUiOiJwaHlzaWNzd2FsbGFoLmNvbSIsIm5hbWUiOiJQaHlzaWNzd2FsbGFoIn0sImVtYWlsIjoicGFuZGV5YXJjaGl0YTkzMzVAZ21haWwuY29tIiwicm9sZXMiOlsiNWIyN2JkOTY1ODQyZjk1MGE3NzhjNmVmIiwiNWIyN2JkOTY1ODQyZjk1MGE3NzhjNmVmIl0sImNvdW50cnlHcm91cCI6IklOIiwidHlwZSI6IlVTRVIifSwiaWF0IjoxNzY5MjM4OTYxfQ.qu9x2NBOBWbQJtd88ITlUh9QQ_gdWMvaAAGpRTTZB_E";
    try {
        // 1. Attempt to fetch the token from the API
        const response = await axios.get('https://pw-api22-e3572562e69d.herokuapp.com/api/token/newr');
        const data = response.data;

        // 2. Check if the API returned a valid token
        if (data && data.access_token) {
            console.log("Successfully fetched dynamic access token.");
            return data.access_token;
        }

        // 3. Check if the API responded with the "No tokens found" message
        if (data && data.message === "No tokens found") {
            console.warn("API returned 'No tokens found'. Using fallback token.");
            return fallbackToken;
        }

        // Handle any other unexpected response from the API
        console.error("Unexpected response from token API, using fallback.", data);
        return fallbackToken;

    } catch (error) {
        // 4. If the API call fails entirely (e.g., network error), use the fallback
        console.error("Failed to fetch access token from API. Using fallback token.", error);
        return fallbackToken;
    }
}

  app.get('/get-proxy', async (req, res) => {
    const originalUrl = req.query.url;
    if (!originalUrl) {
      return res.status(400).json({ status: "error", error: 'Missing required query parameter: ?url=' });
    }

    try {
      const parsed = new URL(originalUrl);
      const queryString = parsed.search;
      const lastSlash = parsed.pathname.lastIndexOf('/');
      const basePath = parsed.pathname.substring(0, lastSlash + 1);
      const baseUrl = `${parsed.protocol}//${parsed.host}${basePath}`;

      const token = await new EncryptJWT({ baseUrl, queryString })
        .setProtectedHeader({ alg, enc })
        .setIssuedAt()
        .setExpirationTime('3h')
        .encrypt(secretKey);

      const expiresInSeconds = 3 * 60 * 60;
      const proxyUrlPath = `/stream/${token}/${path.basename(parsed.pathname)}`;

      res.json({
        status: "success",
        m3u8_url: `https://${req.get('host')}${proxyUrlPath}`,
        expires_in: expiresInSeconds
      });

    } catch (e) {
      console.error("URL Parsing or Encryption Error:", e.message);
      return res.status(400).json({ status: "error", error: "Invalid URL provided" });
    }
  });

  app.get('/key-proxy/:token', async (req, res) => {
    const { token } = req.params;
    try {
      const { payload } = await jwtDecrypt(token, secretKey);
      const originalKeyUri = payload.uri;
      if (!originalKeyUri) {
        return res.status(400).send('Invalid key token payload.');
      }

      const accessToken = await getAccessToken();

      // In the key request, we also need to set a valid Referer header
      const parsedKeyUrl = new URL(originalKeyUri);
      const keyResponse = await axios.get(originalKeyUri, {
        responseType: 'arraybuffer',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': req.get('User-Agent') || 'Proxy-Server/1.0',
          'Referer': parsedKeyUrl.origin // Add Referer to the key request as well
        }
      });

      // Filter out CORS headers from the key response before sending to client
      const cleanedHeaders = {};
      Object.entries(keyResponse.headers).forEach(([key, value]) => {
        if (!key.toLowerCase().startsWith('access-control-')) {
          cleanedHeaders[key] = value;
        }
      });

      res.writeHead(keyResponse.status, cleanedHeaders);
      res.end(keyResponse.data);

    } catch (error) {
      console.error(`Key proxy failed for token ${token}:`, error.message);
      res.status(error.response?.status || 500).send('Failed to fetch encryption key.');
    }
  });


  // -----------------------------------------------------------------------------
  // CORS FIX: The middleware below is updated to remove upstream CORS headers.
  // -----------------------------------------------------------------------------
  app.use('/stream/:token/*', async (req, res, next) => {
    const { token } = req.params;
    const filePath = req.params[0];

    try {
      const { payload: decoded } = await jwtDecrypt(token, secretKey);
      const { baseUrl, queryString } = decoded;

      if (!baseUrl || queryString === undefined) {
        return res.status(400).json({ status: "error", error: 'Malformed token payload' });
      }

      const targetUrl = baseUrl + filePath;
      const parsedUrl = new URL(targetUrl);
      const lib = parsedUrl.protocol === 'https:' ? https : http;

      const forwardedHeaders = {
        'User-Agent': req.get('User-Agent') || 'Mozilla/5.0',
        'Referer': parsedUrl.origin,
        'Origin': parsedUrl.origin,
      };

      if (req.headers.range) {
        forwardedHeaders['Range'] = req.headers.range;
      }

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + queryString,
        method: 'GET',
        headers: forwardedHeaders
      };

      const proxyReq = lib.request(options, (proxyRes) => {
        const isM3u8 = filePath.toLowerCase().endsWith('.m3u8');

        if (isM3u8 && proxyRes.statusCode >= 200 && proxyRes.statusCode < 300) {
          let body = [];
          proxyRes.on('data', chunk => body.push(chunk));
          proxyRes.on('end', async () => {
            try {
              let m3u8Content = Buffer.concat(body).toString('utf8');
              const keyUriRegex = /(#EXT-X-KEY:.*URI=")([^"]+)(")/g;
              const matches = [...m3u8Content.matchAll(keyUriRegex)];

              for (const match of matches) {
                const originalFullTag = match[0];
                const originalUri = match[2];
                const keyToken = await new EncryptJWT({ uri: originalUri })
                  .setProtectedHeader({ alg, enc })
                  .setIssuedAt()
                  .setExpirationTime('3h')
                  .encrypt(secretKey);
                const newUri = `https://${req.get('host')}/key-proxy/${keyToken}`;
                const newFullTag = `${match[1]}${newUri}${match[3]}`;
                m3u8Content = m3u8Content.replace(originalFullTag, newFullTag);
              }

              // **CORS FIX for M3U8 files**: Filter out upstream CORS headers.
              Object.keys(proxyRes.headers).forEach((key) => {
                const lowerCaseKey = key.toLowerCase();
                if (!lowerCaseKey.startsWith('access-control-') && !['content-encoding', 'content-length', 'transfer-encoding'].includes(lowerCaseKey)) {
                  res.setHeader(key, proxyRes.headers[key]);
                }
              });

              res.setHeader('Content-Length', Buffer.byteLength(m3u8Content, 'utf8'));
              res.status(proxyRes.statusCode).send(m3u8Content);
            } catch (err) {
              console.error("M3U8 processing error:", err.message);
              res.status(500).json({ status: "error", error: "Failed to process playlist." });
            }
          });
        } else {
          // **CORS FIX for TS segments and other files**: Filter headers before piping.
          const cleanedHeaders = {};
          Object.keys(proxyRes.headers).forEach((key) => {
            if (!key.toLowerCase().startsWith('access-control-')) {
              cleanedHeaders[key] = proxyRes.headers[key];
            }
          });
          res.writeHead(proxyRes.statusCode, cleanedHeaders);
          proxyRes.pipe(res);
        }
      });

      proxyReq.on('error', (err) => {
        console.error('Proxy request failed:', err.message);
        if (!res.headersSent) {
          res.status(502).json({ status: "error", error: 'Proxy request failed' });
        }
      });

      proxyReq.end();

    } catch (err) {
      console.warn(`[Auth] Rejected token on worker ${process.pid}: ${err.name}`);
      return res.status(401).json({ status: "error", error: 'Token is invalid or has expired' });
    }
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Worker ${process.pid} started. Listening on http://localhost:${PORT}`);
  });
}
