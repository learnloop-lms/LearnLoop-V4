import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Sparkles, Trophy, X, ArrowRight, RotateCcw, Heart, Flame, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AppreciationModal({ 
  isOpen, 
  onClose, 
  title, 
  subtitle, 
  coinsAwarded = 0,
  archetype = "Pioneers",
  type = "happy", // "happy" or "sad"
  buttonText
}) {
  const { user } = useAuth();
  const [candidateIdx, setCandidateIdx] = useState(0);
  const [videoError, setVideoError] = useState(false);

  const rawArchetype = (archetype || user?.pt_ls || 'Pioneers').toLowerCase();
  
  // Pluralized form: 'visionaries', 'mentors', 'pioneers', 'conquerors'
  const plural = rawArchetype.endsWith('s') 
    ? rawArchetype 
    : rawArchetype.endsWith('y') 
    ? rawArchetype.slice(0, -1) + 'ies' 
    : rawArchetype + 's';

  // Singular form: 'visionary', 'mentor', 'pioneer', 'conqueror'
  const singular = rawArchetype.endsWith('ies')
    ? rawArchetype.slice(0, -3) + 'y'
    : rawArchetype.endsWith('s')
    ? rawArchetype.slice(0, -1)
    : rawArchetype;

  const isSad = type === 'sad';

  // Build candidate paths in order of preference
  const candidatePaths = [
    // Preferred format requested by user: e.g. visionaries_happy_animations.mp4
    `/assets/appreciations/${plural}_${type}_animations.mp4`,
    `/assets/appreciations/${plural}_${type}_animations.webm`,
    `/assets/appreciations/${singular}_${type}_animations.mp4`,
    `/assets/appreciations/${singular}_${type}_animations.webm`,
    `/assets/appreciations/${plural}_${type}_animation.mp4`,
    `/assets/appreciations/${singular}_${type}_animation.mp4`,
    `/assets/appreciations/${plural}_${type}.mp4`,
    `/assets/appreciations/${singular}_${type}.mp4`,
    // Legacy fallbacks
    !isSad ? `/assets/appreciations/${singular}_appreciation.mp4` : null,
    !isSad ? `/assets/appreciations/${plural}_appreciation.mp4` : null,
  ].filter(Boolean);

  useEffect(() => {
    setCandidateIdx(0);
    setVideoError(false);
  }, [isOpen, type, archetype]);

  useEffect(() => {
    if (isOpen && !isSad) {
      // Fire celebration confetti only for happy achievements
      confetti({
        particleCount: 130,
        spread: 85,
        origin: { y: 0.6 }
      });
    }
  }, [isOpen, isSad]);

  const handleVideoError = () => {
    if (candidateIdx + 1 < candidatePaths.length) {
      setCandidateIdx((prev) => prev + 1);
    } else {
      setVideoError(true);
    }
  };

  if (!isOpen) return null;

  const currentVideoSrc = candidatePaths[candidateIdx];

  // Default texts if not provided
  const displayTitle = title || (isSad ? "Keep Going, Explorer!" : "Outstanding Achievement!");
  const displaySubtitle = subtitle || (isSad 
    ? "You didn't reach the required Pass Score (p) this time. Review your study materials, sharpen your focus, and try again!" 
    : "You have unlocked a new achievement & earned reward coins!");
  const displayBtnText = buttonText || (isSad ? "Review Material & Try Again" : "Continue Journey");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`relative w-full max-w-lg rounded-3xl bg-slate-950 border shadow-2xl p-6 sm:p-8 text-center text-white overflow-hidden ${
        isSad ? 'border-indigo-500/40' : 'border-amber-500/40'
      }`}>
        {/* Ambient glow */}
        {isSad ? (
          <>
            <div className="absolute -top-24 -left-24 w-60 h-60 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
          </>
        ) : (
          <>
            <div className="absolute -top-24 -left-24 w-60 h-60 bg-amber-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
          </>
        )}

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video Animation Player (Tries happy or sad file in /assets/appreciations/) */}
        {!videoError && currentVideoSrc ? (
          <div className="mb-4 rounded-2xl overflow-hidden bg-black/50 border border-slate-800 flex items-center justify-center max-h-64">
            <video
              key={currentVideoSrc}
              ref={(el) => {
                if (el) {
                  el.muted = true;
                  el.play().catch(() => {});
                }
              }}
              autoPlay
              loop
              muted
              playsInline
              onError={handleVideoError}
              className="w-full max-h-64 object-contain"
            >
              <source src={currentVideoSrc} type="video/mp4" />
            </video>
          </div>
        ) : (
          /* High-quality graphic fallback when video clip is not yet rendered */
          <div className="mx-auto w-24 h-24 mb-4 rounded-3xl p-1 shadow-lg flex items-center justify-center bg-gradient-to-tr"
            style={{
              backgroundImage: isSad 
                ? 'linear-gradient(to top right, #3b82f6, #6366f1, #8b5cf6)' 
                : 'linear-gradient(to top right, #f59e0b, #f97316, #eab308)'
            }}
          >
            <div className="w-full h-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              {isSad ? (
                <RotateCcw className="w-12 h-12 text-indigo-400 animate-spin-slow" />
              ) : (
                <Trophy className="w-12 h-12 text-amber-400 animate-bounce" />
              )}
            </div>
          </div>
        )}

        {/* Badge Header */}
        <div className={`inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 border ${
          isSad 
            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300' 
            : 'bg-amber-500/20 border-amber-500/40 text-amber-300'
        }`}>
          {isSad ? <Flame className="w-3.5 h-3.5 text-indigo-400" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
          <span>{user?.pt_ls || 'Learner'} {isSad ? 'Retry Encouragement' : 'Appreciation'}</span>
        </div>

        <h3 className="text-2xl font-black tracking-tight text-white mb-2">
          {displayTitle}
        </h3>

        <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed mb-6">
          {displaySubtitle}
        </p>

        {/* Coin Reward Box (if happy and coins earned) */}
        {!isSad && coinsAwarded > 0 && (
          <div className="inline-flex items-center gap-3 px-6 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 font-black text-base mb-6 shadow-inner">
            <span className="text-2xl">🪙</span>
            <span>+{coinsAwarded} Reward Coins Earned!</span>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={onClose}
          className={`w-full py-3.5 rounded-2xl font-black text-sm shadow-xl transition cursor-pointer flex items-center justify-center gap-2 ${
            isSad
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-indigo-500/25'
              : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-slate-950 shadow-amber-500/25'
          }`}
        >
          {isSad && <RotateCcw className="w-4 h-4" />}
          <span>{displayBtnText}</span>
          {!isSad && <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
