import React, { useState, useRef } from 'react'
import {
  FolderKanban,
  Upload,
  Search,
  CheckCircle2,
  ArrowRight,
  MapPin,
  Calendar,
  Layers,
  FileImage,
  Sparkles
} from 'lucide-react'
import { useStore } from '../../store/useStore'
import { SampleDataset } from '../../types'

export const ProjectsView: React.FC = () => {
  const samples = useStore((state) => state.samples)
  const selectedSampleId = useStore((state) => state.selectedSampleId)
  const loadSampleScene = useStore((state) => state.loadSampleScene)
  const processUploadedFile = useStore((state) => state.processUploadedFile)
  const setActiveScreen = useStore((state) => state.setActiveScreen)
  const isProcessing = useStore((state) => state.isProcessing)

  const [searchQuery, setSearchQuery] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSelectSample = async (sampleId: string) => {
    await loadSampleScene(sampleId)
    setActiveScreen('3d-reconstruction')
  }

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    const file = files[0]
    await processUploadedFile(file)
    setActiveScreen('3d-reconstruction')
  }

  const filteredSamples = samples.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="w-full h-full bg-[#F5F6F3] overflow-y-auto p-6 text-[#17231F] select-none">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header Strip */}
        <div className="flex items-center justify-between border-b border-[#DCE2DC] pb-4">
          <div>
            <h1 className="text-base font-semibold text-[#17231F] tracking-tight">
              Geospatial Projects & Datasets
            </h1>
            <p className="text-xs text-[#68736D] mt-0.5">
              Select a benchmark remote-sensing dataset or ingest new satellite imagery for 3D reconstruction and SIHE analysis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".tif,.tiff,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded bg-[#286653] hover:bg-[#204F42] text-white text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5 stroke-[2]" />
              <span>New Analysis</span>
            </button>
          </div>
        </div>

        {/* Quick Drag & Drop Ingestion Strip */}
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragActive(true)
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragActive(false)
            handleFileUpload(e.dataTransfer.files)
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`p-4 rounded border-2 border-dashed transition-all cursor-pointer text-center bg-[#FFFFFF] ${
            dragActive
              ? 'border-[#286653] bg-[#E8EFEA]'
              : 'border-[#DCE2DC] hover:border-[#B6C0B6]'
          }`}
        >
          <div className="flex items-center justify-center gap-2 text-xs text-[#68736D]">
            <FileImage className="w-4 h-4 text-[#286653]" />
            <span>Drop satellite imagery here (GeoTIFF, PNG, JPEG) or click to browse</span>
            <span className="text-[10px] font-mono text-[#68736D] bg-[#F5F6F3] px-1.5 py-0.5 rounded border border-[#DCE2DC]">
              Supported: Optical RGB & NIR GeoTIFF
            </span>
          </div>
        </div>

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 text-[#68736D] absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#FFFFFF] border border-[#DCE2DC] rounded pl-8 pr-3 py-1.5 text-xs text-[#17231F] placeholder-[#68736D] focus:outline-none focus:border-[#286653]"
            />
          </div>
          <span className="text-xs text-[#68736D] font-mono">
            {filteredSamples.length} {filteredSamples.length === 1 ? 'Dataset' : 'Datasets'} Available
          </span>
        </div>

        {/* Dataset Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredSamples.map((sample) => {
            const isSelected = selectedSampleId === sample.id

            return (
              <div
                key={sample.id}
                className={`bg-[#FFFFFF] border rounded p-4 flex flex-col justify-between transition-all shadow-sm ${
                  isSelected
                    ? 'border-[#286653] ring-1 ring-[#286653]'
                    : 'border-[#DCE2DC] hover:border-[#B6C0B6]'
                }`}
              >
                <div>
                  {/* Thumbnail & Title */}
                  <div className="flex gap-3">
                    <img
                      src={sample.preview_url}
                      alt={sample.name}
                      className="w-24 h-24 object-cover rounded border border-[#DCE2DC] shrink-0 bg-[#EDF1EC]"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-semibold text-xs text-[#17231F] truncate">
                          {sample.name}
                        </h3>
                        {isSelected && (
                          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#E8EFEA] text-[#286653] font-medium border border-[#286653]">
                            LOADED
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#68736D] line-clamp-2 leading-relaxed">
                        {sample.description}
                      </p>
                      <div className="pt-1 flex flex-wrap gap-2 text-[10px] font-mono text-[#68736D]">
                        <span className="px-1.5 py-0.5 rounded bg-[#F5F6F3] border border-[#DCE2DC]">
                          GSD: <strong className="text-[#17231F]">{sample.nominal_gsd_m} m/px</strong>
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[#F5F6F3] border border-[#DCE2DC]">
                          Extent: 512×512 px
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-4 pt-3 border-t border-[#DCE2DC] flex items-center justify-between">
                  <span className="text-[10px] text-[#68736D] flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-[#286653]" />
                    <span>Calibrated Benchmark</span>
                  </span>

                  <button
                    onClick={() => handleSelectSample(sample.id)}
                    disabled={isProcessing}
                    className="px-3 py-1 rounded bg-[#F5F6F3] hover:bg-[#E8EFEA] border border-[#DCE2DC] hover:border-[#286653] text-[#286653] text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <span>{isSelected ? 'Open Workspace' : 'Load Dataset'}</span>
                    <ArrowRight className="w-3 h-3 stroke-[2]" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
