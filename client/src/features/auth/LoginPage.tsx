import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authHeroSrc } from '@/lib/mapAssets';
import { login } from './api';
import { ApiError } from '@/lib/http';
import { Logo } from '@/components/Logo';

/** Plain email/password sign-in. Wallet connect and PUBG name linking live
 * on the Profile page instead — registering/signing in shouldn't require
 * either. */
export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate('/rooms');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px,1fr))' }}>
      <div className="p-10 py-12 flex flex-col justify-between">
        <Link to="/" className="no-underline">
          <Logo />
        </Link>

        <div className="max-w-[420px] py-12">
          <h1 className="font-display font-black text-6xl tracking-[1px] uppercase leading-[0.95] mb-4">Sign in</h1>
          <p className="text-md leading-[1.6] mb-9">
            Sign in to browse and join rooms. You can connect a wallet and link your PUBG name afterward, from your
            profile.
          </p>

          <form onSubmit={handleSubmit}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              className="w-full bg-ground border border-lichen text-bone font-mono text-[15px] p-3 box-border mb-2.5"
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full bg-ground border border-lichen text-bone font-mono text-[15px] p-3 box-border"
            />
            {error && <div className="text-xs text-flare mt-3 leading-[1.5]">{error}</div>}
            <button
              type="submit"
              disabled={busy || !email || !password}
              className="block w-full mt-6 bg-zone text-ground text-sm font-semibold px-6 py-3.5 border-none cursor-pointer disabled:opacity-50"
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="text-sm text-lichen mt-5">
            No account? <Link to="/register">Create one</Link>.
          </div>

          <div className="font-mono text-xs text-lichen mt-8 tracking-[1px] leading-[1.6]">
            18+ ONLY · DEVNET TOKENS HAVE NO MONETARY VALUE
          </div>
        </div>

        <div className="text-sm text-lichen">
          Identity verification is required once, before your first withdrawal.{' '}
          <Link to="/verify">What that involves</Link>.
        </div>
      </div>

      <div className="relative min-h-[420px] overflow-hidden border-l border-lichen">
        <img src={authHeroSrc} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(180deg, rgba(23,19,16,0.25) 0%, rgba(23,19,16,0.7) 100%)' }}
        />
      </div>
    </div>
  );
}
