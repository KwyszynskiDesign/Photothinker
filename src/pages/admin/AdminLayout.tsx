import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { RefreshCw } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { ADMIN_EMAIL } from '../../lib/adminAuth';
import { AdminLogin } from './AdminLogin';
import { LegacyMigrationGate } from './LegacyMigration';

export function AdminLayout() {
  const { user, loading } = useAuth();
  const unauthorized = !!user && user.email !== ADMIN_EMAIL;

  useEffect(() => {
    if (unauthorized) signOut(auth);
  }, [unauthorized]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-canvas flex items-center justify-center" role="status" aria-label="Ładowanie">
        <RefreshCw className="w-6 h-6 text-ink-300 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (unauthorized) return <AdminLogin unauthorized />;
  if (!user) return <AdminLogin />;

  return (
    <LegacyMigrationGate>
      <Outlet />
    </LegacyMigrationGate>
  );
}
