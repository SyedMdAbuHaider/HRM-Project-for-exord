import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  viewName?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * ErrorBoundary — wraps each view so a runtime error in one panel
 * never crashes the entire app.
 *
 * Usage:
 *   <ErrorBoundary viewName="Payroll">
 *     <PayrollView />
 *   </ErrorBoundary>
 */
class ErrorBoundary extends React.Component<any, any> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary] ${this.props.viewName || 'View'} crashed:`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-32 px-8 text-center space-y-6 animate-[fadeIn_0.4s_ease-out]">
          <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-[2rem] flex items-center justify-center">
            <AlertTriangle size={28} className="text-[#E31E24]" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
              {this.props.viewName || 'This view'} encountered an error
            </h3>
            <p className="text-sm text-slate-400 font-medium max-w-sm">
              Something went wrong while rendering this panel. Your data is safe — try reloading.
            </p>
            {this.state.error && (
              <p className="text-[10px] font-mono text-slate-300 dark:text-slate-600 mt-2 bg-slate-50 dark:bg-slate-800 px-3 py-2 rounded-xl max-w-md mx-auto truncate">
                {this.state.error.message}
              </p>
            )}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: undefined })}
            className="flex items-center gap-2 px-5 py-3 bg-[#E31E24] text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#C41217] active:scale-95 transition-all shadow-lg shadow-red-900/20"
          >
            <RefreshCw size={14} /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
