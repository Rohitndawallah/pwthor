const express = require('express');
const axios = require('axios');
const app = express();
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const stringSimilarity = require('string-similarity');
const crypto = require('crypto');
const https = require('https');
const cors = require('cors');


// 1. Create a whitelist of allowed domains
const allowedOrigins = [
  'https://pwthor.site',
  'https://pw-m3u-d58f21da6afd.herokuapp.com', // It's good practice to include 'www' subdomain
  'https://pwthorproxyy-95e01ea8c27e.herokuapp.com',
  'https://downloadm3u-dbe5522dc3e5.herokuapp.com',
  'https://pw-m3u8q1-401b8c12ce0d.herokuapp.com',
  'https://pwthor.site/', // Add your other domains here
  'http://pwthor.site' // Optional: for local development
];

// 2. Configure the 'cors' middleware with a function for the origin
const corsOptions = {
  origin: function (origin, callback) {
    // The 'origin' is the domain from which the request is coming.
    // Allow requests with no origin (like mobile apps or server-to-server calls)
    if (!origin) {
      return callback(null, true);
    }

    // Check if the request origin is in our whitelist.
    if (allowedOrigins.indexOf(origin) !== -1) {
      // If it is, allow the request.
      callback(null, true);
    } else {
      // If it's not, reject the request.
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

// Use the new cors options
app.use(cors(corsOptions));


// 3. (Optional but Recommended) Update your custom middleware for the Referer check
// The 'cors' package already handles the 'Origin' check. This custom middleware
// adds an extra layer of security by checking the 'Referer' header.
app.use((req, res, next) => {
  const referer = req.get('Referer');

  // If a referer header is present, check it against the whitelist
  if (referer) {
    const isRefererAllowed = allowedOrigins.some(allowedOrigin => referer.startsWith(allowedOrigin));
    if (!isRefererAllowed) {
      return res.status(403).json({ error: 'Access denied: Invalid Referer' });
    }
  }

  next();
});




// Helper to get access token with fallback logic
async function getAccessToken() {
    // Define the fallback token
    const fallbackToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NzA0NTA2NjYuNDgyLCJkYXRhIjp7Il9pZCI6IjYxMDBmMTc1NDZmMzQ4MDAxMTIzODg4YiIsInVzZXJuYW1lIjoiOTUwNzA4MzUxMSIsImZpcnN0TmFtZSI6IlNhdHlhbWt1bWFyIiwibGFzdE5hbWUiOiIiLCJvcmdhbml6YXRpb24iOnsiX2lkIjoiNWViMzkzZWU5NWZhYjc0NjhhNzlkMTg5Iiwid2Vic2l0ZSI6InBoeXNpY3N3YWxsYWguY29tIiwibmFtZSI6IlBoeXNpY3N3YWxsYWgifSwiZW1haWwiOiJzYXR5YW1rNzYyNTRAZ21haWwuY29tIiwicm9sZXMiOlsiNWIyN2JkOTY1ODQyZjk1MGE3NzhjNmVmIl0sImNvdW50cnlHcm91cCI6IklOIiwib25lUm9sZXMiOltdLCJ0eXBlIjoiVVNFUiJ9LCJpYXQiOjE3Njk4NDU4NjZ9.Gi52DTpVDMKJZYW5VFTsalJpJIRO7INVv1kihInLYXY";

    try {
        // 1. Attempt to fetch the token from the API
        const tokenUrl = `http://127.0.0.1:${process.env.PORT || 3000}/api/token/newr`;
        const response = await axios.get(tokenUrl);
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

app.get('/api/otp', async (req, res) => {
  const { mpd_url } = req.query;

  if (!mpd_url) {
    return res.status(400).json({ error: 'Missing ?mpd_url=' });
  }

  try {
    // Get access token using existing function
    const access_token = await getAccessToken();
    if (!access_token) return res.status(500).json({ error: 'Token not available' });

    // Define target URL and payload
    const url = "https://pw-otp1-32821eb103e0.herokuapp.com/get-license-key";

    const payload = {
      mpd_url,
      access_token
    };

    const headers = {
    "Content-Type": "application/json"
    };

    const response = await axios.post(url, payload, { headers });

    res.json({
      success: true,
      data: response.data
    });

  } catch (err) {
    console.error('❌ /api/pw/mpd/keys error:', err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch keys from master API',
      details: err.response?.data || err.message
    });
  }
});

// New API: Returns a single fixed fallback token
app.get('/api/token/newr', (req, res) => {
    try {
        // Define the single fallback token you want to show
        const fallbackToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NzA0NTA2NjYuNDgyLCJkYXRhIjp7Il9pZCI6IjYxMDBmMTc1NDZmMzQ4MDAxMTIzODg4YiIsInVzZXJuYW1lIjoiOTUwNzA4MzUxMSIsImZpcnN0TmFtZSI6IlNhdHlhbWt1bWFyIiwibGFzdE5hbWUiOiIiLCJvcmdhbml6YXRpb24iOnsiX2lkIjoiNWViMzkzZWU5NWZhYjc0NjhhNzlkMTg5Iiwid2Vic2l0ZSI6InBoeXNpY3N3YWxsYWguY29tIiwibmFtZSI6IlBoeXNpY3N3YWxsYWgifSwiZW1haWwiOiJzYXR5YW1rNzYyNTRAZ21haWwuY29tIiwicm9sZXMiOlsiNWIyN2JkOTY1ODQyZjk1MGE3NzhjNmVmIl0sImNvdW50cnlHcm91cCI6IklOIiwib25lUm9sZXMiOltdLCJ0eXBlIjoiVVNFUiJ9LCJpYXQiOjE3Njk4NDU4NjZ9.Gi52DTpVDMKJZYW5VFTsalJpJIRO7INVv1kihInLYXY";

        // Return the fixed token directly
        res.json({
            success: true,
            access_token: fallbackToken
        });

    } catch (err) {
        console.error('❌ /api/token/newr error:', err.message);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve token',
            details: err.message
        });
    }
});

// Updated Route: Resolves Slugs and fetches DPPs
app.get('/api/dpp', async (req, res) => {
    // 1. Receive BatchId, SubjectId (slug), and TopicId (slug) from query
    const { BatchId, SubjectId, TopicId, dppType = 'ALL' } = req.query;
    const limit = 20;

    if (!BatchId || !SubjectId || !TopicId) {
        return res.status(400).json({
            success: false,
            error: 'Missing query parameters: BatchId, SubjectId (slug), or TopicId (slug)'
        });
    }

    try {
        const token = await getAccessToken();
        if (!token) {
            return res.status(500).json({ success: false, error: 'Could not retrieve access token' });
        }

        const authHeaders = { headers: { 'Authorization': `Bearer ${token}` } };

        // --- STEP 1: Fetch Batch Details to find the real Subject ID and CohortId ---
        const batchDetailsUrl = `https://api.penpencil.co/v3/batches/${BatchId}/details`;
        const batchResponse = await axios.get(batchDetailsUrl, authHeaders);
        const batchData = batchResponse.data.data;

        const cohortId = batchData.cohortId;
        // Find the subject object where the slug matches the SubjectId passed in the query
        const subjectMatch = batchData.subjects.find(s => s.slug === SubjectId);

        if (!subjectMatch) {
            return res.status(404).json({ success: false, error: 'Subject slug not found in batch details' });
        }

        const batchSubjectId = subjectMatch._id; // This is the "actual" ID needed

        // --- STEP 2: Fetch Topic Info to get the Chapter ID (_id from tags) ---
        // Using your Heroku proxy/api as requested
        const topicInfoUrl = `https://pw-api-0585c7015531.herokuapp.com/api/batch/${BatchId}/subject/${SubjectId}/topic/${TopicId}/all-contents`;
        const topicResponse = await axios.get(topicInfoUrl);
        
        // Extracting chapterId from the first item's tags
        const firstItem = topicResponse.data.data?.[0];
        const chapterId = firstItem?.tags?.[0]?._id;

        if (!chapterId) {
            return res.status(404).json({ success: false, error: 'Chapter ID could not be extracted from Topic Info' });
        }

        // --- STEP 3: Fetch DPP List using the resolved IDs ---
        let allDpps = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const dppUrl = `https://api.penpencil.co/v3/test-service/tests/new-dpp-list?page=${page}&batchId=${BatchId}&batchSubjectId=${batchSubjectId}&chapterId=${chapterId}&dppType=${dppType}&limit=${limit}`;

            const dppResponse = await axios.get(dppUrl, authHeaders);
            const dpps = dppResponse.data.data || [];
            
            if (dpps.length > 0) {
                allDpps = allDpps.concat(dpps);
            }

            if (dpps.length < limit) {
                hasMore = false;
            } else {
                page++;
            }
        }

        // --- FINAL RESULT: Include the requested extra info at the bottom ---
        res.json({
            success: true,
            data: allDpps,
            totalCount: allDpps.length,
            // Appending the found values at the bottom as requested
            resolvedDetails: {
                extractedBatchSubjectId: batchSubjectId,
                extractedCohortId: cohortId,
                extractedChapterId: chapterId,
                subjectSlugUsed: SubjectId,
                topicSlugUsed: TopicId
            }
        });

    } catch (err) {
        console.error('❌ Error in processing DPP request:', err.message);
        res.status(err.response?.status || 500).json({
            success: false,
            error: 'Failed to process request',
            details: err.response?.data || err.message
        });
    }
});


// ✨ UPDATED ROUTE: Get details for a specific DPP quiz using local token files
app.get('/api/dpp/quiz/:testId', async (req, res) => {
    // Extract the ID from the URL path. This will be used for both testId and exerciseId.
    const { testId } = req.params;

    // Extract other required IDs from the query string
    const { cohortId, batchId, batchScheduleId } = req.query;

    // Validate that all necessary parameters were provided
    if (!testId || !cohortId || !batchId || !batchScheduleId) {
        return res.status(400).json({
            success: false,
            error: 'Missing required parameters. Required: testId (in path), and cohortId, batchId, batchScheduleId (in query).'
        });
    }

    try {
        // --- 1. SEARCH FOR TOKEN IN LOCAL FILES ---
        const tokenFiles = [
            'valid_token_batches.json',
            'valid_token_batches1.json',
            'valid_token_batches2.json'
        ];
        
        let localToken = null;

        for (const file of tokenFiles) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                try {
                    const tokens = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                    // Look for a token object that contains the requested batchId
                    const match = tokens.find(t => t.batches?.some(b => b.batchId === batchId));
                    if (match && match.access_token) {
                        localToken = match.access_token;
                        console.log(`✅ Using token from local file: ${file} for batch: ${batchId}`);
                        break; 
                    }
                } catch (readErr) {
                    console.error(`Error reading ${file}:`, readErr.message);
                }
            }
        }

        // --- 2. FALLBACK TO DYNAMIC API TOKEN ---
        const token = localToken || await getAccessToken();

        if (!token) {
            return res.status(500).json({ success: false, error: 'Could not retrieve access token from files or API' });
        }

        // Construct the target API URL using the testId from the path
        const url = `https://api.penpencil.co/v3/test-service/tests/${testId}/start-test`;

        // Make the GET request to the external API
        const response = await axios.get(url, {
            params: {
                exerciseId: testId, 
                testSource: 'BATCH_QUIZ',
                type: 'Start',
                cohortId,
                batchId,
                batchScheduleId
            },
            headers: {
                'Authorization': `Bearer ${token}` 
            }
        });

        // Forward the successful response from the external API to the user
        res.json(response.data);

    } catch (err) {
        // Handle any errors that occur during the API call
        console.error('❌ DPP Quiz start error:', err.message);
        res.status(err.response?.status || 500).json({
            success: false,
            error: 'Failed to start DPP quiz',
            details: err.response?.data || err.message
        });
    }
});

