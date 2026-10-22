import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Volume2, VolumeX, Radio, Headphones,
  Sparkles, Wifi, WifiOff, AlertCircle, PhoneCall, PhoneOff,
  Copy, Check, ShieldCheck, ChevronDown, ChevronUp
} from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export default function SquadVoiceBar({ teamId, me, members = [], onSpeakingMapChange }) {
  const [joined, setJoined] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);
  const [connectedPeers, setConnectedPeers] = useState([]);
  const [speakingPeers, setSpeakingPeers] = useState({});
  const [peerMuteStates, setPeerMuteStates] = useState({});
  const [micError, setMicError] = useState(null);
  const [showHttpGuide, setShowHttpGuide] = useState(false);
  const [copiedFlag, setCopiedFlag] = useState(false);

  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef({}); // student_id -> RTCPeerConnection
  const audioElementsRef = useRef({}); // student_id -> HTMLAudioElement
  const audioContextRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const isSpeakingRef = useRef(false);
  const animationFrameRef = useRef(null);

  // Notify parent component about live speaking states for avatar glow
  useEffect(() => {
    if (onSpeakingMapChange) {
      onSpeakingMapChange(speakingPeers);
    }
  }, [speakingPeers, onSpeakingMapChange]);

  // Resolve WebSocket URL dynamically based on environment
  const getWsUrl = useCallback(() => {
    const isHttps = window.location.protocol === 'https:';
    const wsProto = isHttps ? 'wss:' : 'ws:';
    let host = window.location.host;
    // Vite dev server fallback to port 8000
    if (window.location.port === '5173') {
      host = `${window.location.hostname}:8000`;
    }
    return `${wsProto}//${host}/api/collab/ws/voice/${teamId}/${me.student_id}`;
  }, [teamId, me.student_id]);

  // Clean up all resources
  const leaveVoice = useCallback(() => {
    // Stop local mic tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    // Stop speaking detection
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }

    // Close all peer connections
    Object.entries(peerConnectionsRef.current).forEach(([sid, pc]) => {
      try {
        pc.close();
      } catch (e) {}
    });
    peerConnectionsRef.current = {};

    // Remove all audio elements
    Object.entries(audioElementsRef.current).forEach(([sid, audio]) => {
      try {
        audio.pause();
        audio.srcObject = null;
      } catch (e) {}
    });
    audioElementsRef.current = {};

    // Close WebSocket
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    setJoined(false);
    setConnecting(false);
    setConnectedPeers([]);
    setSpeakingPeers({});
    setPeerMuteStates({});
  }, []);

  // Monitor local speaking volume using Web Audio Analyser
  const setupLocalVolumeMonitor = (stream) => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      localAnalyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        if (!analyser || !joined || isMuted) {
          if (isSpeakingRef.current) {
            isSpeakingRef.current = false;
            setSpeakingPeers((prev) => ({ ...prev, [me.student_id]: false }));
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(JSON.stringify({ type: 'speaking-state', speaking: false }));
            }
          }
          animationFrameRef.current = requestAnimationFrame(checkVolume);
          return;
        }

        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        const nowSpeaking = average > 18; // Speaking threshold

        if (nowSpeaking !== isSpeakingRef.current) {
          isSpeakingRef.current = nowSpeaking;
          setSpeakingPeers((prev) => ({ ...prev, [me.student_id]: nowSpeaking }));
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'speaking-state', speaking: nowSpeaking }));
          }
        }

        animationFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (e) {
      console.warn('Volume monitor initialization error:', e);
    }
  };

  // Helper to create RTCPeerConnection for a peer
  const getOrCreatePeerConnection = (targetId) => {
    if (peerConnectionsRef.current[targetId]) {
      return peerConnectionsRef.current[targetId];
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionsRef.current[targetId] = pc;

    // Send ICE candidates to target peer
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'webrtc-candidate',
            target: targetId,
            candidate: event.candidate
          })
        );
      }
    };

    // Attach remote audio track when received
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (!remoteStream) return;

      let audio = audioElementsRef.current[targetId];
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audio.playsInline = true;
        audioElementsRef.current[targetId] = audio;
      }
      audio.srcObject = remoteStream;
      audio.muted = isDeafened;
      audio.play().catch(() => {});
    };

    // Add local tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    return pc;
  };

  // Connect to Squad Voice Channel
  const joinVoice = async () => {
    setConnecting(true);
    setMicError(null);

    // 1. Check browser microphone capabilities
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setMicError('Insecure HTTP context. Enable Chrome flag to allow microphone on college network.');
      setShowHttpGuide(true);
      setConnecting(false);
      return;
    }

    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });
      localStreamRef.current = stream;
    } catch (err) {
      console.error('Microphone access denied or failed:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicError('Microphone permission was denied. Please allow microphone in browser bar.');
      } else {
        setMicError('Microphone not detected or blocked on HTTP. Follow the quick guide below.');
        setShowHttpGuide(true);
      }
      setConnecting(false);
      return;
    }

    // 2. Connect WebSocket to FastAPI
    try {
      const wsUrl = getWsUrl();
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setJoined(true);
        setConnecting(false);
        setupLocalVolumeMonitor(stream);
        // Announce initial metadata
        ws.send(
          JSON.stringify({
            type: 'meta-update',
            meta: {
              name: me.name,
              role: me.role,
              muted: false
            }
          })
        );
      };

      ws.onmessage = async (evt) => {
        try {
          const data = JSON.parse(evt.data);
          const { type, sender, target } = data;

          if (type === 'room-state') {
            const peers = data.existing_peers || [];
            setConnectedPeers(peers);
            // Initiate WebRTC offers to all existing peers in the room
            for (const peerId of peers) {
              const pc = getOrCreatePeerConnection(peerId);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              ws.send(
                JSON.stringify({
                  type: 'webrtc-offer',
                  target: peerId,
                  offer
                })
              );
            }
          } else if (type === 'peer-joined') {
            const peerId = data.student_id;
            setConnectedPeers((prev) => Array.from(new Set([...prev, peerId])));
            getOrCreatePeerConnection(peerId);
          } else if (type === 'peer-left') {
            const peerId = data.student_id;
            setConnectedPeers((prev) => prev.filter((id) => id !== peerId));
            setSpeakingPeers((prev) => {
              const next = { ...prev };
              delete next[peerId];
              return next;
            });
            if (peerConnectionsRef.current[peerId]) {
              try {
                peerConnectionsRef.current[peerId].close();
              } catch (e) {}
              delete peerConnectionsRef.current[peerId];
            }
            if (audioElementsRef.current[peerId]) {
              try {
                audioElementsRef.current[peerId].pause();
                audioElementsRef.current[peerId].srcObject = null;
              } catch (e) {}
              delete audioElementsRef.current[peerId];
            }
          } else if (type === 'webrtc-offer' && (!target || target === me.student_id)) {
            const pc = getOrCreatePeerConnection(sender);
            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            ws.send(
              JSON.stringify({
                type: 'webrtc-answer',
                target: sender,
                answer
              })
            );
          } else if (type === 'webrtc-answer' && (!target || target === me.student_id)) {
            const pc = peerConnectionsRef.current[sender];
            if (pc) {
              await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
          } else if (type === 'webrtc-candidate' && (!target || target === me.student_id)) {
            const pc = peerConnectionsRef.current[sender];
            if (pc && data.candidate) {
              try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
              } catch (e) {}
            }
          } else if (type === 'speaking-state') {
            setSpeakingPeers((prev) => ({
              ...prev,
              [sender]: !!data.speaking
            }));
          } else if (type === 'mute-state') {
            setPeerMuteStates((prev) => ({
              ...prev,
              [sender]: !!data.muted
            }));
          }
        } catch (e) {
          console.error('WebSocket message handling error:', e);
        }
      };

      ws.onerror = () => {
        setConnecting(false);
      };

      ws.onclose = () => {
        leaveVoice();
      };
    } catch (err) {
      console.error('Voice connection failed:', err);
      setConnecting(false);
      setMicError('Could not connect to Voice Gateway.');
    }
  };

  // Toggle Mute / Unmute
  const toggleMute = () => {
    if (!localStreamRef.current) return;
    const nextMuted = !isMuted;
    localStreamRef.current.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);

    if (nextMuted) {
      setSpeakingPeers((prev) => ({ ...prev, [me.student_id]: false }));
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'mute-state',
          muted: nextMuted,
          meta: { muted: nextMuted }
        })
      );
    }
  };

  // Toggle Deafen (Mute incoming teammate audio)
  const toggleDeafen = () => {
    const nextDeaf = !isDeafened;
    setIsDeafened(nextDeaf);
    Object.values(audioElementsRef.current).forEach((audio) => {
      audio.muted = nextDeaf;
    });
  };

  // Copy chrome flag text for 1-click college lab setup
  const copyChromeFlag = () => {
    const origin = `${window.location.protocol}//${window.location.host}`;
    navigator.clipboard.writeText(origin);
    setCopiedFlag(true);
    setTimeout(() => setCopiedFlag(false), 2500);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      leaveVoice();
    };
  }, [leaveVoice]);

  const roleStyles = {
    Visionary: { bg: 'from-purple-600/30 to-indigo-600/30', border: 'border-purple-500/50', text: 'text-purple-400' },
    Mentor: { bg: 'from-emerald-600/30 to-teal-600/30', border: 'border-emerald-500/50', text: 'text-emerald-400' },
    Pioneer: { bg: 'from-blue-600/30 to-cyan-600/30', border: 'border-blue-500/50', text: 'text-blue-400' },
    Conqueror: { bg: 'from-amber-600/30 to-orange-600/30', border: 'border-amber-500/50', text: 'text-amber-400' }
  };

  return (
    <div className="w-full bg-slate-900/90 border-b border-indigo-500/30 px-4 py-2 transition-all">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        
        {/* Left: Squad Voice Title & Live Status */}
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className={`p-1.5 rounded-lg flex items-center justify-center ${
              joined
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/30 animate-pulse'
                : 'bg-slate-800 text-slate-400'
            }`}>
              <Headphones className="w-4 h-4" />
            </div>
            {joined && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-2 ring-slate-900 animate-ping" />
            )}
          </div>

          <div>
            <div className="flex items-center gap-1.5 font-black text-white tracking-wide uppercase text-[11px]">
              <span>Squad Voice Chat</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">
                FREE FIRE MODE
              </span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
              {joined ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  <span className="text-emerald-400 font-semibold">
                    Live ({connectedPeers.length + 1}/4 in voice)
                  </span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" />
                  <span>Channel Standby • 0 Cost P2P Mesh</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Teammates Voice Status Badges */}
        <div className="flex items-center gap-2 flex-1 justify-center min-w-[280px]">
          {members.map((m) => {
            const isMe = m.student_id === me.student_id;
            const inVoice = isMe ? joined : connectedPeers.includes(m.student_id);
            const speaking = speakingPeers[m.student_id];
            const peerMuted = isMe ? isMuted : peerMuteStates[m.student_id];
            const roleStyle = roleStyles[m.role] || {
              bg: 'from-slate-800 to-slate-900',
              border: 'border-slate-700',
              text: 'text-slate-300'
            };

            return (
              <div
                key={m.student_id}
                className={`relative px-2.5 py-1 rounded-xl border flex items-center gap-1.5 transition-all duration-200 ${
                  speaking
                    ? 'ring-2 ring-emerald-400 border-emerald-400 bg-emerald-950/70 shadow-lg shadow-emerald-500/40 scale-105'
                    : inVoice
                    ? 'bg-gradient-to-r ' + roleStyle.bg + ' ' + roleStyle.border
                    : 'bg-slate-950/50 border-slate-800 opacity-50'
                }`}
                title={`${m.name} (${m.role}) - ${
                  speaking ? 'Speaking...' : inVoice ? (peerMuted ? 'Muted' : 'Listening') : 'Not in voice'
                }`}
              >
                {/* Voice Status Icon */}
                <div className="shrink-0">
                  {speaking ? (
                    <Radio className="w-3.5 h-3.5 text-emerald-300 animate-spin" />
                  ) : peerMuted ? (
                    <MicOff className="w-3.5 h-3.5 text-rose-400" />
                  ) : inVoice ? (
                    <Mic className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <WifiOff className="w-3 h-3 text-slate-500" />
                  )}
                </div>

                <div className="text-left leading-tight">
                  <div className="flex items-center gap-1 font-bold text-[10px] text-white truncate max-w-[80px]">
                    <span className="truncate">{m.name.split(' ')[0]}</span>
                    {isMe && <span className="text-[8px] text-indigo-400">(You)</span>}
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-wider block ${roleStyle.text}`}>
                    {m.role}
                  </span>
                </div>

                {/* Animated Speaking Waves Bar */}
                {speaking && (
                  <span className="flex items-center gap-0.5 ml-0.5">
                    <span className="w-0.5 h-2.5 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-0.5 h-3.5 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-0.5 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Tactical Action Controls */}
        <div className="flex items-center gap-2">
          {!joined ? (
            <button
              onClick={joinVoice}
              disabled={connecting}
              className={`px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 text-white transition-all cursor-pointer shadow-lg ${
                connecting
                  ? 'bg-slate-700 cursor-wait'
                  : 'bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 shadow-emerald-600/30 hover:scale-105 active:scale-95'
              }`}
            >
              <PhoneCall className="w-3.5 h-3.5 animate-bounce" />
              <span>{connecting ? 'Connecting...' : 'Join Squad Voice'}</span>
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {/* Mic Toggle Button */}
              <button
                onClick={toggleMute}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 text-[11px] transition-all cursor-pointer ${
                  isMuted
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 animate-pulse'
                }`}
                title={isMuted ? 'Click to Unmute Mic' : 'Click to Mute Mic'}
              >
                {isMuted ? <MicOff className="w-3.5 h-3.5 text-rose-400" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isMuted ? 'Muted' : 'Mic ON'}</span>
              </button>

              {/* Deafen / Speaker Button */}
              <button
                onClick={toggleDeafen}
                className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                  isDeafened
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
                title={isDeafened ? 'Undeafen Team Audio' : 'Deafen (Mute Team)'}
              >
                {isDeafened ? <VolumeX className="w-3.5 h-3.5 text-amber-400" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {/* Disconnect Voice Button */}
              <button
                onClick={leaveVoice}
                className="p-1.5 rounded-lg bg-rose-900/40 hover:bg-rose-900/60 border border-rose-500/30 text-rose-300 transition-all cursor-pointer"
                title="Disconnect from Squad Voice"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Quick Chrome HTTP / Lab Wi-Fi Help Toggle */}
          <button
            onClick={() => setShowHttpGuide(!showHttpGuide)}
            className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-400 hover:text-indigo-300 transition-all cursor-pointer"
            title="College Wi-Fi / Mic Setup Guide"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mic Permission Warning or Error Banner */}
      {micError && (
        <div className="max-w-7xl mx-auto mt-2 p-2 rounded-xl bg-amber-950/60 border border-amber-500/50 flex items-center justify-between gap-2 text-[11px] text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{micError}</span>
          </div>
          <button
            onClick={() => setShowHttpGuide(true)}
            className="px-2 py-0.5 rounded bg-amber-500/30 hover:bg-amber-500/50 text-amber-100 font-bold underline cursor-pointer"
          >
            Show Quick Setup
          </button>
        </div>
      )}

      {/* College Wi-Fi / HTTP Chrome Flag Instructions (Collapsible) */}
      {showHttpGuide && (
        <div className="max-w-7xl mx-auto mt-2 p-3 rounded-2xl bg-slate-950 border border-indigo-500/40 text-slate-300 text-xs space-y-2 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-indigo-400 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              College Wi-Fi Mic Permission (10-Second One-Time Setup in Chrome / Edge)
            </span>
            <button
              onClick={() => setShowHttpGuide(false)}
              className="text-slate-400 hover:text-white font-bold px-1"
            >
              ✕
            </button>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Because this platform runs on the local college server (<span className="text-indigo-300 font-mono">10.10.35.92</span>), modern browsers require a one-time permission to enable microphone on HTTP:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-300">
            <li>
              Open a new tab and paste:{' '}
              <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-amber-300 select-all">
                chrome://flags/#unsafely-treat-insecure-origin-as-secure
              </span>
            </li>
            <li>
              Paste this URL in the box:{' '}
              <span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-emerald-300 font-bold select-all">
                {window.location.protocol}//{window.location.host}
              </span>
              <button
                onClick={copyChromeFlag}
                className="ml-2 px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
              >
                {copiedFlag ? <Check className="w-2.5 h-2.5" /> : <Copy className="w-2.5 h-2.5" />}
                {copiedFlag ? 'Copied!' : 'Copy URL'}
              </button>
            </li>
            <li>Select <span className="text-white font-bold">"Enabled"</span> and click <span className="text-white font-bold">"Relaunch"</span>.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
