import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class CanvasErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CanvasErrorBoundary caught 3D rendering error:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#EDF1EC] text-[#17231F] p-6 text-center border border-[#DCE2DC] rounded">
          <div className="w-12 h-12 rounded bg-[#FFFFFF] border border-[#B7791F] flex items-center justify-center text-[#B7791F] mb-3 shadow-sm">
            <AlertTriangle className="w-6 h-6 stroke-[1.75]" />
          </div>
          <h3 className="text-sm font-semibold tracking-wide uppercase text-[#17231F] mb-1">
            3D Viewport Rendering Alert
          </h3>
          <p className="text-xs text-[#68736D] max-w-md mb-4 leading-relaxed font-mono">
            {this.state.error?.message || 'An error occurred while loading 3D assets or textures.'}
          </p>
          <button
            onClick={this.handleReset}
            className="px-3.5 py-1.5 bg-[#286653] hover:bg-[#204F42] text-white rounded text-xs font-medium flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry 3D Rendering</span>
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