// Route 1: Get batch details (v3 - uses access_token header)
app.get('/api/batch/:batchId', async (req, res) => {
  const { batchId } = req.params;

  try {
    const token = await getAccessToken();
    if (!token) return res.status(500).json({ error: 'Token not available' });

    const response = await axios.get(`https://api.penpencil.co/v3/batches/${batchId}/details`, {
      headers: { 'access_token': token } // ✅ Works for v3
    });

    res.json(response.data);
  } catch (err) {
    console.error('Batch details error:', err.message);
    res.status(err.response?.status || 500).json({
      error: 'Failed to fetch batch details',
      details: err.response?.data || {}
    });
  }
});

// ✅ Route 2: Get subject topics (v2 - requires Authorization Bearer)
app.get('/api/batch/:batchId/subject/:subjectSlug/topics', async (req, res) => {
  const { batchId, subjectSlug } = req.params;

  try {
    const token = await getAccessToken();
    if (!token) return res.status(500).json({ error: 'Token not available' });

    let allItems = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `https://api.penpencil.co/v2/batches/${batchId}/subject/${subjectSlug}/topics?page=${page}`;
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const items = response.data.data || [];
      allItems = allItems.concat(items);

      if (items.length < 20) {
        hasMore = false;
      } else {
        page++;
      }
    }

    res.json({
      success: true,
      data: allItems,
      totalCount: allItems.length
    });

  } catch (err) {
    console.error('Subject topics error:', err.message);
    res.status(err.response?.status || 500).json({
      error: 'Failed to fetch subject topics',
      details: err.response?.data || {}
    });
  }
});


