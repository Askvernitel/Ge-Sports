import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { useSessionStore } from '@/app/store';
import { logout } from '@/features/auth/api';
import { formatTokens } from '@/lib/money';
import { Logo } from './Logo';

// Room Lobby, Match Result and Profile are reached in context (from a room
// card, a settled match, or the profile chip) rather than as static nav
// destinations — there's no single "the" lobby or "the" result to point a
// fixed link at, and profile already has its own entry point up top.
const NAV_TABS = [
  { label: 'HOME', to: '/' },
  { label: 'ROOMS', to: '/rooms' },
] as const;

function isActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/';
  if (to === '/rooms') return pathname.startsWith('/rooms');
  return pathname === to;
}

/** Row 1 + Row 2 chrome shared by every screen except Login. */
export function Chrome() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data: wallet } = useWalletBalance();
  const { displayName, initials, isAuthenticated } = useSessionStore();

  async function handleLogout() {
    await logout();
    navigate('/');
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-y-3 min-h-16 py-3 px-5 sm:px-10 border-b border-lichen">
        <Link to="/" className="no-underline">
          <Logo />
        </Link>
        <div className="flex flex-wrap items-center gap-2 sm:gap-4">
          {isAuthenticated && (
            <div className="flex items-center gap-2.5 border border-lichen py-1.5 pl-3 pr-3.5">
              <span className="font-mono text-xs tracking-[1px] text-lichen">BALANCE</span>
              <span className="font-mono text-lg tabular-nums text-bone">
                {wallet ? formatTokens(wallet.custodialBalance) : '—'}
              </span>
            </div>
          )}
          {isAuthenticated && (
            <Link
              to="/notifications"
              aria-label="Notifications"
              title="Notifications"
              className={`w-9 h-9 flex items-center justify-center border transition-colors duration-200 hover:border-bone ${
                pathname === '/notifications' ? 'border-zone' : 'border-lichen'
              }`}
            >
              <span className="w-2.5 h-2.5 bg-zone" />
            </Link>
          )}
          {isAuthenticated ? (
            <Link
              to="/profile"
              className={`flex items-center gap-2.5 no-underline border py-1.5 pl-1.5 pr-3 transition-colors duration-200 hover:border-bone ${
                pathname === '/profile' ? 'border-zone' : 'border-lichen'
              }`}
            >
              <span className="w-[26px] h-[26px] bg-zone text-ground font-mono text-xs flex items-center justify-center flex-shrink-0">
                {initials}
              </span>
              <span className="font-sans text-sm text-bone">{displayName}</span>
            </Link>
          ) : null}
          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="bg-transparent border-none text-lichen font-sans text-sm cursor-pointer p-0 transition-colors duration-200 hover:text-bone"
            >
              Logout
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <Link
                to="/login"
                className="font-sans text-sm font-semibold no-underline text-bone border border-lichen px-5 py-2.5 transition-[transform,border-color] duration-200 ease-out hover:-translate-y-px hover:border-bone active:scale-[0.98]"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="font-sans text-sm font-semibold no-underline text-ground bg-zone px-5 py-2.5 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:shadow-[0_4px_16px_rgba(62,124,163,0.35)] active:translate-y-0 active:scale-[0.98]"
              >
                Sign up
              </Link>
            </div>
          )}
        </div>
      </div>

      <nav className="flex border-b border-lichen px-10 overflow-x-auto">
        {NAV_TABS.map((tab) => {
          const active = isActive(pathname, tab.to);
          return (
            <Link
              key={tab.label}
              to={tab.to}
              className={`px-5 py-4 font-mono text-xs tracking-[1px] no-underline border-b-2 whitespace-nowrap ${
                active ? 'text-bone border-zone' : 'text-lichen border-transparent'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
