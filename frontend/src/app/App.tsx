import { lazy, Suspense, useState } from 'react';
import { CircularProgress, Stack } from '@mui/material';
import { useAuth } from '../features/auth/AuthProvider';
import { AuthScreen } from '../features/auth/AuthScreen';
import { AccountAction, initialAccountLink } from '../features/auth/AccountAction';
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
  if (auth.loading) return <Loading />;
  if (link) return <AccountAction link={link} onClose={() => setLink(null)} />;
  if (auth.user && !auth.user.verified_user) return <VerificationScreen />;
  return auth.user ? (
    <Suspense fallback={<Loading />}>
      <ChatWorkspace />
    </Suspense>
  ) : (
    <AuthScreen />
  );
}
