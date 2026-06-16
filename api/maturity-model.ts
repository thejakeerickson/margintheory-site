import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * POST /api/maturity-model
 *
 * Body: { name?, email, employees?, revenue?, ownership?, stage? }
 *
 * Captures a Business Maturity Model quiz completion to the Margin Theory
 * Beehiiv publication. utm_campaign = "maturity-model" so a Beehiiv automation
 * can route the stage-specific follow-up; the answers ride along as custom
 * fields so the list doubles as an ICP screen (employees + revenue + ownership).
 *
 * Required Vercel env vars (same as /api/subscribe):
 *   BEEHIIV_API_KEY
 *   BEEHIIV_PUBLICATION_ID
 *
 * The client treats this as non-blocking: it redirects to the stage page
 * whether or not this succeeds, so a missing env var in local dev is harmless.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const STAGE_SLUGS = [
  'foundation', 'validation', 'traction', 'structure', 'focus',
  'expansion', 'efficiency', 'systems', 'division', 'reinvention',
];

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    console.error('maturity-model: missing BEEHIIV_API_KEY or BEEHIIV_PUBLICATION_ID');
    return res.status(500).json({ error: 'Capture is not configured.' });
  }

  let body: Record<string, string | undefined>;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid request body.' });
  }

  const email = body?.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const name = (body?.name || '').trim();
  const stage = STAGE_SLUGS.includes(body?.stage || '') ? body!.stage! : 'unknown';
  const employees = (body?.employees || '').trim();
  const revenue = (body?.revenue || '').trim();
  const ownership = (body?.ownership || '').trim();

  const customFields = [
    { name: 'First Name', value: name },
    { name: 'Maturity Stage', value: stage },
    { name: 'Employees', value: employees },
    { name: 'Revenue Band', value: revenue },
    { name: 'Ownership', value: ownership },
  ].filter((f) => f.value);

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
          utm_source: 'maturity-model',
          utm_medium: 'quiz',
          utm_campaign: 'maturity-model',
          referring_site: 'https://margintheory.co/maturity-model',
          custom_fields: customFields,
        }),
      }
    );

    if (!r.ok) {
      const detail = await r.text();
      console.error(`maturity-model: beehiiv ${r.status}: ${detail}`);
      return res.status(502).json({ error: 'Capture failed upstream.' });
    }

    return res.status(200).json({ ok: true, stage });
  } catch (err) {
    console.error('maturity-model: network error', err);
    return res.status(502).json({ error: 'Capture failed.' });
  }
}
