import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthGate } from './components/AuthGate';

const EventsPage = lazy(() => import('./pages/EventsPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DisplayPage = lazy(() => import('./pages/DisplayPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <Suspense fallback={<div className="h-full bg-black" />}>
    <Routes>
      {/* The audience display is deliberately outside the operator UI shell. */}
      <Route path="/display/:eventId" element={<DisplayPage />} />
      <Route
        path="*"
        element={
          <ToastProvider>
            <AuthGate>
            <Routes>
              <Route path="/" element={<EventsPage />} />
              <Route path="/events/:eventId" element={<DashboardPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
            </AuthGate>
          </ToastProvider>
        }
      />
    </Routes>
    </Suspense>
  );
}
