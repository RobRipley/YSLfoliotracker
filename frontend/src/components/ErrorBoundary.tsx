/**
 * ErrorBoundary Component
 * 
 * Catches React errors and prevents the entire app from crashing.
 * Displays a fallback UI with helpful debugging information.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Error info:', errorInfo);
    
    this.setState({ errorInfo });
    
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="p-6 m-4 glass-panel border-danger/30">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-full bg-danger/10">
              <AlertTriangle className="h-6 w-6 text-danger" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground mb-2">Something went wrong</h3>
              <p className="text-sm text-muted-foreground mb-4">
                An error occurred while rendering this component. Check the browser console for details.
              </p>
              {this.state.error && (
                <div className="mb-4 p-3 rounded-lg bg-secondary/30 border border-divide-lighter/20">
                  <p className="font-mono text-xs text-danger break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}
              <button
                onClick={this.handleReset}
                className="gradient-outline-btn text-sm inline-flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span className="bg-gradient-to-r from-[#06b6d4] to-[#7c3aed] bg-clip-text text-transparent font-semibold">
                  Try Again
                </span>
              </button>
            </div>
          </div>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Sets up global error handlers for unhandled errors and promise rejections.
 * Call this once on app startup.
 */
export function setupGlobalErrorHandlers(): void {
  // Log uncaught errors with clear prefix for easy identification
  window.onerror = (message, source, lineno, colno, error) => {
    console.error('[YSL-ERROR] Uncaught error:', {
      message,
      source,
      lineno,
      colno,
      error,
      stack: error instanceof Error ? error.stack : undefined
    });
    return false; // Allow default handling
  };

  // Log unhandled promise rejections
  window.onunhandledrejection = (event: PromiseRejectionEvent) => {
    console.error('[YSL-ERROR] Unhandled promise rejection:', {
      reason: event.reason,
      stack: event.reason instanceof Error ? event.reason.stack : undefined
    });
  };

  console.log('[YSL] Global error handlers installed');
}
