import { useEffect } from 'react'
import { AppHeader } from './components/layout/AppHeader'
import { AppSidebar } from './components/navigation/AppSidebar'
import { RightInspector } from './components/inspector/RightInspector'
import { ProjectsView } from './components/views/ProjectsView'
import { ImageAnalysisView } from './components/views/ImageAnalysisView'
import { ReconstructionView } from './components/views/ReconstructionView'
import { HeightEstimationView } from './components/views/HeightEstimationView'
import { DisasterIntelligenceView } from './components/views/DisasterIntelligenceView'
import { InsuranceRiskView } from './components/views/InsuranceRiskView'
import { GeoTwinResponseView } from './components/views/GeoTwinResponseView'
import { CityDetailStudioView } from './components/views/CityDetailStudioView'
import { FeatureInventoryView } from './components/views/FeatureInventoryView'
import { ExportsView } from './components/views/ExportsView'
import { SettingsView } from './components/views/SettingsView'
import { ProcessingOverlay } from './components/common/ProcessingOverlay'
import { GsdSelectorModal } from './components/common/GsdSelectorModal'
import { useStore } from './store/useStore'

export function App() {
  const activeScreen = useStore((state) => state.activeScreen)
  const sceneData = useStore((state) => state.sceneData)
  const loadSampleScene = useStore((state) => state.loadSampleScene)
  const fetchSamples = useStore((state) => state.fetchSamples)
  const isProcessing = useStore((state) => state.isProcessing)

  // Auto-fetch samples and load benchmark scene on launch
  useEffect(() => {
    fetchSamples()
    if (!sceneData && !isProcessing) {
      loadSampleScene('jacksonville_aerial')
    }
  }, [])

  return (
    <div className="w-screen h-screen flex flex-col bg-[#F5F6F3] text-[#17231F] overflow-hidden font-sans">
      {/* Top Application Bar with Telemetry */}
      <AppHeader />

      {/* Main Workspace Area with 3-Column Geospatial Shell */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Fixed Navigation Sidebar */}
        <AppSidebar />

        {/* Central Active Workspace Screen */}
        <main className="flex-1 relative overflow-hidden bg-[#F5F6F3] flex flex-col">
          {activeScreen === 'projects' && <ProjectsView />}
          {activeScreen === 'image-analysis' && <ImageAnalysisView />}
          {activeScreen === '3d-reconstruction' && <ReconstructionView />}
          {activeScreen === 'city-detail-studio' && <CityDetailStudioView />}
          {activeScreen === 'height-estimation' && <HeightEstimationView />}
          {activeScreen === 'disaster-intelligence' && <DisasterIntelligenceView />}
          {activeScreen === 'insurance-risk' && <InsuranceRiskView />}
          {activeScreen === 'geotwin-response' && <GeoTwinResponseView />}
          {activeScreen === 'feature-inventory' && <FeatureInventoryView />}
          {activeScreen === 'exports' && <ExportsView />}
          {activeScreen === 'settings' && <SettingsView />}

          {/* Understated Processing Pipeline Overlay */}
          <ProcessingOverlay />

          {/* Ground Sampling Distance & Metric Scale Modal */}
          <GsdSelectorModal />
        </main>

        {/* Right Collapsible Analysis Inspector */}
        <RightInspector />
      </div>
    </div>
  )
}

export default App
