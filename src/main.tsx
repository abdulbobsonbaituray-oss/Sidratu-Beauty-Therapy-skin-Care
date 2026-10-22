import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Unregister any stale dev Service Workers and suppress benign Vite HMR WebSocket closed rejections in iframe preview
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', event => {
    const msg = String(event.reason?.message || event.reason || '');
    if (msg.includes('WebSocket closed without opened') || msg.includes('@vite/client')) {
      event.preventDefault();
    }
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then(registrations => {
        for (const reg of registrations) {
          if (
            import.meta.env.DEV ||
            reg.active?.scriptURL?.includes('dev-sw.js') ||
            reg.installing?.scriptURL?.includes('dev-sw.js')
          ) {
            reg.unregister().catch(() => {});
          }
        }
      })
      .catch(() => {});
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected application error'
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#3B0944] text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#FAF7F2] text-[#1F1624] rounded-2xl p-6 border-2 border-[#D4AF37] shadow-2xl space-y-4 text-center">
            <h1 className="font-display text-2xl font-bold text-[#3B0944]">
              Sidratu Beauty Therapy Skin Care
            </h1>
            <p className="text-xs text-gray-700">
              101 Jomo Kenyatta Road, Freetown · Admin: Sidratu82sesay@gmail.com
            </p>
            <p className="text-xs bg-amber-50 border border-[#D4AF37] rounded-xl p-3 text-gray-800">
              {this.state.errorMessage}
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                type="button"
                onClick={() => {
                  this.setState({ hasError: false, errorMessage: '' });
                  window.location.reload();
                }}
                className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-[#3B0944] font-bold text-xs"
              >
                Reload App
              </button>
              <button
                type="button"
                onClick={() => {
                  try {
                    localStorage.removeItem('sidratu_clients_db');
                    localStorage.removeItem('sidratu_admin_config');
                  } catch {}
                  this.setState({ hasError: false, errorMessage: '' });
                  window.location.reload();
                }}
                className="px-4 py-2.5 rounded-xl bg-[#3B0944] text-[#F3E5AB] font-bold text-xs"
              >
                Reset Local Data &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>
);
