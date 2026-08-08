import { Outlet, useLocation } from 'react-router-dom';
import { Chrome } from './Chrome';

export function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen">
      <Chrome />
      {/* Re-keying on pathname replays the fade-in on every route change —
          the design spec's one sanctioned page-load animation. */}
      <div key={pathname} className="page-fade-in">
        <Outlet />
      </div>
    </div>
  );
}
