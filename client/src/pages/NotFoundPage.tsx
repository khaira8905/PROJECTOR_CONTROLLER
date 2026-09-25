import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="font-mono text-sm text-sky-400">404</p>
      <h1 className="text-2xl font-semibold text-white">Page not found</h1>
      <Link to="/" className="ec-btn-primary rounded-lg px-4 py-2 text-sm font-semibold">
        Back to events
      </Link>
    </div>
  );
}
