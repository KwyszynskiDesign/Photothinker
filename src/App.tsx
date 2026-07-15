import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { GuestCamera } from './pages/GuestCamera';
import { AdminPage } from './pages/AdminPage';

const router = createBrowserRouter([
  { path: '/', element: <GuestCamera /> },
  { path: '/admin', element: <AdminPage /> },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