// Route: Get all videos for a given topic (tag)
app.get('/api/batch/:batchId/subject/:subjectSlug/topic/:topicId/videos', async (req, res) => {
  const { batchId, subjectSlug, topicId } = req.params;
  const page = req.query.page || 1;

  try {
    const token = await getAccessToken();
    if (!token) return res.status(500).json({ error: 'Token not available' });

    const url = `https://api.penpencil.co/v2/batches/${batchId}/subject/${subjectSlug}/contents?page=${page}&contentType=videos&tag=${topicId}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}` // ✅ Required by v2
      }
    });

    res.json(response.data);

  } catch (err) {
    console.error('❌ Video content error:', err.message);
    res.status(err.response?.status || 500).json({
      error: 'Failed to fetch video contents',
      details: err.response?.data || {}
    });
  }
});

// Route: Get ALL contents (any type) for a topic, paginated
app.get('/api/batch/:batchId/subject/:subjectSlug/topic/:topicId/all-contents', async (req, res) => {
  const { batchId, subjectSlug, topicId } = req.params;
  let contentType = req.query.type || 'videos';
  if (contentType === 'vidoes') contentType = 'videos'; // fix typo

  try {
    const token = await getAccessToken();
    if (!token) return res.status(500).json({ error: 'Token not available' });

    let allItems = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const url = `https://api.penpencil.co/v2/batches/${batchId}/subject/${subjectSlug}/contents?page=${page}&contentType=${contentType}&tag=${topicId}`;
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const items = response.data.data || [];
      allItems = allItems.concat(items);

      if (items.length < 20) {
        hasMore = false;
      } else {
        page++;
      }
    }

    res.json({
      success: true,
      data: allItems,
      totalCount: allItems.length
    });

  } catch (err) {
    console.error('❌ all content fetch error:', err.message);
    res.status(err.response?.status || 500).json({
      error: 'Failed to fetch all contents',
      details: err.response?.data || {}
    });
  }
});


// Route: Fetch content from pw-main-details.vercel.app
app.get('/api/old/batch/:batchId/subject/:subjectSlug/schedule/:scheduleId/content', async (req, res) => {
  const { batchId, subjectSlug, scheduleId } = req.params;

  try {
    const url = `https://master-api-py-v1-x-ac6bfd8ef11d.herokuapp.com/pw/schedule-data/${batchId}/subject/${subjectSlug}/${scheduleId}/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3Njk4NDM3NjEuMTkyLCJkYXRhIjp7Il9pZCI6IjYyY2UwZDBhMjE2ZGNmMDAxOGRiMzM0OSIsInVzZXJuYW1lIjoiOTMzNTIyMDY4MSIsImZpcnN0TmFtZSI6IklhdiIsImxhc3ROYW1lIjoicGFuZGV5Iiwib3JnYW5pemF0aW9uIjp7Il9pZCI6IjVlYjM5M2VlOTVmYWI3NDY4YTc5ZDE4OSIsIndlYnNpdGUiOiJwaHlzaWNzd2FsbGFoLmNvbSIsIm5hbWUiOiJQaHlzaWNzd2FsbGFoIn0sImVtYWlsIjoicGFuZGV5YXJjaGl0YTkzMzVAZ21haWwuY29tIiwicm9sZXMiOlsiNWIyN2JkOTY1ODQyZjk1MGE3NzhjNmVmIiwiNWIyN2JkOTY1ODQyZjk1MGE3NzhjNmVmIl0sImNvdW50cnlHcm91cCI6IklOIiwidHlwZSI6IlVTRVIifSwiaWF0IjoxNzY5MjM4OTYxfQ.qu9x2NBOBWbQJtd88ITlUh9QQ_gdWMvaAAGpRTTZB_E?authorization=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTM0NTIzNTU3NiIsInRnX3VzZXJuYW1lIjoiQFJlZGdhbWluZ2lkZmYiLCJpYXQiOjE3Njc5NzQ1MDh9.e_IZTzq_Dg3VmIDGu5OkTEqRpZ95g-Vv7ILuwqSXoXc`;

    const response = await axios.get(url);
    res.json(response.data);

  } catch (err) {
    console.error('❌ Main details fetch error:', err.message);
    res.status(err.response?.status || 500).json({
      error: 'Failed to fetch content from pw-main-details',
      details: err.response?.data || {}
    });
  }
});

// Route: Fetch content from pw-main-details.vercel.app using dynamic token
app.get('/api/batch/:batchId/subject/:subjectSlug/schedule/:scheduleId/content', async (req, res) => {
  const { batchId, subjectSlug, scheduleId } = req.params;

  try {
    // 1. Get the dynamic access token from your getAccessToken() helper
    const access_token = await getAccessToken();

    if (!access_token) {
        return res.status(500).json({ success: false, error: 'Access token could not be retrieved' });
    }

    // 2. Construct the URL using the dynamic token
    // We append the access_token to the path and also as the 'authorization' query param
    const baseUrl = `https://master-api-py-v1-x-ac6bfd8ef11d.herokuapp.com/pw/schedule-data`;
    const AuthParam = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTM0NTIzNTU3NiIsInRnX3VzZXJuYW1lIjoiQFJlZGdhbWluZ2lkZmYiLCJpYXQiOjE3Njc5NzQ1MDh9.e_IZTzq_Dg3VmIDGu5OkTEqRpZ95g-Vv7ILuwqSXoXc";
    const finalUrl = `${baseUrl}/${batchId}/subject/${subjectSlug}/${scheduleId}/${access_token}?authorization=${AuthParam}`;

    console.log(`📡 Fetching content for Schedule: ${scheduleId}`);

    const response = await axios.get(finalUrl, {
        timeout: 15000 // Good practice to prevent hanging
    });

    res.json(response.data);

  } catch (err) {
    console.error('❌ Main details fetch error:', err.message);
    res.status(err.response?.status || 500).json({
      success: false,
      error: 'Failed to fetch content from master API',
      details: err.response?.data || err.message
    });
  }
});

// Route: Get today's schedule for a batch
app.get('/api/batch/:batchId/todays-schedule', async (req, res) => {
  const { batchId } = req.params;

  try {
    const token = await getAccessToken();
    if (!token) return res.status(500).json({ error: 'Token not available' });

    const url = `https://api.penpencil.co/v1/batches/${batchId}/todays-schedule`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json(response.data);

  } catch (err) {
    console.error('❌ Schedule fetch error:', err.message);
    res.status(err.response?.status || 500).json({
      error: 'Failed to fetch today\'s schedule',
      details: err.response?.data || {}
    });
  }
});

