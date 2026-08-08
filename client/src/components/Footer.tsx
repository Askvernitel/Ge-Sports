import { Link } from 'react-router-dom';
import { Logo } from './Logo';

/** Shared footer — every routed page gets this via Layout.tsx. Modest by
 * design: a wordmark, real internal links (no invented destinations), and
 * the compliance line, matching the compliance copy pattern already used
 * on Login/Register ("18+ ONLY · DEVNET TOKENS HAVE NO MONETARY VALUE"). */
export function Footer() {
  return (
    <footer className="border-t border-lichen px-5 sm:px-10 py-8">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <Link to="/" className="no-underline">
          <Logo />
        </Link>
        <nav className="flex flex-wrap items-center gap-6">
          <Link
            to="/rooms"
            className="font-mono text-xs tracking-[1px] text-lichen no-underline transition-colors duration-200 hover:text-bone"
          >
            ROOMS
          </Link>
          <Link
            to="/verify"
            className="font-mono text-xs tracking-[1px] text-lichen no-underline transition-colors duration-200 hover:text-bone"
          >
            IDENTITY VERIFICATION
          </Link>
        </nav>
      </div>
      <div className="font-mono text-xs tracking-[1px] text-lichen mt-6 leading-[1.6]">
        18+ ONLY · SOLANA DEVNET · TEST TOKENS HAVE NO MONETARY VALUE
      </div>
    </footer>
  );
}
