import React from 'react'
import {
  Upload,
  Layers,
  Scale,
  BarChart3,
  Ruler,
  Download,
  Crosshair,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { SourceDataPanel } from './SourceDataPanel'
import { LayerManager } from './LayerManager'
import { FeatureInspector } from '../inspector/FeatureInspector'
import { CalibrationPanel } from '../geodepth/CalibrationPanel'
import { AnalyticsPanel } from '../geodepth/AnalyticsPanel'
import { MeasurementsPanel } from '../geodepth/MeasurementsPanel'
import { ExportsPanel } from '../geodepth/ExportsPanel'

interface SidebarProps {
  collapsed: boolean
  onToggleCollapse: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const activeSidebarTab = useStore((state) => state.activeSidebarTab)
  const setActiveSidebarTab = useStore((state) => state.setActiveSidebarTab)
  const selectedFeature = useStore((state) => state.selectedFeature)
  const measurements = useStore((state) => state.measurements)
  const isCalibrated = useStore((state) => state.isCalibrated)

  const tabs = [
    { id: 'source' as const, label: 'Data', icon: Upload },
    { id: 'layers' as const, label: 'Layers', icon: Layers },
    {
      id: 'calibration' as const,
      label: 'Calibrate',
      icon: Scale,
      badge: isCalibrated ? 'CAL' : undefined,
      badgeColor: isCalibrated ? 'bg-emerald-500 text-slate-950' : undefined
    },
    { id: 'analytics' as const, label: 'Analytics', icon: BarChart3 },
    {
      id: 'measurements' as const,
      label: 'Measure',
      icon: Ruler,
      badge: measurements.length > 0 ? String(measurements.length) : undefined,
      badgeColor: 'bg-cyan-500 text-slate-950'
    },
    { id: 'exports' as const, label: 'Exports', icon: Download },
    {
      id: 'inspector' as const,
      label: 'Inspect',
      icon: Crosshair,
      badge: selectedFeature ? '1' : undefined,
      badgeColor: 'bg-amber-500 text-slate-950'
    }
  ]

  return (
    <aside
      className={`h-[calc(100vh-3.5rem)] bg-slate-900 border-r border-slate-800 flex flex-col shrink-0 transition-all duration-300 relative z-10 ${
        collapsed ? 'w-14' : 'w-84 sm:w-96'
      }`}
    >
      {/* Tab Navigation Header */}
      <div className="flex items-center border-b border-slate-800 bg-slate-900/90 shrink-0">
        <div className="flex-1 flex overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeSidebarTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (collapsed) onToggleCollapse()
                  setActiveSidebarTab(tab.id)
                }}
                title={tab.label}
                className={`py-3 px-2.5 flex-1 flex flex-col items-center justify-center gap-1 text-[10px] font-medium border-b-2 transition-all relative ${
                  isActive
                    ? 'border-cyan-500 text-cyan-400 bg-slate-800/50'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                }`}
              >
                <div className="relative">
                  <Icon className="w-4 h-4" />
                  {tab.badge && (
                    <span
                      className={`absolute -top-1 -right-2 px-1 h-3.5 ${
                        tab.badgeColor || 'bg-cyan-500 text-slate-950'
                      } text-[8px] font-bold rounded-full flex items-center justify-center`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                {!collapsed && <span className="truncate max-w-[55px]">{tab.label}</span>}
              </button>
            )
          })}
        </div>

        {/* Collapse Toggle Button */}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          className="p-3 text-slate-400 hover:text-white border-l border-slate-800 shrink-0"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Panel Body */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {activeSidebarTab === 'source' && <SourceDataPanel />}
          {activeSidebarTab === 'layers' && <LayerManager />}
          {activeSidebarTab === 'calibration' && <CalibrationPanel />}
          {activeSidebarTab === 'analytics' && <AnalyticsPanel />}
          {activeSidebarTab === 'measurements' && <MeasurementsPanel />}
          {activeSidebarTab === 'exports' && <ExportsPanel />}
          {activeSidebarTab === 'inspector' && <FeatureInspector />}
        </div>
      )}
    </aside>
  )
}
