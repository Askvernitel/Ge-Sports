import { RouterProvider } from 'react-router-dom';
import { AppProviders } from '@/app/providers';
import { router } from '@/app/router';
import { ClickPing } from '@/components/ClickPing';

export default function App() {
  return (
    <AppProviders>
      <RouterProvider router={router} />
      <ClickPing />
    </AppProviders>
  );
}
