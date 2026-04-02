// Vercel Serverless Function Proxy for Anthropic API
// This allows the frontend to call Anthropic API from any origin (to bypass CORS)

export default async function handler(req, res) {
  // CORS handles
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-api-key, anthropic-version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // リクエストURLの末尾（/v1/messagesなど）を抽出
  // APIへのリクエストは /api/anthropic/v1/messages のような形式を想定
  const path = req.url.split('/api/anthropic')[1] || '';
  const targetUrl = `https://api.anthropic.com${path}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'content-type': 'application/json',
        'x-api-key': req.headers['x-api-key'],
        'anthropic-version': req.headers['anthropic-version'] || '2023-06-01',
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({ error: 'Failed to proxy request to Anthropic' });
  }
}
