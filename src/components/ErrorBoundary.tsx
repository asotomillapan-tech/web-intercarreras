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
        <div className="min-h-screen bg-[#050507] text-zinc-100 flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-3xl border border-white/[0.1] bg-[#0c0c10] p-8 space-y-5">
            <p className="text-xs text-[#a5b0ff] tracking-wide">
              Campeonato Intercarreras UFRO
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-medium tracking-[-0.03em] text-white">
              No se pudo completar la <span className="font-editorial text-[#c8ceff]">operación</span>
            </h1>
            <p className="text-sm text-zinc-400 leading-relaxed break-words">{displayDetail}</p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="px-6 py-2.5 rounded-full bg-white text-[#050507] hover:bg-zinc-200 font-medium text-xs transition-colors cursor-pointer"
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
