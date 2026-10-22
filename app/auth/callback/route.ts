import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const u = new URL(request.url);
  const code = u.searchParams.get('code');
  const dest = new URL('/', u.origin);
  if (!code || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    dest.searchParams.set('omega_auth', 'not_configured');
    return NextResponse.redirect(dest);
  }
  const store = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookies: { getAll: () => store.getAll(), setAll: (values) => {
      values.forEach(({ name, value, options }) => { store.set(name, value, options); });
    } } },
  );
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) dest.searchParams.set('omega_auth', 'failed');
  else dest.searchParams.set('omega_auth', 'success');
  return NextResponse.redirect(dest);
}
