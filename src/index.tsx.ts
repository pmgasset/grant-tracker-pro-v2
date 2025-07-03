import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Grant Tracker Pro Error:', error, errorInfo);
    
    // In production, you might want to log this to an error reporting service
    // like Sentry, LogRocket, or Cloudflare's analytics
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L4.35 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500">Error Details</summary>
                <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Preload critical resources
const preloadResources = () => {
  // Preload any critical API endpoints
  if ('serviceWorker' in navigator) {
    // Cache API endpoints for offline functionality
    caches.open('grant-tracker-v1').then(cache => {
      cache.addAll([
        '/api/search-grants',
        '/api/save-grants',
        '/api/load-grants'
      ]).catch(err => console.log('Cache preload failed:', err));
    });
  }
};

// Initialize app
const initializeApp = () => {
  const root = ReactDOM.createRoot(
    document.getElementById('root') as HTMLElement
  );

  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Remove initial loader
  document.body.classList.add('loaded');
  
  // Preload resources
  preloadResources();
  
  // Log app version in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🚀 Grant Tracker Pro loaded successfully');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Vite mode:', import.meta.env.MODE);
  }
};

// Start the app
initializeApp();

// Hot module replacement for development
if (import.meta.hot) {
  import.meta.hot.accept('./App', () => {
    initializeApp();
  });
}