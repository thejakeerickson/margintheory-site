import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/subscribe
 *
 * Body: { email: string }
 *
 * Subscribes the email to the Margin Theory Beehiiv publication with
 * utm_campaign = "flash-report" so a Beehiiv automation can route them
 * the welcome email + GitHub link.
 *
 * Required Vercel env vars:
 *   BEEHIIV_API_KEY         - publication-scoped API key (Settings > Integrations > API)
 *   BEEHIIV_PUBLICATION_ID  - the pub_xxxxx id from publication settings
 *
 * Optional:
 *   FLASH_REPORT_GITHUB_URL - returned in response so the page can reveal it inline.
 *                             Default: https://github.com/thejakeerickson/flash-report
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS: same-origin only; reject other origins.
  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'POST');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.BEEHIIV_API_KEY;
  const pubId = process.env.BEEHIIV_PUBLICATION_ID;

  if (!apiKey || !pubId) {
    console.error('subscribe: missing BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID');
    return res.status(500).json({ error: 'Subscribe is not configured.' });
  }

  let email: string | undefined;
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    email = body?.email?.trim().toLowerCase();
  } catch {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const githubUrl =
    process.env.FLASH_REPORT_GITHUB_URL ||
    'https://github.com/thejakeerickson/flash-report';

  try {
    const r = await fetch(
      `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          email,
          reactivate_existing: true,
          send_welcome_email: true,
          utm_source: 'flash-report-landing',
          utm_medium: 'landing-page',
          utm_campaign: 'flash-report',
          referring_site: 'https://margintheory.co/flash',
        }),
      }
    );

    if (!r.ok) {
      const detail = await r.text();
      console.error(`subscribe: beehiiv ${r.status}: ${detail}`);
      return res.status(502).json({
        error: 'Something went wrong on our end. Try again or email jake@margintheory.co.',
      });
    }

    return res.status(200).json({
      ok: true,
      github_url: githubUrl,
    });
  } catch (err) {
    console.error('subscribe: network error', err);
    return res.status(502).json({
      error: 'Something went wrong on our end. Try again or email jake@margintheory.co.',
    });
  }
}
