import React from 'react'
import { Compass, Loader2, AlertCircle } from 'lucide-react'
import { useStore } from '../../store/useStore'

export const ProcessingOverlay: React.FC = () => {
  const isProcessing = useStore((state) => state.isProcessing)
  const jobProgress = useStore((state) => state.jobProgress)
  const jobStep = useStore((state) => state.jobStep)
  const jobError = useStore((state) => state.jobError)

  if (!isProcessing && !jobError) return null

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#FFFFFF] border border-[#DCE2DC] rounded p-5 max-w-md w-full shadow-xl space-y-4 text-xs text-[#17231F]">
        {jobError ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-[#B64040]">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="font-semibold text-sm">Processing Pipeline Error</h3>
            </div>
            <p className="text-xs text-[#17231F] leading-relaxed bg-[#F5F6F3] p-3 rounded border border-[#DCE2DC] font-mono">
              {jobError}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded bg-[#286653] flex items-center justify-center text-white shadow-sm">
                  <Compass className="w-4 h-4 animate-spin stroke-[2]" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs text-[#17231F] uppercase tracking-wide">
                    Reconstruction Pipeline Active
                  </h3>
                  <div className="text-[10px] text-[#68736D]">
                    Executing remote-sensing & SIHE neural pipeline
                  </div>
                </div>
              </div>
              <span className="font-mono text-[#286653] text-sm font-bold">
                {jobProgress}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#EDF1EC] rounded-xs h-1.5 overflow-hidden border border-[#DCE2DC]">
              <div
                className="bg-[#286653] h-full rounded-xs transition-all duration-300 ease-out"
                style={{ width: `${jobProgress}%` }}
              />
            </div>

            {/* Current Step Description */}
            <div className="flex items-center gap-2 text-xs text-[#68736D]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#286653] shrink-0" />
              <span className="truncate">{jobStep || 'Processing scene...'}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
