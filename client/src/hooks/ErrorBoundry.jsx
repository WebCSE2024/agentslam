import { Component } from "react";
import { AlertCircle } from "lucide-react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full border border-red-200 rounded-lg p-6 bg-red-50">
            <div className="flex items-center gap-3 mb-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <h5 className="font-medium text-red-800">Something went wrong</h5>
            </div>
            <p className="text-sm text-red-700">
              {this.props.fallback || "Please refresh the page or try again later."}
            </p>
            <pre className="mt-3 text-xs bg-red-100 p-2 rounded text-red-700 overflow-auto">
              {this.state.error?.toString()}
            </pre>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
