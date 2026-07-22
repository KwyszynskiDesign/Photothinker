import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import { GuestCamera } from './pages/GuestCamera';
import { AdminLayout } from './pages/admin/AdminLayout';
import { EventListPage } from './pages/admin/EventListPage';
import { EventGalleryPage } from './pages/admin/EventGalleryPage';
import { LEGACY_EVENT_SLUG } from './lib/legacyEvent';

const router = createBrowserRouter([
  { path: '/', element: <Navigate to={`/e/${LEGACY_EVENT_SLUG}`} replace /> },
  { path: '/e/:slug', element: <GuestCamera /> },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <EventListPage /> },
      { path: ':slug', element: <EventGalleryPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
