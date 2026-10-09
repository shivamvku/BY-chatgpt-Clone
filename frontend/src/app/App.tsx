import { lazy, Suspense, useEffect, useState } from 'react';
import { CircularProgress, Stack } from '@mui/material';
import { Toaster } from 'sonner';
import { useAuth } from '../features/auth/AuthProvider';
import { AuthScreen } from '../features/auth/AuthScreen';
import { AccountAction, initialAccountLink, readAccountLink } from '../features/auth/AccountAction';
import { VerificationScreen } from '../features/auth/VerificationScreen';
const ChatWorkspace = lazy(() => import('../features/chat/ChatWorkspace'));
function Loading() {
  return (
    <Stack minHeight="100dvh" justifyContent="center" alignItems="center">
      <CircularProgress aria-label="Loading application" />
    </Stack>
  );
}
export function App() {
  const auth = useAuth();
  const [link, setLink] = useState(initialAccountLink);
  useEffect(() => {
    const syncLink = () => setLink(readAccountLink());
    window.addEventListener('hashchange', syncLink);
    return () => window.removeEventListener('hashchange', syncLink);
  }, []);
  if (auth.loading) return <Loading />;
  if (link) return <AccountAction link={link} onClose={() => setLink(null)} />;
  if (auth.user && !auth.user.verified_user) return <VerificationScreen />;
  return (
    <>
      <Toaster position="bottom-right" theme="system" richColors closeButton />
      {auth.user ? (
        <Suspense fallback={<Loading />}>
          <ChatWorkspace />
        </Suspense>
      ) : (
        <AuthScreen />
      )}
    </>
  );
}
