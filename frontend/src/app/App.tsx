import { lazy, Suspense } from 'react';
import { CircularProgress, Stack } from '@mui/material';
import { useAuth } from '../features/auth/AuthProvider';
import { AuthScreen } from '../features/auth/AuthScreen';
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
  if (auth.loading) return <Loading />;
  return auth.user ? (
    <Suspense fallback={<Loading />}>
      <ChatWorkspace />
    </Suspense>
  ) : (
    <AuthScreen />
  );
}
