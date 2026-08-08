import { Outlet, useLocation } from 'react-router-dom';
import { Chrome } from './Chrome';
import { Footer } from './Footer';

export function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen flex flex-col">
      <Chrome />
      {/* Re-keying on pathname replays the fade-in on every route change —
          the design spec's one sanctioned page-load animation. Capped and
          centered so content doesn't stretch edge-to-edge on wide monitors;
          1600px is comfortably past the 1400px this was designed/tested at. */}
      <div key={pathname} className="page-fade-in flex-1 w-full max-w-[1600px] mx-auto">
        <Outlet />
      </div>
      <Footer />
    </div>
  );
}
