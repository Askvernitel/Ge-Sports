import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { HomePage } from '@/features/home/HomePage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { RoomsPage } from '@/features/rooms/RoomsPage';
import { RoomLobbyPage } from '@/features/rooms/RoomLobbyPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { DepositWithdrawPage } from '@/features/wallet/DepositWithdrawPage';
import { MatchResultPage } from '@/features/match/MatchResultPage';
import { IdentityVerificationPage } from '@/features/kyc/IdentityVerificationPage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { useSessionStore } from '@/app/store';

// Wallet/profile/verify need a real JWT (their backend routes are behind
// requireAuth); rooms browsing (GET /rooms, GET /rooms/:id) is public on the
// backend so it stays reachable without signing in — joining/creating still
// 401s server-side and surfaces an error if attempted while logged out.
function RequireAuth() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const isBootstrapping = useSessionStore((s) => s.isBootstrapping);
  // Wait for the silent-refresh attempt (httpOnly cookie -> access token) in
  // AppProviders/useSessionBootstrap before deciding to bounce to /login —
  // otherwise a hard reload on a protected route always redirects even with
  // a valid refresh cookie, since the in-memory access token is gone.
  if (isBootstrapping) return null;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

// Home is the logged-out marketing/landing page — an authenticated visitor
// hitting "/" (e.g. a bookmark, or clicking the logo) belongs on their rooms
// list instead. Same bootstrapping wait as RequireAuth, for the same reason
// (avoid a flash of the marketing page before the silent-refresh resolves).
function HomeOrRedirect() {
  const isAuthenticated = useSessionStore((s) => s.isAuthenticated);
  const isBootstrapping = useSessionStore((s) => s.isBootstrapping);
  if (isBootstrapping) return null;
  return isAuthenticated ? <Navigate to="/rooms" replace /> : <HomePage />;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    element: <Layout />,
    children: [
      { path: '/', element: <HomeOrRedirect /> },
      { path: '/rooms', element: <RoomsPage /> },
      { path: '/rooms/:roomId', element: <RoomLobbyPage /> },
      { path: '/matches/:matchId', element: <MatchResultPage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: '/profile', element: <ProfilePage /> },
          { path: '/wallet', element: <DepositWithdrawPage /> },
          { path: '/verify', element: <IdentityVerificationPage /> },
          { path: '/notifications', element: <NotificationsPage /> },
        ],
      },
    ],
  },
]);
