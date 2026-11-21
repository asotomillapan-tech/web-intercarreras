import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: '',
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Ha ocurrido un error inesperado.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let displayDetail = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; path?: string };
        if (parsed.error) {
          displayDetail = `${parsed.error}${parsed.path ? ` (${parsed.path})` : ''}`;
        }
      } catch {
        // Plain error message
      }

      return (
        <div className="min-h-screen bg-[#0d0d0d] text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full border border-white/15 bg-[#141418] p-8 space-y-4">
            <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
              Campeonato Intercarreras UFRO
            </p>
            <h1 className="font-display text-2xl font-bold uppercase tracking-tight">
              No se pudo completar la operación
            </h1>
            <p className="text-sm text-neutral-300 leading-relaxed break-words">{displayDetail}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-5 py-2.5 bg-[#707ef9] hover:bg-[#5766eb] text-white font-display font-bold uppercase tracking-widest text-xs cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
