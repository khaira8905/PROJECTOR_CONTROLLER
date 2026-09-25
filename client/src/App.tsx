import { Suspense, lazy } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthGate } from './components/AuthGate';
import { Backdrop } from './components/Backdrop';

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
            <Backdrop />
            <div className="ec-shell min-h-full">
              <AuthGate>
                <OperatorRoutes />
              </AuthGate>
            </div>
          </ToastProvider>
        }
      />
    </Routes>
    </Suspense>
  );
}

/** Operator pages fade in when you move between them. */
function OperatorRoutes() {
  const location = useLocation();
  return (
    <div key={location.pathname} className="ec-page-in min-h-full">
      <Routes location={location}>
        <Route path="/" element={<EventsPage />} />
        <Route path="/events/:eventId" element={<DashboardPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </div>
  );
}
