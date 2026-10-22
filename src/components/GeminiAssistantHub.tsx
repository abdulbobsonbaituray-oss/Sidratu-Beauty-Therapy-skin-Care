import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Mic,
  MicOff,
  Globe,
  MapPin,
  ExternalLink,
  Volume2,
  RefreshCw,
  Trash2
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modelUsed?: string;
  timestamp: string;
}

interface SearchSource {
  title: string;
  uri: string;
}

interface MapPlace {
  title: string;
  uri: string;
  reviewSnippets?: string[];
}

interface GeminiAssistantHubProps {
  currentUserName: string;
  currentUserRole: string;
  onNotify: (msg: string) => void;
}

function floatTo16BitPCMBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export default function GeminiAssistantHub({
  currentUserName,
  currentUserRole,
  onNotify
}: GeminiAssistantHubProps) {
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'voice' | 'search' | 'maps'>('chat');

  // =========================================================================
  // 1. MULTI-TURN GEMINI CHATBOT STATE
  // =========================================================================
  const [chatMode, setChatMode] = useState<'fast' | 'general' | 'complex'>('general');
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'model',
      text: `Welcome to Sidratu Beauty Therapy Skin Care at 101 Jomo Kenyatta Road, Freetown! I am your AI Clinical Concierge. Ask me about HydraFacials, Chemical Peels, PRP, Dental Braces, Laser Teeth Whitening, or pre-care and post-care routines.`,
      modelUsed: 'gemini-3.8-flash',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, chatLoading]);

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;

    const userMsg: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };

    const nextHistory = [...chatMessages, userMsg];
    setChatMessages(nextHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextHistory.map(m => ({ role: m.role, text: m.text })),
          mode: chatMode,
          roleContext: `${currentUserName} (${currentUserRole})`
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Chat request failed');
      }

      setChatMessages(prev => [
        ...prev,
        {
          id: 'msg_' + Date.now() + '_ai',
          role: 'model',
          text: data.text,
          modelUsed: data.modelUsed,
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
          })
        }
      ]);
    } catch (err: any) {
      onNotify(err?.message || 'Could not reach Gemini Chat service.');
    } finally {
      setChatLoading(false);
    }
  };

  // =========================================================================
  // 2. LIVE VOICE CONVERSATION STATE (gemini-3.8-live)
  // =========================================================================
  const [liveConnected, setLiveConnected] = useState(false);
  const [liveConnecting, setLiveConnecting] = useState(false);
  const [liveTranscripts, setLiveTranscripts] = useState<
    Array<{ speaker: 'You' | 'Sidratu Live AI'; text: string }>
  >([]);
  const [liveTextPrompt, setLiveTextPrompt] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  const stopLiveSession = () => {
    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch {}
      processorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      try {
        inputAudioCtxRef.current.close();
      } catch {}
      inputAudioCtxRef.current = null;
    }
    activeSourcesRef.current.forEach(s => {
      try {
        s.stop();
      } catch {}
    });
    activeSourcesRef.current = [];
    if (outputAudioCtxRef.current) {
      try {
        outputAudioCtxRef.current.close();
      } catch {}
      outputAudioCtxRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch {}
      wsRef.current = null;
    }
    nextStartTimeRef.current = 0;
    setLiveConnected(false);
    setLiveConnecting(false);
  };

  useEffect(() => {
    return () => {
      stopLiveSession();
    };
  }, []);

  const playPcmChunk24k = (base64Pcm: string) => {
    const outCtx = outputAudioCtxRef.current;
    if (!outCtx) return;

    const binary = atob(base64Pcm);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = outCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = outCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(outCtx.destination);

    const now = outCtx.currentTime;
    const startTime = Math.max(now, nextStartTimeRef.current);
    source.start(startTime);
    nextStartTimeRef.current = startTime + audioBuffer.duration;
    activeSourcesRef.current.push(source);
  };

  const startLiveSession = async () => {
    if (liveConnected || liveConnecting) return;
    setLiveConnecting(true);

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/live`);
      wsRef.current = ws;

      const inputCtx = new AudioContext({ sampleRate: 16000 });
      const outputCtx = new AudioContext({ sampleRate: 24000 });
      inputAudioCtxRef.current = inputCtx;
      outputAudioCtxRef.current = outputCtx;
      nextStartTimeRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      processor.onaudioprocess = e => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          const channelData = e.inputBuffer.getChannelData(0);
          const base64Audio = floatTo16BitPCMBase64(channelData);
          wsRef.current.send(JSON.stringify({ audio: base64Audio }));
        }
      };

      ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.status === 'connected') {
            setLiveConnected(true);
            setLiveConnecting(false);
            onNotify('Connected to Gemini 3.8 Live Voice Concierge.');
          }
          if (msg.audio) {
            playPcmChunk24k(msg.audio);
          }
          if (msg.inputTranscript) {
            setLiveTranscripts(prev => [
              ...prev,
              { speaker: 'You', text: msg.inputTranscript }
            ]);
          }
          if (msg.outputTranscript) {
            setLiveTranscripts(prev => [
              ...prev,
              { speaker: 'Sidratu Live AI', text: msg.outputTranscript }
            ]);
          }
          if (msg.interrupted) {
            activeSourcesRef.current.forEach(s => {
              try {
                s.stop();
              } catch {}
            });
            activeSourcesRef.current = [];
            if (outputAudioCtxRef.current) {
              nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
            }
          }
          if (msg.error) {
            onNotify(msg.error);
          }
        } catch {}
      };

      ws.onerror = () => {
        onNotify('Live voice connection interrupted.');
        stopLiveSession();
      };

      ws.onclose = () => {
        stopLiveSession();
      };
    } catch (err: any) {
      onNotify(
        err?.message ||
          'Microphone permission is required for real-time voice conversations.'
      );
      stopLiveSession();
    }
  };

  const sendLiveTextTurn = (e: React.FormEvent) => {
    e.preventDefault();
    const txt = liveTextPrompt.trim();
    if (!txt || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text: txt }));
    setLiveTranscripts(prev => [...prev, { speaker: 'You', text: txt }]);
    setLiveTextPrompt('');
  };

  // =========================================================================
  // 3. GOOGLE SEARCH GROUNDING STATE (gemini-3.8-flash + googleSearch)
  // =========================================================================
  const [searchQuery, setSearchQuery] = useState(
    'Best post-care routine after HydraFacial and chemical peel in tropical sunny climates'
  );
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResultText, setSearchResultText] = useState('');
  const [searchSources, setSearchSources] = useState<SearchSource[]>([]);

  const handleRunSearchGrounding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchLoading) return;
    setSearchLoading(true);
    try {
      const res = await fetch('/api/gemini/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Search grounding failed');
      setSearchResultText(data.text || '');
      setSearchSources(data.sources || []);
    } catch (err: any) {
      onNotify(err?.message || 'Google Search Grounding failed.');
    } finally {
      setSearchLoading(false);
    }
  };

  // =========================================================================
  // 4. GOOGLE MAPS GROUNDING STATE (gemini-3.8-flash + googleMaps)
  // =========================================================================
  const [mapsQuery, setMapsQuery] = useState(
    'Pharmacies, landmarks, and wellness spots near Jomo Kenyatta Road, Freetown, Sierra Leone'
  );
  const [mapsLoading, setMapsLoading] = useState(false);
  const [mapsResultText, setMapsResultText] = useState('');
  const [mapsPlaces, setMapsPlaces] = useState<MapPlace[]>([]);

  const handleRunMapsGrounding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mapsQuery.trim() || mapsLoading) return;
    setMapsLoading(true);

    let lat = 8.479;
    let lng = -13.246;

    try {
      const res = await fetch('/api/gemini/maps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: mapsQuery.trim(),
          latitude: lat,
          longitude: lng
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Maps grounding failed');
      setMapsResultText(data.text || '');
      setMapsPlaces(data.places || []);
    } catch (err: any) {
      onNotify(err?.message || 'Google Maps Grounding failed.');
    } finally {
      setMapsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation for the 4 AI Capabilities */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6DEC8] pb-4">
        <div>
          <h3 className="font-display text-xl font-bold flex items-center gap-2">
            <Bot className="w-5 h-5 text-[#D4AF37]" />
            <span>Sidratu Gemini AI Suite (Chat, Live Voice, Search & Maps)</span>
          </h3>
          <p className="text-xs opacity-75">
            Powered by Gemini multi-turn chat, real-time Live Voice API, Google Search grounding, and Google Maps grounding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl border border-[#D4AF37]/60">
          <button
            type="button"
            onClick={() => setActiveSubTab('chat')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
              activeSubTab === 'chat' ? 'gold-btn' : 'opacity-80 hover:opacity-100'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            <span>Gemini Chatbot</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('voice')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
              activeSubTab === 'voice' ? 'gold-btn' : 'opacity-80 hover:opacity-100'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Live Voice (gemini-3.8-live)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('search')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
              activeSubTab === 'search' ? 'gold-btn' : 'opacity-80 hover:opacity-100'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Google Search Data</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('maps')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap transition ${
              activeSubTab === 'maps' ? 'gold-btn' : 'opacity-80 hover:opacity-100'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Google Maps Data</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: MULTI-TURN GEMINI CHATBOT
          ===================================================================== */}
      {activeSubTab === 'chat' && (
        <div className="p-4 rounded-xl border border-[#D4AF37] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold">
              Multi-Turn Clinical & Skincare Chatbot · Select Model Tier:
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setChatMode('fast')}
                className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                  chatMode === 'fast' ? 'gold-btn' : 'border border-[#E6DEC8]'
                }`}
              >
                Fast (gemini-3.1-flash-lite)
              </button>
              <button
                type="button"
                onClick={() => setChatMode('general')}
                className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                  chatMode === 'general' ? 'gold-btn' : 'border border-[#E6DEC8]'
                }`}
              >
                General (gemini-3.8-flash)
              </button>
              <button
                type="button"
                onClick={() => setChatMode('complex')}
                className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap ${
                  chatMode === 'complex' ? 'gold-btn' : 'border border-[#E6DEC8]'
                }`}
              >
                Complex (gemini-4-argon)
              </button>
              <button
                type="button"
                onClick={() =>
                  setChatMessages([
                    {
                      id: 'reset_' + Date.now(),
                      role: 'model',
                      text: 'Conversation history cleared. How can I help with your skin, dental, or aesthetic goals today?',
                      modelUsed: 'gemini-3.8-flash',
                      timestamp: new Date().toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    }
                  ])
                }
                className="p-1.5 rounded border border-[#E6DEC8] hover:border-[#D4AF37]"
                title="Clear Chat History"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Message Thread */}
          <div
            ref={chatScrollRef}
            className="h-72 overflow-y-auto space-y-3 p-3 rounded-xl border border-[#E6DEC8]"
          >
            {chatMessages.map(m => (
              <div
                key={m.id}
                className={`p-3 rounded-xl text-sm space-y-1 ${
                  m.role === 'user'
                    ? 'bg-purple-950/10 border border-[#D4AF37]/50 ml-8'
                    : 'border border-[#E6DEC8] mr-8'
                }`}
              >
                <div className="flex items-center justify-between text-xs opacity-70">
                  <span className="font-bold">
                    {m.role === 'user' ? currentUserName : 'Sidratu AI Concierge'}
                  </span>
                  <span className="font-mono-tabular">
                    {m.modelUsed ? `${m.modelUsed} · ` : ''}
                    {m.timestamp}
                  </span>
                </div>
                <div className="whitespace-pre-wrap leading-relaxed">{m.text}</div>
              </div>
            ))}
            {chatLoading && (
              <div className="p-3 rounded-xl border border-[#E6DEC8] mr-8 flex items-center gap-2 text-xs opacity-75">
                <RefreshCw className="w-4 h-4 animate-spin text-[#D4AF37]" />
                <span>Sidratu AI Concierge is thinking...</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSendChat} className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Ask about HydraFacial, PRP, Dental Braces, post-care, or clinic booking..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm"
            />
            <button
              type="submit"
              disabled={chatLoading}
              className="px-5 py-2.5 rounded-xl gold-btn text-sm flex items-center gap-1.5 whitespace-nowrap"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}

      {/* =====================================================================
          TAB 2: REAL-TIME VOICE CONVERSATION (gemini-3.8-live)
          ===================================================================== */}
      {activeSubTab === 'voice' && (
        <div className="p-5 rounded-xl border border-[#D4AF37] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="font-bold text-base flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-[#D4AF37]" />
                <span>Real-Time Voice Consultation (gemini-3.8-live)</span>
              </h4>
              <p className="text-xs opacity-80">
                Speak naturally with Sidratu Beauty Therapy's Live AI voice specialist for hands-free pre-care and post-care guidance.
              </p>
            </div>

            {!liveConnected ? (
              <button
                type="button"
                onClick={startLiveSession}
                disabled={liveConnecting}
                className="px-5 py-3 rounded-xl gold-btn text-sm flex items-center gap-2 shadow whitespace-nowrap"
              >
                {liveConnecting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Connecting Live Audio...</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    <span>Start Live Voice Conversation</span>
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={stopLiveSession}
                className="px-5 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-sm flex items-center gap-2 shadow whitespace-nowrap"
              >
                <MicOff className="w-4 h-4" />
                <span>End Voice Session</span>
              </button>
            )}
          </div>

          <div className="p-3.5 rounded-xl border border-[#E6DEC8] space-y-2">
            <div className="text-xs font-bold text-[#D4AF37]">
              Status:{' '}
              {liveConnected
                ? 'Live Microphone Streaming Active (16kHz In / 24kHz Out)'
                : 'Ready to Start'}
            </div>
            <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs">
              {liveTranscripts.length === 0 ? (
                <p className="opacity-70 italic">
                  Click "Start Live Voice Conversation" and speak into your microphone, or send a live prompt below while connected.
                </p>
              ) : (
                liveTranscripts.map((t, idx) => (
                  <div key={idx}>
                    <strong>{t.speaker}:</strong> {t.text}
                  </div>
                ))
              )}
            </div>
          </div>

          {liveConnected && (
            <form onSubmit={sendLiveTextTurn} className="flex gap-2">
              <input
                type="text"
                value={liveTextPrompt}
                onChange={e => setLiveTextPrompt(e.target.value)}
                placeholder="Or type a message to receive a spoken voice reply from gemini-3.8-live..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 bg-white text-gray-900 text-xs"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg plum-btn text-xs font-bold whitespace-nowrap"
              >
                Speak Reply
              </button>
            </form>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: GOOGLE SEARCH GROUNDING (gemini-3.8-flash + googleSearch)
          ===================================================================== */}
      {activeSubTab === 'search' && (
        <div className="p-5 rounded-xl border border-[#D4AF37] space-y-4">
          <div>
            <h4 className="font-bold text-base flex items-center gap-2">
              <Globe className="w-5 h-5 text-[#D4AF37]" />
              <span>Skincare & Dental Research Grounded in Google Search (gemini-3.8-flash)</span>
            </h4>
            <p className="text-xs opacity-80">
              Search live dermatological findings, active skincare ingredients, and dental care guidance with verified web citations.
            </p>
          </div>

          <form onSubmit={handleRunSearchGrounding} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search skincare ingredients, SPF science, or dental care facts..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm"
            />
            <button
              type="submit"
              disabled={searchLoading}
              className="px-5 py-2.5 rounded-xl gold-btn text-sm flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {searchLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Searching Google...</span>
                </>
              ) : (
                <>
                  <Globe className="w-4 h-4" />
                  <span>Search with Google</span>
                </>
              )}
            </button>
          </form>

          {searchResultText && (
            <div className="p-4 rounded-xl border border-[#E6DEC8] space-y-3 text-sm">
              <div className="whitespace-pre-wrap leading-relaxed">{searchResultText}</div>

              {searchSources.length > 0 && (
                <div className="pt-3 border-t border-[#E6DEC8] space-y-1.5">
                  <div className="text-xs font-bold text-[#D4AF37]">
                    Verified Google Search Sources:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {searchSources.map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline flex items-center gap-1 hover:text-[#D4AF37]"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-xs">{src.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4: GOOGLE MAPS GROUNDING (gemini-3.8-flash + googleMaps)
          ===================================================================== */}
      {activeSubTab === 'maps' && (
        <div className="p-5 rounded-xl border border-[#D4AF37] space-y-4">
          <div>
            <h4 className="font-bold text-base flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#D4AF37]" />
              <span>Clinic Location & Freetown Directory via Google Maps (gemini-3.8-flash)</span>
            </h4>
            <p className="text-xs opacity-80">
              Explore landmarks, pharmacies, and directions around <strong>101 Jomo Kenyatta Road, Freetown</strong> grounded in live Google Maps data.
            </p>
          </div>

          <form onSubmit={handleRunMapsGrounding} className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={mapsQuery}
              onChange={e => setMapsQuery(e.target.value)}
              placeholder="Ask for directions, pharmacies, or places near Jomo Kenyatta Road, Freetown..."
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-gray-900 text-sm"
            />
            <button
              type="submit"
              disabled={mapsLoading}
              className="px-5 py-2.5 rounded-xl gold-btn text-sm flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {mapsLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Querying Maps...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  <span>Search Google Maps</span>
                </>
              )}
            </button>
          </form>

          {mapsResultText && (
            <div className="p-4 rounded-xl border border-[#E6DEC8] space-y-3 text-sm">
              <div className="whitespace-pre-wrap leading-relaxed">{mapsResultText}</div>

              {mapsPlaces.length > 0 && (
                <div className="pt-3 border-t border-[#E6DEC8] space-y-2">
                  <div className="text-xs font-bold text-[#D4AF37]">
                    Google Maps Places & Links:
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {mapsPlaces.map((place, i) => (
                      <div key={i} className="p-2.5 rounded-lg border border-[#E6DEC8] space-y-1">
                        <a
                          href={place.uri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-bold underline flex items-center gap-1 text-[#D4AF37]"
                        >
                          <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                          <span>{place.title}</span>
                        </a>
                        {place.reviewSnippets && place.reviewSnippets.length > 0 && (
                          <div className="text-xs opacity-80 italic">
                            "{place.reviewSnippets[0]}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
