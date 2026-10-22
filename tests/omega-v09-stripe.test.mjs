import test from 'node:test'; import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyStripeSignature } from '../lib/omega-v09-stripe.mjs';
const now = 1792592708, raw = '{"data":"test"}', secret = 'whsec_test_1234567890123456';
const sig = createHmac('sha256',secret).update(`${now}.${raw}`).digest('hex');
test('Stripe firma valida',()=>assert.equal(verifyStripeSignature(raw,`t=${now},v1=${sig}`,secret,now),true));
test('rechaza mensaje alterado',()=>assert.equal(verifyStripeSignature(raw+'x',`t=${now},v1=${sig}`,secret,now),false));
test('rechaza reproduccion fuera de 5 minutos',()=>assert.equal(verifyStripeSignature(raw,`t=${now},v1=${sig}`,secret,now+310),false));
test('rechaza firma malformada',()=>assert.equal(verifyStripeSignature(raw,'t=xxx,v1=bad',secret,now),false));
