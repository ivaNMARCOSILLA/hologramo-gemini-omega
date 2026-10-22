import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyStripeSignature(raw, header, secret, now = Math.floor(Date.now()/1000)) {
  if (typeof raw !== 'string' || typeof header !== 'string' || typeof secret !== 'string' || secret.length < 10) return false;
  const fields = header.split(',').map(x => x.trim());
  const timestamp = fields.find(x => x.startsWith('t='))?.slice(2);
  const signatures = fields.filter(x => x.startsWith('v1=')).map(x => x.slice(3));
  if (!timestamp || !/^\d{10,}$/.test(timestamp) || Math.abs(now - Number(timestamp)) > 300) return false;
  const expected = createHmac('sha256', secret).update(timestamp + '.' + raw).digest('hex');
  return signatures.some(sig => {
    if (!/^[a-f\d]{64}$/.test(sig)) return false;
    const a = Buffer.from(sig, 'hex'); const b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a,b);
  });
}
