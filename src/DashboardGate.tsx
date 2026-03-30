import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Dashboard from './Dashboard';

export default function DashboardGate() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    setAllowed(sessionStorage.getItem('easygpt_access') === 'predefined');
  }, []);

  if (allowed === null) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-gray-600">Checking access…</p>
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-100 px-6">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Dashboard access denied</h1>
          <p className="text-gray-600 mb-6">
            The dashboard is only available when you sign in using the internal predefined token on the Easy GPT
            server. JWT-only users can use the chat only.
          </p>
          <Link
            to="/"
            className="inline-block px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Back to Easy GPT
          </Link>
        </div>
      </div>
    );
  }

  return <Dashboard />;
}