// Route: Search batches by name and page
app.get('/api/batches/search', async (req, res) => {
  const { name, page = 1 } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'Query parameter "name" is required' });
  }

  try {
    const token = await getAccessToken();
    if (!token) return res.status(500).json({ error: 'Token not available' });

    const url = `https://api.penpencil.co/batch-service/v4/batches/search?page=${page}&name=${encodeURIComponent(name)}`;

    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    res.json(response.data);

  } catch (err) {
    console.error('❌ Batch search error:', err.message);
    res.status(err.response?.status || 500).json({
      error: 'Failed to search batches',
      details: err.response?.data || {}
    });
  }
});

// ---------------------
// Normalization function (Corrected)
// ---------------------
function normalizeTitle(str) {
  return decodeURIComponent(str)
    // ✅ ADD a period '.' to the list of characters to be replaced by a space
    .replace(/[|_+:\-()\/.]/g, ' ') 
    .replace(/[^\p{L}\p{N}\s]/gu, '')  // keeps Hindi chars
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

// ---------------------
// Main API Route
// ---------------------
app.get('/api/video/stream-info', async (req, res) => {
  const { batch, subject, topic, title } = req.query;
  if (!batch || !subject || !topic || !title) {
    return res.status(400).json({ error: 'Missing batch, subject, topic, or title in query' });
  }

  const normBatch   = normalizeTitle(batch);
  const normSubject = normalizeTitle(subject);
  const normTopic   = normalizeTitle(topic);
  const normTitle   = normalizeTitle(title);

  try {
    const files = fs.readdirSync(__dirname).filter(f => f.startsWith('data') && f.endsWith('.json'));
    let videoUrl = null;

    for (const file of files) {
      const content = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf-8'));

      const batchKey = Object.keys(content.batches || {}).find(b => normalizeTitle(b) === normBatch);
      if (!batchKey) continue;

      const subjectKey = Object.keys(content.batches[batchKey].subjects || {}).find(s => normalizeTitle(s) === normSubject);
      if (!subjectKey) continue;

      const topicKey = Object.keys(content.batches[batchKey].subjects[subjectKey].topics || {}).find(t => normalizeTitle(t) === normTopic);
      if (!topicKey) continue;

      const lectures = content.batches[batchKey].subjects[subjectKey].topics[topicKey].lectures || [];

      const normLectureTitles = lectures.map(l => normalizeTitle(l.title || ''));

      // ✅ exact match first
      let idx = normLectureTitles.findIndex(t => t === normTitle);

      // 🔄 fallback to fuzzy match (strict)
      if (idx === -1) {
        const { bestMatch } = stringSimilarity.findBestMatch(normTitle, normLectureTitles);
        if (bestMatch.rating >= 0.85) {
          idx = normLectureTitles.indexOf(bestMatch.target);
        }
      }

      if (idx !== -1) {
        const found = lectures[idx];
        if (found && found.videoUrl) {
          videoUrl = found.videoUrl;
          break;
        }
      }
    }

    if (!videoUrl) {
      return res.status(404).json({ error: 'Video not found in any file' });
    }

    // YouTube link?
    if (/youtube\.com|youtu\.be/.test(videoUrl)) {
      return res.json({ success: true, youtube: true, videoUrl });
    }

    // Extract JWT token from the custom stream URL
    const match = videoUrl.match(/https:\/\/stream\.pwjarvis\.(?:com|app)\/([^\/]+)\/hls/);
    if (!match || !match[1]) {
      return res.status(500).json({ error: 'Invalid videoUrl format or token not found' });
    }

    const token   = match[1];
    const corsUrl = `https://cors.pwjarvis.com/${token}/master.mpd`;

    const fetchRes = await axios.get(`https://pwplayer2-8edb00b87f57.herokuapp.com/get-proxy?url=${encodeURIComponent(corsUrl)}`);
    if (fetchRes.data.status !== 'success') {
      return res.status(502).json({ error: 'Technfetch failed', details: fetchRes.data });
    }

    const rawUrl = fetchRes.data.m3u8_url;
    const encryptionKey = crypto.createHash('sha256')
      .update("$2y$30$YgSaj3OmNEt/PLyk49Zq.uPi52W4/l2DLOKEEIkfgyxZXdITbYE2C")
      .digest()
      .slice(0, 32);
    const iv     = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
    let encrypted = cipher.update(rawUrl, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return res.json({
      success: true,
      signed_url: encrypted,
      video_id: iv.toString('base64')
    });

  } catch (err) {
    console.error('❌ stream-info error:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// ---------------------
// Main API Route (Updated)
// ---------------------
app.get('/api/video/stream-url', async (req, res) => {
  // 1. Receive new parameters: batchId and scheduleId
  const { batchId, scheduleId } = req.query;
  if (!batchId || !scheduleId) {
    return res.status(400).json({ error: 'Missing batchId or scheduleId in query' });
  }

  try {
    // -------------------------------------------------------------------
    // Step 2: Fetch Batch Name and Schedule Details in Parallel
    // -------------------------------------------------------------------

    const batchDetailsUrl = `https://api.penpencil.co/v3/batches/${batchId}/details`;
    const scheduleDataUrl = `https://master-api-v3-27ff31969c1c.herokuapp.com/pw/schedule-data/${batchId}/subject/0/${scheduleId}/eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE3NTcwMDAxMTUuODY4LCJkYXRhIjp7Il9pZCI6IjYwYmU0ZjRlYWRhODgxMDAxMTgyOTlkMSIsInVzZXJuYW1lIjoiOTE2NjY4NzAxNCIsImZpcnN0TmFtZSI6IkRpcGVzaCIsImxhc3ROYW1lIjoiWWFkYXYiLCJvcmdhbml6YXRpb24iOnsiX2lkIjoiNWViMzkzZWU5NWZhYjc0NjhhNzlkMTg5Iiwid2Vic2l0ZSI6InBoeXNpY3N3YWxsYWguY29tIiwibmFtZSI6IlBoeXNpY3N3YWxsYWgifSwiZW1haWwiOiJkaXBlc2h5NjM2QGdtYWlsLmNvbSIsInJvbGVzIjpbIjViMjdiZDk2NTg0MmY5NTBhNzc4YzZlZiJdLCJjb3VudHJ5R3JvdXAiOiJJTiIsIm9uZVJvbGVzIjpbXSwidHlwZSI6IlVTRVIifSwiaWF0IjoxNzU2Mzk1MzE1fQ.sWkm8E_kd1KWl7jDzdQZygpqjI42wHwTjUqvt0D677U?authorization=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMTM0NTIzNTU3NiIsInRnX3VzZXJuYW1lIjoiQFJFREdBTUlOR0lERkYiLCJpYXQiOjE3NTYzODA0ODV9.9D_rx80xXecE7yfE9aeXoptkFIub0RVvA6ss41PKJ08`;
    
    // Create promises for both API calls
    const batchPromise = axios.get(batchDetailsUrl);
    const schedulePromise = axios.get(scheduleDataUrl);

    // Use Promise.all to execute them in parallel
    const [batchResponse, scheduleResponse] = await Promise.all([batchPromise, schedulePromise]);

    // Extract data from the resolved promises
    const batch = batchResponse.data?.data?.name;
    const scheduleData = scheduleResponse.data?.data;
    
    const subject = scheduleData?.subject?.name;
    const topic = scheduleData?.tags?.[0]; // Takes the first tag as the topic
    const title = scheduleData?.topic; // Lecture title from schedule data's "topic" field

    // Validate that all required data was fetched successfully
    if (!batch || !subject || !topic || !title) {
      return res.status(404).json({ error: 'Could not fetch required details from external APIs.' });
    }

    // -------------------------------------------------------------------
    // Step 3: Use the fetched data in the existing logic
    // -------------------------------------------------------------------

    const normBatch = normalizeTitle(batch);
    const normSubject = normalizeTitle(subject);
    const normTopic = normalizeTitle(topic);
    const normTitle = normalizeTitle(title);

    const files = fs.readdirSync(__dirname).filter(f => f.startsWith('data') && f.endsWith('.json'));
    let videoUrl = null;

    // The rest of the file searching logic remains exactly the same...
    for (const file of files) {
      const content = JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf-8'));

      const batchKey = Object.keys(content.batches || {}).find(b => normalizeTitle(b) === normBatch);
      if (!batchKey) continue;

      const subjectKey = Object.keys(content.batches[batchKey].subjects || {}).find(s => normalizeTitle(s) === normSubject);
      if (!subjectKey) continue;

      const topicKey = Object.keys(content.batches[batchKey].subjects[subjectKey].topics || {}).find(t => normalizeTitle(t) === normTopic);
      if (!topicKey) continue;

      const lectures = content.batches[batchKey].subjects[subjectKey].topics[topicKey].lectures || [];
      const normLectureTitles = lectures.map(l => normalizeTitle(l.title || ''));

      // ✅ exact match first
      let idx = normLectureTitles.findIndex(t => t === normTitle);

      // 🔄 fallback to fuzzy match (strict)
      if (idx === -1) {
        const { bestMatch } = stringSimilarity.findBestMatch(normTitle, normLectureTitles);
        if (bestMatch.rating >= 0.85) {
          idx = normLectureTitles.indexOf(bestMatch.target);
        }
      }

      if (idx !== -1) {
        const found = lectures[idx];
        if (found && found.videoUrl) {
          videoUrl = found.videoUrl;
          break;
        }
      }
    }

    if (!videoUrl) {
      return res.status(404).json({ error: 'no token found for this batch' });
    }
    
    // The rest of the response logic remains the same...
    if (/youtube\.com|youtu\.be/.test(videoUrl)) {
      return res.json({ success: true, youtube: true, videoUrl });
    }

    const match = videoUrl.match(/https:\/\/stream\.pwjarvis\.(?:com|app)\/([^\/]+)\/hls/);
    if (!match || !match[1]) {
      return res.status(500).json({ error: 'Invalid videoUrl format or token not found' });
    }

    const token = match[1];
    const corsUrl = `https://cors.pwjarvis.com/${token}/master.mpd`;

    const fetchRes = await axios.get(`https://pwplayer2-8edb00b87f57.herokuapp.com/get-proxy?url=${encodeURIComponent(corsUrl)}`);
    if (fetchRes.data.status !== 'success') {
      return res.status(502).json({ error: 'Technfetch failed', details: fetchRes.data });
    }

    const rawUrl = fetchRes.data.m3u8_url;
    const encryptionKey = crypto.createHash('sha256')
      .update("$2y$30$YgSaj3OmNEt/PLyk49Zq.uPi52W4/l2DLOKEEIkfgyxZXdITbYE2C")
      .digest()
      .slice(0, 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
    let encrypted = cipher.update(rawUrl, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    return res.json({
      success: true,
      signed_url: encrypted,
      video_id: iv.toString('base64')
    });

  } catch (err) {
    console.error('❌ stream error:', err);
    // Provide more specific error info if it's an axios error
    if (err.response) {
        return res.status(500).json({ error: 'Error fetching data from external API.', details: { status: err.response.status, data: err.response.data } });
    }
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

// API to return local batch data from batches.json
app.get('/api/batches', (req, res) => {
  const dirPath = __dirname;
  let allBatches = [];

  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 12;
  const searchQuery = (req.query.q || '').toLowerCase().trim();
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  try {
    // 1. Load all batches*.json files
    const files = fs.readdirSync(dirPath)
                    .filter(f => /^batches.*\.json$/.test(f));

    // 2. Merge all batches
    files.forEach(file => {
      const { batches = [] } = JSON.parse(
        fs.readFileSync(path.join(dirPath, file), 'utf8')
      );
      allBatches = allBatches.concat(batches);
    });

    // 3. Dedupe by _id
    const seen = new Set();
    allBatches = allBatches.filter(batch => {
      if (seen.has(batch._id)) return false;
      seen.add(batch._id);
      return true;
    });

    // 4. Optional search by title/name
    if (searchQuery) {
      allBatches = allBatches.filter(batch =>
        (batch.name || batch.title || '').toLowerCase().includes(searchQuery)
      );
    }

    // 5. Paginate
    const paginatedBatches = allBatches.slice(startIndex, endIndex);

    res.json({
      success: true,
      total: allBatches.length,
      page,
      limit,
      totalPages: Math.ceil(allBatches.length / limit),
      batches: paginatedBatches
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'Failed to load batch data',
      details: err.message
    });
  }
});

// New API: Get batches by specific IDs (for favorites)
app.get('/api/batches/by-ids', (req, res) => {
  const idsParam = req.query.ids;
  if (!idsParam) {
    return res.status(400).json({ success: false, error: "Missing ids query param" });
  }

  const requestedIds = idsParam.split(',').map(id => id.trim());
  const dirPath = __dirname;
  let allBatches = [];

  try {
    // Load all batch JSON files
    const files = fs.readdirSync(dirPath)
                    .filter(f => /^batches.*\.json$/.test(f));

    files.forEach(file => {
      const { batches = [] } = JSON.parse(
        fs.readFileSync(path.join(dirPath, file), 'utf8')
      );
      allBatches = allBatches.concat(batches);
    });

    // Filter only the batches that match the requested IDs
    const result = allBatches.filter(batch => requestedIds.includes(batch._id));

    res.json({
      success: true,
      batches: result
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch batches by IDs',
      details: err.message
    });
  }
});


app.get('/api/url', async (req, res) => {
  const { batch_id, schedule_id } = req.query;

  if (!batch_id || !schedule_id) {
    return res.status(400).json({ error: 'batch_id and schedule_id are required' });
  }

  const tokenFiles = [
    'valid_token_batches.json',
    'valid_token_batches1.json',
    'valid_token_batches2.json'
  ];
  let tokens = [];

  try {
    for (const file of tokenFiles) {
      const filePath = path.join(__dirname, file);
      if (fs.existsSync(filePath)) {
        tokens = tokens.concat(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
      }
    }
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read token files', details: err.message });
  }

  const matchingTokens = tokens.filter(t => t.batches?.some(b => b.batchId === batch_id));

  const penPencilFallback = async () => {
    const penpencilRes = await axios.post(
      'https://urlsignp-ecfe0b9e68c2.herokuapp.com/get-signed-url',
      { batch_id, schedule_id, tokens: matchingTokens },
      { timeout: 15000 }
    );
    if (penpencilRes.data.success && penpencilRes.data.signed_url) {
      return { videoUrl: penpencilRes.data.signed_url };
    }
    throw new Error('PenPencil failed');
  };

  // ✅ --- THIS FUNCTION IS NOW UPDATED TO USE getAccessToken() ---
  const alphaApiFallback = async (schedule_id, batch_id) => { // <-- 1. Add parameters

    // Since this API does not seem to require an access token, 
    // we've removed the getAccessToken() call and related logic.

    const apiUrl = `https://pw-pvt.vercel.app/api/video-server2?find_key=${schedule_id}&bid=${batch_id}`;
    
    // Headers are included but simplified, as an Authorization token is not used here.
    const headers = {
        'referer': 'https://pw-pvt.vercel.app/', // Changed to match the API domain
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
    };
    
    try {
        const res = await axios.get(apiUrl, { headers, timeout: 15000 });

        // Destructure the response data
        const { success, mpdUrl, error } = res.data;

        // Check for success flag and the existence of mpdUrl
        if (!success || !mpdUrl) {
            // Throw an error if the API reports failure or missing URL
            const errorMessage = error ? `: ${error}` : '';
            throw new Error(`Video Server 2 API call failed${errorMessage}`);
        }

        // Return the extracted mpdUrl in the desired format
        return { videoUrl: mpdUrl };
        
    } catch (err) {
        // Log the error with the correct function name
        console.error("Error in alphaApiFallback:", err.message); // <-- 2. Update error message
        
        // Throw a consistent error for the calling function
        throw new Error('Video Server 2 API failed to fetch video URL.');
    }
};

const powerStudyFallback = async () => {
    // 1. The URL of your NEW Heroku API, with the updated parameters
    //    - `childId` now uses the `schedule_id`
    //    - `batchId` now uses the `batch_id`
    const apiUrl = `https://pwverse-api-2a6a8dfb6269.herokuapp.com/decrypt?batchId=${batch_id}&childId=${schedule_id}`;

    try {
        // 2. Make a direct GET request to your Heroku app
        const response = await axios.get(apiUrl, {
            timeout: 20000 // Keep a longer timeout, as this is a good practice
        });

        // 3. Access the nested 'data' object from your API's response
        const responseData = response.data.data;
        
        // 4. Check if the 'data' object and its 'url' and 'signedUrl' keys exist
        if (!responseData || !responseData.url || !responseData.signedUrl) {
            // This error will be thrown if the API response is not as expected
            console.error("API response missing expected 'data' object or 'url'/'signedUrl' keys:", response.data);
            throw new Error('API failed: "data.url" or "data.signedUrl" not found');
        }

        // 5. Combine the 'url' and 'signedUrl' as requested
        const combinedVideoUrl = responseData.url + responseData.signedUrl;

        // 6. Return the data in the same { videoUrl: "..." } format as the old function
        return { videoUrl: combinedVideoUrl };

    } catch (error) {
        // This will catch network errors or if your Heroku app returns an error status (like 502)
        console.error("Request to Heroku API failed:", error.response ? error.response.data : error.message);
        throw new Error('API failed');
    }
};


  // ✅ --- NEW FALLBACK FUNCTION ---
    const urliveFallback = async () => {
// 1. The URL of your NEW Heroku API, with the updated parameters
    //    - `childId` now uses the `schedule_id`
    //    - `batchId` now uses the `batch_id`
    const apiUrl = `https://apipower-1f9e5760010a.herokuapp.com/api/get-video?batchId=${batch_id}&childId=${schedule_id}`;

    try {
        // 2. Make a direct GET request to your Heroku app
        const response = await axios.get(apiUrl, {
            timeout: 20000 // Keep a longer timeout, as this is a good practice
        });

        // 3. Access the nested 'data' object from your API's response
        const responseData = response.data.data;
        
        // 4. Check if the 'data' object and its 'url' and 'signedUrl' keys exist
        if (!responseData || !responseData.url || !responseData.signedUrl) {
            // This error will be thrown if the API response is not as expected
            console.error("API response missing expected 'data' object or 'url'/'signedUrl' keys:", response.data);
            throw new Error('API failed: "data.url" or "data.signedUrl" not found');
        }

        // 5. Combine the 'url' and 'signedUrl' as requested
        const combinedVideoUrl = responseData.url + responseData.signedUrl;

        // 6. Return the data in the same { videoUrl: "..." } format as the old function
        return { videoUrl: combinedVideoUrl };

    } catch (error) {
        // This will catch network errors or if your Heroku app returns an error status (like 502)
        console.error("Request to Heroku API failed:", error.response ? error.response.data : error.message);
        throw new Error('API failed');
    }
};

const htmlScrapeFallback = async (req) => {
    // The target URL to scrape, constructed from the request parameters
    const fallbackUrl = `https://streamfiles.eu.org/play.php?video_id=${schedule_id}&batch_id=${batch_id}`;

    // Perform the GET request to fetch the HTML content
    const htmlRes = await axios.get(fallbackUrl, {
        headers: {
            // Forward the user's headers to mimic a real browser visit
            'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': 'text/html',
            'Accept-Language': req.headers['accept-language'] || 'en-US,en;q=0.9',
            'Referer': 'https://streamfiles.eu.org/',
            'Connection': 'keep-alive'
        },
        timeout: 20000 // Set a timeout for the request
    });

    // Load the HTML response into Cheerio for easy DOM manipulation
    const $ = cheerio.load(htmlRes.data);

    // Find the encrypted video URL from the hidden input field in the HTML
    const encryptedVideoUrl = $("#encrypted_video_url").val();
    
    // If no encrypted URL is found, the scrape failed.
    if (!encryptedVideoUrl) {
        throw new Error('Scrape fallback failed: Could not find encrypted_video_url input field.');
    }

    /**
     * Decrypts a Base64 encoded string using AES-256-CBC.
     * This logic is a direct port of the Python decryption script.
     * @param {string} encryptedBase64 - The Base64 encoded string to decrypt.
     * @returns {string} The decrypted string.
     */
    const decryptData = (encryptedBase64) => {
        try {
            // The static key and IV must match the ones used for encryption.
            const keyOfCa = "j@-5V@01+;zsTqltxp^OKPDJK9v@(')2";
            const ivOfCa = "VpK}59&KH}~hwmZy";

            // 1. Derive the key: SHA-256 hash of the key string.
            const key = crypto.createHash('sha256').update(keyOfCa).digest();

            // 2. Prepare the IV: Use the 16-byte IV string directly.
            const iv = Buffer.from(ivOfCa, 'utf-8');

            // 3. Decode the Base64 input into a buffer of encrypted bytes.
            const encryptedBytes = Buffer.from(encryptedBase64, 'base64');

            // 4. Create the decipher object with the key, IV, and AES-256-CBC algorithm.
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

            // 5. Decrypt the data. Node's crypto handles unpadding by default.
            let decrypted = decipher.update(encryptedBytes);
            decrypted = Buffer.concat([decrypted, decipher.final()]);

            // 6. Return the decrypted buffer as a UTF-8 string.
            return decrypted.toString('utf-8');
        } catch (error) {
            console.error("Decryption error in scrape fallback:", error);
            return ""; // Return empty string on failure
        }
    };

    // Decrypt the video URL scraped from the HTML
    const videoUrl = decryptData(encryptedVideoUrl);

    // If decryption fails, videoUrl will be empty. Treat this as a failure.
    if (!videoUrl) {
        throw new Error('Scrape fallback failed: Could not decrypt video URL.');
    }

    // Return the decrypted URL in the same structure as the other fallback functions.
    // The `processFinalUrl` function will handle the final encryption.
    return {
        videoUrl: videoUrl,
        pallyToken: null // No pallyToken is available from this source
    };
};


function encryptAndRespond(videoUrl, pallyToken, res) {
  const encryptionKey = crypto.createHash('sha256')
    .update("$2y$30$YsikndaoonbdsujbEt/PLyk49Zq.uPi52W4/l6DLOKEEIkfgyxZXdITbYE9C")
    .digest()
    .slice(0, 32);

  const encryptValue = (text) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', encryptionKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return {
      encrypted,
      iv: iv.toString('base64')
    };
  };

  const urlEncrypted = encryptValue(videoUrl);
  const pallyEncrypted = pallyToken ? encryptValue(pallyToken) : null;

  const response = {
    success: true,
    signed_url: urlEncrypted.encrypted,
    video_id: urlEncrypted.iv
  };

  if (pallyEncrypted?.encrypted && pallyEncrypted?.iv) {
    response.pally_data = pallyEncrypted.encrypted;
    response.pally_iv = pallyEncrypted.iv;
  }

  return res.json(response);
}

// ✅ THIS IS THE UPDATED FUNCTION
  const processFinalUrl = async (url, res, pallyToken = null) => {
    // Check if the URL needs proxying. This is now true if:
    // 1. It's the old 'next-api.infoaihub.com' URL.
    // OR
    // 2. It's a CloudFront URL that ends with '.mpd'.
    const isCloudFrontMpd = url.includes('d1d34p8vz63oiq.cloudfront.net') && new URL(url).pathname.endsWith('.mpd');
    const needsProxy = url.includes('next-api.infoaihub.com/pw-multi-stream') || isCloudFrontMpd;

    try {
      let finalUrl = url;
      if (needsProxy) {
        console.log('Proxying URL:', url); // Optional: for debugging
        const fetchRes = await axios.get(`https://pwplayer2-8edb00b87f57.herokuapp.com/get-proxy?url=${encodeURIComponent(url)}`);
        
        if (fetchRes.data.status !== 'success' || !fetchRes.data.m3u8_url) {
          return res.status(502).json({ error: 'Proxy fetch failed', details: fetchRes.data });
        }
        finalUrl = fetchRes.data.m3u8_url;
      }
      return encryptAndRespond(finalUrl, pallyToken, res);
    } catch (err) {
      return res.status(502).json({ error: 'Proxy fetch exception', details: err.message });
    }
  };


  try {
    const fallbackCalls = [];

    if (matchingTokens.length > 0) {
      fallbackCalls.push(penPencilFallback());
    }

    fallbackCalls.push(
      powerStudyFallback(),
      alphaApiFallback(schedule_id, batch_id),
      htmlScrapeFallback(req),
      urliveFallback()
    );

    const result = await Promise.any(fallbackCalls);
return await processFinalUrl(result.videoUrl, res, result.pallyToken);
  } catch (err) {
    return res.status(502).json({
      success: false,
      error: 'All video sources failed.',
      details: err.message
    });
  }
});

app.get('/api/urldec', async (req, res) => {
    const { batch_id, schedule_id } = req.query;

    if (!batch_id || !schedule_id) {
        return res.status(400).json({ error: 'batch_id and schedule_id are required' });
    }

    // --- Token Logic ---
    const tokenFiles = ['valid_token_batches.json', 'valid_token_batches1.json', 'valid_token_batches2.json'];
    let tokens = [];
    try {
        for (const file of tokenFiles) {
            const filePath = path.join(__dirname, file);
            if (fs.existsSync(filePath)) {
                tokens = tokens.concat(JSON.parse(fs.readFileSync(filePath, 'utf-8')));
            }
        }
    } catch (err) {}
    const matchingTokens = tokens.filter(t => t.batches?.some(b => b.batchId === batch_id));

    // --- Updated penPencilFallback with Conversion ---
    const penPencilFallback = async () => {
        const response = await axios.post(
            'https://usign123-cec645023b36.herokuapp.com/get-signed-url',
            { batch_id, schedule_id, tokens: matchingTokens },
            { timeout: 15000 }
        );

        const raw = response.data;
        if (raw.success && raw.signed_url) {
            // Split the URL into base and query parameters
            const [baseUrl, queryParams] = raw.signed_url.split('?');

            return {
                success: true,
                data: {
                    url: baseUrl,
                    signedUrl: queryParams ? `?${queryParams}` : "",
                    urlType: "penpencilvdo",
                    scheduleInfo: {
                        startTime: new Date().toISOString(), // Adjust if you have actual schedule data
                        endTime: new Date().toISOString()
                    },
                    videoContainer: "DASH",
                    isCmaf: false,
                    serverTime: Date.now(),
                    cdnType: "Gcp"
                },
                dataFrom: "Media Api Service"
            };
        }
        throw new Error('PenPencil failed');
    };
  const alphaApiFallback = async (schedule_id, batch_id) => {
    const apiUrl = `https://pw-pvt.vercel.app/api/video-server2?find_key=${schedule_id}&bid=${batch_id}`;
    
    const response = await axios.get(apiUrl, {
        headers: { 'referer': 'https://pw-pvt.vercel.app/' },
        timeout: 15000
    });

    const rawData = response.data;

    if (rawData.success) {
        // Logic to split the URL and the Signature
        const fullMpdUrl = rawData.mpdUrl || "";
        const urlParts = fullMpdUrl.split('?');
        const baseUrl = urlParts[0];
        const signature = urlParts[1] ? `?${urlParts[1]}` : "";

        // Constructing the format you want
        return {
            success: true,
            data: {
                cdnType: "Gcp", // Defaulting to Gcp as seen in your example
                isCmaf: false,
                scheduleInfo: {
                    endTime: new Date().toISOString(), // Fallback to current time or null
                    startTime: new Date().toISOString()
                },
                serverTime: Date.now(),
                signedUrl: signature,
                url: baseUrl,
                urlType: "penpencilvdo"
            },
            dataFrom: "Alpha API Service (Converted)",
            // You can also keep the DRM keys if you need them for your player
            drm: rawData.drm 
        };
    }
    
    throw new Error('AlphaApi failed');
};
    const powerStudyFallback = async () => {
        const apiUrl = `https://pwverse-api-2a6a8dfb6269.herokuapp.com/decrypt?batchId=${batch_id}&childId=${schedule_id}`;
        const response = await axios.get(apiUrl, { timeout: 20000 });
        // Checking for the existence of the expected data property
        if (response.data && response.data.data) return response.data; 
        throw new Error('PowerStudy failed');
    };

    const urliveFallback = async () => {
        const url = `https://apipower-1f9e5760010a.herokuapp.com/api/get-video?batchId=${batch_id}&childId=${schedule_id}`;
        const response = await axios.get(url, { timeout: 20000 });
        if (response.data.success) return response.data; // Return full body
        throw new Error('URLive failed');
    };

    // Note: htmlScrapeFallback should be modified in your main code 
    // to return its full internal object if you want the raw scraping result.

    try {
        const fallbackCalls = [
            powerStudyFallback(),
            alphaApiFallback(schedule_id, batch_id),
            urliveFallback()
        ];

        if (matchingTokens.length > 0) {
            fallbackCalls.push(penPencilFallback());
        }

        // Execute all and get the first successful RAW response
        const fullRawData = await Promise.any(fallbackCalls);

        // Send the exact data received from the source API
        return res.json(fullRawData);

    } catch (err) {
        return res.status(502).json({
            success: false,
            error: 'All sources failed to provide a response.',
            details: err.message
        });
    }
});

// Updated API: Strictly restricted to penpencilvdo and past dates
app.get('/api/new/dec', async (req, res) => {
    const { batchid, scheduleid } = req.query;

    if (!batchid || !scheduleid) {
        return res.status(400).json({ error: 'batchid and scheduleid are required query parameters' });
    }

    try {
        // 1. Call the existing content endpoint internally
        const contentUrl = `http://127.0.0.1:${process.env.PORT || 3000}/api/batch/${batchid}/subject/0/schedule/${scheduleid}/content`;
        const contentResponse = await axios.get(contentUrl);
        
        const scheduleData = contentResponse.data?.data;
        if (!scheduleData) {
            return res.status(404).json({ success: false, error: 'Schedule data not found' });
        }

        // 2. Identify urlType
        const urlType = scheduleData.urlType;

        // 3. STRICT CHECK: Only work if urlType is "penpencilvdo"
        if (urlType !== "penpencilvdo") {
            return res.status(403).json({ 
                success: false, 
                error: 'Access denied: This endpoint only works for penpencilvdo content types.' 
            });
        }

        // 4. DATE CHECK: Compare class date to today
        const classDate = scheduleData.date.split('T')[0];
        const todayDate = new Date().toISOString().split('T')[0];

        if (classDate === todayDate) {
            return res.json({ 
                success: false, 
                message: "dont play todays class, play yesterday one" 
            });
        }

        if (classDate > todayDate) {
            return res.json({ 
                success: false, 
                message: "Class has not started yet" 
            });
        }

        // 5. PROCEED ONLY IF CLASS DATE < TODAY DATE
        const videoUrl = scheduleData.videoDetails?.videoUrl || scheduleData.url;
        if (!videoUrl) {
            return res.status(404).json({ success: false, error: 'videoUrl not found' });
        }

        // 6. Modify the domain
        const mpd_url = videoUrl;

        // 7. Get a random access token from valid_token_batches1.json
        const tokensPath = path.join(__dirname, 'valid_token_batches1.json');
        const tokensData = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        const randomEntry = tokensData[Math.floor(Math.random() * tokensData.length)];
        const access_token = randomEntry.access_token;

        // 8. Call the external decryption API
        const decryptApiUrl = "https://ufull12-8a729a108029.herokuapp.com/decrypt";
        const decryptResponse = await axios.post(decryptApiUrl, {
            access_token,
            mpd_url
        }, {
            headers: { "Content-Type": "application/json" },
            timeout: 30000
        });

        let finalData = decryptResponse.data;

        // 9. Proxy step for CloudFront URLs
        if (finalData.success && finalData.final_url && finalData.final_url.includes('cloudfront.net')) {
            try {
                const proxyBaseUrl = "https://pwthorproxyy-95e01ea8c27e.herokuapp.com/get-proxy";
                const proxyResponse = await axios.get(proxyBaseUrl, {
                    params: { url: finalData.final_url },
                    timeout: 15000
                });

                if (proxyResponse.data.status === "success" && proxyResponse.data.m3u8_url) {
                    finalData.final_url = proxyResponse.data.m3u8_url;
                }
            } catch (proxyErr) {
                console.error('⚠️ Proxy step failed:', proxyErr.message);
            }
        }

        res.json(finalData);

    } catch (err) {
        console.error('❌ /api/new/dec error:', err.message);
        res.status(err.response?.status || 500).json({
            success: false,
            error: 'Failed to process request',
            details: err.response?.data || err.message
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
