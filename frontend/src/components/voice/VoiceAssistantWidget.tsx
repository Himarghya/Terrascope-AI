import React, { useState, useEffect, useRef } from 'react'
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Sparkles,
  Bot,
  Send,
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Radio,
  ChevronRight,
  Download,
} from 'lucide-react'
import { useStore } from '../../store/useStore'

export const VoiceAssistantWidget: React.FC = () => {
  const voiceState = useStore((state) => state.voiceState)
  const setVoiceState = useStore((state) => state.setVoiceState)
  const speakText = useStore((state) => state.speakText)
  const sendVoiceCommand = useStore((state) => state.sendVoiceCommand)
  const checkVoiceAndAgent37Status = useStore((state) => state.checkVoiceAndAgent37Status)
  const setSelectedVoiceId = useStore((state) => state.setSelectedVoiceId)
  const downloadLastSpokenAudio = useStore((state) => state.downloadLastSpokenAudio)
  const agent37Messages = useStore((state) => state.agent37Messages)
  const isAgent37Thinking = useStore((state) => state.isAgent37Thinking)
  const sendAgent37Query = useStore((state) => state.sendAgent37Query)
  const clearAgent37History = useStore((state) => state.clearAgent37History)
  const agent37ModelCatalog = useStore((state) => state.agent37ModelCatalog)
  const selectAgent37Model = useStore((state) => state.selectAgent37Model)
  const voiceNarrationOnClick = useStore((state) => state.voiceNarrationOnClick)
  const toggleVoiceNarrationOnClick = useStore((state) => state.toggleVoiceNarrationOnClick)

  const [panelOpen, setPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<'voice' | 'agent37'>('voice')
  const [customInput, setCustomInput] = useState('')
  const [browserSpeechAvailable, setBrowserSpeechAvailable] = useState(false)
  const recognitionRef = useRef<any>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize status on mount
  useEffect(() => {
    checkVoiceAndAgent37Status()

    // Check Web Speech API availability for client-side STT
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      setBrowserSpeechAvailable(true)
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setVoiceState({ isListening: true, error: null })
      }
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setVoiceState({ isListening: false, transcript })
        sendVoiceCommand(transcript)
      }
      recognition.onerror = (event: any) => {
        setVoiceState({
          isListening: false,
          error: `Microphone notice: ${event.error || 'speech recognition ended'}`,
        })
      }
      recognition.onend = () => {
        setVoiceState({ isListening: false })
      }
      recognitionRef.current = recognition
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [agent37Messages])

  const toggleListening = () => {
    if (voiceState.isSpeaking) {
      // Stop speaking
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
      setVoiceState({ isSpeaking: false })
      return
    }

    if (voiceState.isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      setVoiceState({ isListening: false })
    } else {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start()
        } catch (e) {
          // If already started, restart
          recognitionRef.current.stop()
          recognitionRef.current.start()
        }
      } else {
        // Fallback: open panel to allow text prompt or simulated speech
        setPanelOpen(true)
      }
    }
  }

  const handleQuickCommand = (cmd: string) => {
    if (activeTab === 'voice') {
      sendVoiceCommand(cmd)
    } else {
      sendAgent37Query(cmd)
    }
  }

  const handleSubmitText = (e: React.FormEvent) => {
    e.preventDefault()
    if (!customInput.trim()) return
    const text = customInput.trim()
    setCustomInput('')
    if (activeTab === 'voice') {
      sendVoiceCommand(text)
    } else {
      sendAgent37Query(text)
    }
  }

  return (
    <div className="relative">
      {/* Header Compact Trigger Button */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={toggleListening}
          className={`relative p-1.5 rounded-md border transition-all flex items-center justify-center shrink-0 cursor-pointer ${
            voiceState.isListening
              ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse'
              : voiceState.isSpeaking
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
              : 'bg-[#0f172a] border-[#1e293b] text-[#94a3b8] hover:text-white hover:border-[#38bdf8]'
          }`}
          title={
            voiceState.isListening
              ? 'Listening... Click to stop'
              : voiceState.isSpeaking
              ? 'Speaking... Click to cancel'
              : 'Activate Voice Geospatial Assistant'
          }
        >
          {voiceState.isListening ? (
            <Radio className="w-4 h-4 animate-spin text-rose-400" />
          ) : voiceState.isSpeaking ? (
            <Volume2 className="w-4 h-4 text-emerald-400 animate-bounce" />
          ) : (
            <Mic className="w-4 h-4" />
          )}
        </button>

        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
            panelOpen
              ? 'bg-[#1e293b] border-[#38bdf8] text-white shadow-sm'
              : 'bg-[#0f172a] border-[#1e293b] text-[#cbd5e1] hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-[#38bdf8]" />
          <span>AI Voice & Agent37</span>
          {voiceState.connectionStatus === 'CONNECTED' ? (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="ElevenLabs Connected" />
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Web Speech Fallback Active" />
          )}
        </button>
      </div>

      {/* Floating Assistant Drawer / Dialog */}
      {panelOpen && (
        <div className="absolute right-0 mt-2 w-[420px] max-h-[580px] bg-[#090d16] border border-[#1e293b] rounded-xl shadow-2xl z-50 flex flex-col overflow-hidden text-[#f8fafc]">
          {/* Header */}
          <div className="px-4 py-3 bg-[#0c1322] border-b border-[#1e293b] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-[#0284c7]/20 border border-[#0284c7]/40 flex items-center justify-center text-[#38bdf8]">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-xs font-bold text-white tracking-wide">TerraScope Geospatial Intelligence</div>
                <div className="text-[10px] text-[#94a3b8] flex items-center gap-1">
                  <span>Voice: {voiceState.connectionStatus === 'CONNECTED' ? 'ElevenLabs TTS' : 'Browser Web Speech'}</span>
                  <span>•</span>
                  <span>Agent37: Deterministic Verified</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="p-1 rounded text-[#94a3b8] hover:text-white hover:bg-[#1e293b]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="flex border-b border-[#1e293b] bg-[#0a0f1d] text-xs font-medium">
            <button
              onClick={() => setActiveTab('voice')}
              className={`flex-1 py-2 text-center transition-colors ${
                activeTab === 'voice'
                  ? 'border-b-2 border-[#38bdf8] text-[#38bdf8] bg-[#0f172a]'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Voice Interaction
            </button>
            <button
              onClick={() => setActiveTab('agent37')}
              className={`flex-1 py-2 text-center transition-colors ${
                activeTab === 'agent37'
                  ? 'border-b-2 border-[#38bdf8] text-[#38bdf8] bg-[#0f172a]'
                  : 'text-[#94a3b8] hover:text-white'
              }`}
            >
              Agent37 Assistant
            </button>
          </div>

          {/* Tab 1: Voice Commands & Realtime Interaction */}
          {activeTab === 'voice' && (
            <div className="p-4 flex-1 flex flex-col gap-3 overflow-y-auto">
              {/* Voice Model & Audio Export Bar */}
              <div className="flex items-center justify-between gap-2 p-2 bg-[#0c1424] border border-[#1e293b] rounded-lg text-xs">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <span className="text-[10px] uppercase font-mono text-[#64748b] shrink-0">Voice:</span>
                  <select
                    value={voiceState.selectedVoiceId || 'EXAVITQu4vr4xnSDxMaL'}
                    onChange={(e) => setSelectedVoiceId(e.target.value)}
                    className="bg-[#090d16] text-[#e2e8f0] text-[11px] rounded px-2 py-1 border border-[#1e293b] focus:outline-none focus:border-[#38bdf8] flex-1 truncate"
                  >
                    {(voiceState.availableVoices && voiceState.availableVoices.length > 0
                      ? voiceState.availableVoices
                      : [
                          { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah (News / Broadcast)' },
                          { voice_id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel (Calm Geospatial)' },
                          { voice_id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie (Conversational)' },
                          { voice_id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George (Authoritative)' },
                          { voice_id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger (Tactical Command)' },
                        ]
                    ).map((v) => (
                      <option key={v.voice_id} value={v.voice_id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>
                {voiceState.lastAudioBase64 && (
                  <button
                    onClick={downloadLastSpokenAudio}
                    className="px-2 py-1 rounded bg-[#0369a1] hover:bg-[#0284c7] text-white text-[10px] font-medium flex items-center gap-1 shrink-0 transition-colors"
                    title="Download high-fidelity MP3 voice briefing"
                  >
                    <Download className="w-3 h-3" />
                    <span>Export MP3</span>
                  </button>
                )}
              </div>

              {/* Voice Inspector on Click Toggle */}
              <div className="p-2.5 bg-[#0c1424] border border-[#1e293b] rounded-lg flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-6 h-6 rounded flex items-center justify-center ${
                      voiceNarrationOnClick
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-[#1e293b] text-[#64748b]'
                    }`}
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-white text-[11px] flex items-center gap-1.5">
                      <span>Voice Building Inspector</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                          voiceNarrationOnClick
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {voiceNarrationOnClick ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <div className="text-[10px] text-[#94a3b8]">
                      Speaks height, dimensions & features on 3D click
                    </div>
                  </div>
                </div>
                <button
                  onClick={toggleVoiceNarrationOnClick}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all cursor-pointer ${
                    voiceNarrationOnClick
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs'
                      : 'bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8]'
                  }`}
                >
                  {voiceNarrationOnClick ? 'Disable' : 'Enable'}
                </button>
              </div>

              {/* Mic Status Banner */}
              <div
                className={`p-3 rounded-lg border flex items-center justify-between text-xs ${
                  voiceState.isListening
                    ? 'bg-rose-950/30 border-rose-800 text-rose-300'
                    : voiceState.isSpeaking
                    ? 'bg-emerald-950/30 border-emerald-800 text-emerald-300'
                    : 'bg-[#0f172a] border-[#1e293b] text-[#cbd5e1]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {voiceState.isListening ? (
                    <>
                      <Radio className="w-4 h-4 text-rose-400 animate-spin" />
                      <span>Listening for geospatial commands...</span>
                    </>
                  ) : voiceState.isSpeaking ? (
                    <>
                      <Volume2 className="w-4 h-4 text-emerald-400 animate-bounce" />
                      <span>Synthesizing voice response...</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 text-[#38bdf8]" />
                      <span>Voice engine ready. Click to speak or type below.</span>
                    </>
                  )}
                </div>
                <button
                  onClick={toggleListening}
                  className="px-2 py-1 rounded bg-[#1e293b] text-white hover:bg-[#334155] text-[11px]"
                >
                  {voiceState.isListening ? 'Stop' : voiceState.isSpeaking ? 'Mute' : 'Record'}
                </button>
              </div>

              {/* Error Notice */}
              {voiceState.error && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center justify-between">
                  <span>{voiceState.error}</span>
                  <button
                    onClick={() => setVoiceState({ error: null })}
                    className="text-rose-400 hover:text-white text-[10px] ml-2"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Live Transcript / Reply Card */}
              {voiceState.transcript && (
                <div className="p-3 bg-[#0f172a] rounded-lg border border-[#1e293b]">
                  <div className="text-[10px] uppercase font-mono text-[#64748b] tracking-wider mb-1">
                    Spoken Transcript
                  </div>
                  <div className="text-xs text-white font-medium italic">"{voiceState.transcript}"</div>
                </div>
              )}

              {voiceState.replyText && (
                <div className="p-3 bg-[#0c1a2e] rounded-lg border border-[#1e3a5f]">
                  <div className="text-[10px] uppercase font-mono text-[#38bdf8] tracking-wider mb-1 flex items-center justify-between">
                    <span>Natural Language Response</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => speakText(voiceState.replyText)}
                        className="flex items-center gap-1 text-[11px] text-[#38bdf8] hover:underline"
                        title="Play spoken response"
                      >
                        <Volume2 className="w-3.5 h-3.5" /> Play
                      </button>
                      <button
                        onClick={() => {
                          if ('speechSynthesis' in window) {
                            window.speechSynthesis.cancel()
                          }
                          setVoiceState({ isSpeaking: false })
                        }}
                        className="flex items-center gap-1 text-[11px] text-rose-400 hover:underline"
                        title="Stop speaking"
                      >
                        <VolumeX className="w-3.5 h-3.5" /> Stop
                      </button>
                      {voiceState.lastAudioBase64 && (
                        <button
                          onClick={downloadLastSpokenAudio}
                          className="flex items-center gap-1 text-[11px] text-emerald-400 hover:underline ml-1"
                          title="Download audio briefing"
                        >
                          <Download className="w-3 h-3" /> Audio
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-[#e2e8f0] leading-relaxed">{voiceState.replyText}</div>
                </div>
              )}

              {/* Supported Geospatial Voice Commands */}
              <div>
                <div className="text-[11px] font-semibold text-[#94a3b8] mb-2 uppercase tracking-wider flex items-center justify-between">
                  <span>Supported Voice Commands</span>
                  <span className="text-[10px] text-[#64748b]">Click or Speak</span>
                </div>
                <div className="grid grid-cols-1 gap-1.5 max-h-[190px] overflow-y-auto pr-1">
                  {[
                    'Analyze this area.',
                    'Continue my previous investigation.',
                    'Show me which analysis tasks remain.',
                    'What is the estimated height of the selected building?',
                    'Compare the before and after images.',
                    'Summarize the terrain analysis.',
                    'Generate a report for this analysis.',
                    'Stop speaking.',
                  ].map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => handleQuickCommand(cmd)}
                      className="text-left text-xs px-2.5 py-1.5 rounded bg-[#0f172a] border border-[#1e293b] text-[#cbd5e1] hover:text-white hover:border-[#38bdf8] hover:bg-[#1e293b] transition-colors flex items-center justify-between group"
                    >
                      <span className="truncate">"{cmd}"</span>
                      <ChevronRight className="w-3 h-3 text-[#64748b] group-hover:text-[#38bdf8] shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Agent37 Geospatial AI Assistant */}
          {activeTab === 'agent37' && (
            <div className="flex-1 flex flex-col p-4 overflow-hidden">
              {/* Model Discovery & Configuration Bar */}
              <div className="mb-2 p-2 bg-[#0c1424] border border-[#1e293b] rounded-lg text-xs">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-mono text-[#64748b]">Model:</span>
                    <select
                      value={agent37ModelCatalog?.configured_model || 'agent37-hermes:default'}
                      onChange={(e) => selectAgent37Model(e.target.value)}
                      className="bg-[#090d16] text-[#38bdf8] text-[11px] font-mono rounded px-2 py-0.5 border border-[#1e293b] focus:outline-none focus:border-[#38bdf8]"
                    >
                      {(agent37ModelCatalog?.available_models || [
                        { id: 'agent37-hermes:default', name: 'Hermes (Agent37 Managed Model)' },
                        { id: 'agent37-opencode:default', name: 'OpenCode Coding Agent' },
                        { id: 'agent37-pi:default', name: 'Pi Minimal Harness' },
                      ]).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    {agent37ModelCatalog?.account_restrictions?.active_instances_count === 0
                      ? 'Local Grounded + Auto-Sleep'
                      : 'Cloud Instance Active'}
                  </span>
                </div>
                <div className="text-[9px] text-[#64748b] flex items-center justify-between">
                  <span>Scientific ML: ResNet50 U-Net (height_v2.pt) + SIHE</span>
                  <span>11 Templates Verified</span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#94a3b8] mb-2">
                <span>Verified Tool Protocol: Read-Only Geospatial Context</span>
                <button
                  onClick={clearAgent37History}
                  className="hover:text-white underline text-[10px]"
                >
                  Clear History
                </button>
              </div>

              {/* Chat Thread */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 pr-1 max-h-[300px]">
                {agent37Messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`p-3 rounded-lg text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#1e293b] text-white ml-6'
                        : 'bg-[#0f172a] border border-[#1e293b] text-[#e2e8f0] mr-4'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 text-[10px] text-[#64748b]">
                      <span className="font-semibold uppercase">{msg.role === 'user' ? 'You' : 'Agent37'}</span>
                      <div className="flex items-center gap-1.5">
                        {msg.modelUsed && (
                          <span
                            className="text-[#a78bfa] font-mono text-[9px] bg-[#6d28d9]/20 px-1 rounded"
                            title="Verified model runtime provenance"
                          >
                            {msg.modelUsed.replace('terrascope-local-grounded:', 'local:').replace('agent37-', '')}
                          </span>
                        )}
                        {msg.investigationId && (
                          <span className="text-[#38bdf8] font-mono text-[9px] bg-[#0369a1]/20 px-1 rounded">
                            {msg.investigationId}
                          </span>
                        )}
                        {msg.verificationStatus && (
                          <span className="text-emerald-400 font-mono text-[9px]">
                            ✓ {msg.verificationStatus}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="whitespace-pre-line">{msg.text}</div>
                    {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                      <div className="mt-2 pt-1 border-t border-[#1e293b] text-[10px] text-[#94a3b8] font-mono">
                        Tools: {msg.toolsUsed.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
                {isAgent37Thinking && (
                  <div className="p-3 bg-[#0f172a] rounded-lg border border-[#1e293b] text-xs text-[#94a3b8] italic animate-pulse">
                    Agent37 is evaluating geospatial telemetry & building footprints...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
          )}

          {/* Bottom Prompt Input Form */}
          <form
            onSubmit={handleSubmitText}
            className="p-3 bg-[#0c1322] border-t border-[#1e293b] flex items-center gap-2"
          >
            <input
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={
                activeTab === 'voice'
                  ? 'Speak or type a voice command...'
                  : 'Ask Agent37 about heights, slopes, or damage...'
              }
              className="flex-1 px-3 py-1.5 bg-[#090d16] border border-[#1e293b] rounded-lg text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8]"
            />
            <button
              type="submit"
              disabled={!customInput.trim() || isAgent37Thinking}
              className="px-3 py-1.5 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
export default VoiceAssistantWidget
