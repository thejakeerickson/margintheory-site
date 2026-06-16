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
  const phone = (body?.phone || '').trim();
  const stage = STAGE_SLUGS.includes(body?.stage || '') ? body!.stage! : 'unknown';
  const employees = (body?.employees || '').trim();
  const revenue = (body?.revenue || '').trim();
  const ownership = (body?.ownership || '').trim();

  const customFields = [
    { name: 'First Name', value: name },
    { name: 'Phone', value: phone },
    { name: 'Maturity Stage', value: stage },
    { name: 'Employees', value: employees },
    { name: 'Revenue Band', value: revenue },
    { name: 'Ownership', value: ownership },
  ].filter((f) => f.value);

  // 1) Beehiiv subscribe (non-blocking; the client redirects to the stage page regardless)
  try {
    const r = await fetch(
      `https://api.beehiiv.com/v2/publications/${pubId}/subscriptions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
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
    if (!r.ok) console.error(`maturity-model: beehiiv ${r.status}: ${await r.text()}`);
  } catch (err) {
    console.error('maturity-model: beehiiv error', err);
  }

  // 2) Capsule CRM lead (non-blocking). Needs CAPSULE_API_TOKEN on Vercel.
  // De-dupes by email so repeat submits don't pile up duplicate leads.
  const capsuleToken = process.env.CAPSULE_API_TOKEN;
  if (capsuleToken) {
    try {
      const cHeaders = {
        Authorization: `Bearer ${capsuleToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      let exists = false;
      const search = await fetch(
        `https://api.capsulecrm.com/api/v2/parties/search?q=${encodeURIComponent(email)}`,
        { headers: cHeaders }
      );
      if (search.ok) {
        const sj = (await search.json()) as { parties?: Array<{ emailAddresses?: Array<{ address?: string }> }> };
        exists = (sj.parties || []).some((p) =>
          (p.emailAddresses || []).some((e) => (e.address || '').toLowerCase() === email)
        );
      }
      if (!exists) {
        const about = `Business Maturity Model lead. Stage: ${stage}. Employees: ${employees || 'n/a'}, revenue ${revenue || 'n/a'}, ownership ${ownership || 'n/a'}. Source: margintheory.co/maturity-model.`;
        const party: Record<string, unknown> = {
          type: 'person',
          firstName: name || 'Maturity Model',
          lastName: name ? '' : 'Lead',
          about,
          emailAddresses: [{ type: 'Work', address: email }],
          tags: [{ name: 'Maturity Model' }],
        };
        if (phone) party.phoneNumbers = [{ type: 'Mobile', number: phone }];
        const create = await fetch('https://api.capsulecrm.com/api/v2/parties', {
          method: 'POST',
          headers: cHeaders,
          body: JSON.stringify({ party }),
        });
        if (!create.ok) console.error(`maturity-model: capsule create ${create.status}: ${await create.text()}`);
      }
    } catch (err) {
      console.error('maturity-model: capsule error', err);
    }
  }

  return res.status(200).json({ ok: true, stage });
}
