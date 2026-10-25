import React from 'react'
import {
  FolderKanban,
  ScanLine,
  Box,
  Mountain,
  Building2,
  Download,
  Settings2,
  ChevronLeft,
  ChevronRight,
  Compass,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { useStore, NavigationScreen } from '../../store/useStore'

interface NavItem {
  id: NavigationScreen
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'image-analysis', label: 'Image Analysis', icon: ScanLine },
  { id: '3d-reconstruction', label: '3D Reconstruction', icon: Box },
  { id: 'city-detail-studio', label: 'City Detail Studio', icon: Building2, badge: 'PRO' },
  { id: 'geotwin-response', label: 'GeoTwin ResponseOS', icon: Sparkles, badge: 'AI' },
  { id: 'height-estimation', label: 'Height Estimation', icon: Mountain, badge: 'SIHE' },
  { id: 'disaster-intelligence', label: 'Disaster Assessment', icon: ShieldAlert, badge: 'NEW' },
  { id: 'feature-inventory', label: 'Building & Vegetation', icon: Building2 },
  { id: 'exports', label: 'Exports', icon: Download },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

export const AppSidebar: React.FC = () => {
  const activeScreen = useStore((state) => state.activeScreen)
  const setActiveScreen = useStore((state) => state.setActiveScreen)
  const sidebarCollapsed = useStore((state) => state.sidebarCollapsed)
  const toggleSidebar = useStore((state) => state.toggleSidebar)
  const sceneData = useStore((state) => state.sceneData)
  const setGsdModalOpen = useStore((state) => state.setGsdModalOpen)

  return (
    <aside
      className={`bg-[#FFFFFF] border-r border-[#DCE2DC] flex flex-col justify-between shrink-0 transition-all duration-200 z-30 select-none ${
        sidebarCollapsed ? 'w-14' : 'w-56'
      }`}
    >
      {/* Brand & Platform Header */}
      <div>
        <div className="h-14 border-b border-[#DCE2DC] px-3.5 flex items-center justify-between">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded bg-[#286653] flex items-center justify-center shrink-0 text-white shadow-sm">
                <Compass className="w-4 h-4 stroke-[2]" />
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-xs text-[#17231F] tracking-wide uppercase truncate">
                  TERRASCOPE AI
                </div>
                <div className="text-[10px] text-[#68736D] truncate">
                  2D-to-3D Reconstruction
                </div>
              </div>
            </div>
          ) : (
            <div className="w-7 h-7 rounded bg-[#286653] mx-auto flex items-center justify-center text-white shadow-sm">
              <Compass className="w-4 h-4 stroke-[2]" />
            </div>
          )}
        </div>

        {/* Navigation Item List */}
        <nav className="p-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = activeScreen === item.id

            return (
              <button
                key={item.id}
                onClick={() => setActiveScreen(item.id)}
                title={sidebarCollapsed ? item.label : undefined}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-xs transition-colors text-left ${
                  isActive
                    ? 'bg-[#E8EFEA] text-[#286653] font-medium border-l-2 border-[#286653]'
                    : 'text-[#68736D] hover:text-[#17231F] hover:bg-[#F5F6F3]'
                } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 stroke-[1.75] ${
                    isActive ? 'text-[#286653]' : 'text-[#68736D]'
                  }`}
                />
                {!sidebarCollapsed && (
                  <div className="flex-1 flex items-center justify-between min-w-0">
                    <span className="truncate">{item.label}</span>
                    {item.badge && (
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#EDF1EC] text-[#286653] font-medium border border-[#DCE2DC]">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Footer: Scene Status & Sidebar Toggle */}
      <div className="p-2 border-t border-[#DCE2DC]">
        {!sidebarCollapsed && sceneData && (
          <div className="mb-2 p-2 rounded bg-[#F5F6F3] border border-[#DCE2DC] text-[10px] text-[#68736D] space-y-1 font-mono">
            <div className="flex justify-between items-center text-[#17231F]">
              <span className="font-sans font-medium text-[10px]">Active Scene</span>
              <span className="text-[#286653] font-bold">READY</span>
            </div>
            <button
              type="button"
              onClick={() => setGsdModalOpen(true)}
              className="w-full flex justify-between items-center hover:bg-white p-0.5 rounded cursor-pointer transition-colors group"
              title="Click to change Ground Sampling Distance (GSD)"
            >
              <span className="group-hover:text-[#286653]">GSD:</span>
              <span className="text-[#17231F] font-semibold group-hover:text-[#286653] flex items-center gap-1">
                {sceneData.gsd_m} m/px
                <span className="text-[8px] text-[#286653] underline font-sans">edit</span>
              </span>
            </button>
            <div className="flex justify-between">
              <span>Objects:</span>
              <span className="text-[#17231F] font-semibold">
                {sceneData.buildings.length} bld / {sceneData.trees.length} veg
              </span>
            </div>
          </div>
        )}

        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 p-1.5 rounded text-[#68736D] hover:text-[#17231F] hover:bg-[#F5F6F3] text-xs transition-colors"
          title={sidebarCollapsed ? 'Expand navigation' : 'Collapse navigation'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 stroke-[1.75]" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4 stroke-[1.75]" />
              <span className="text-[11px]">Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
