import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getFeedback, isVisionaryLearner } from '../services/visionaryFeedbackService';
import { Sparkles, Rocket, Compass, X } from 'lucide-react';

const VisionaryFeedbackContext = createContext(null);

export const VisionaryFeedbackProvider = ({ children }) => {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef(null);

  const dismissFeedback = useCallback(() => {
    setVisible(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setTimeout(() => {
      setFeedback(null);
    }, 300);
  }, []);

  const triggerFeedback = useCallback((trigger, context = {}) => {
    if (!user || !isVisionaryLearner(user)) {
      return null;
    }

    const res = getFeedback(user, trigger, context);
    if (!res) return null;

    // Clear previous timer if active
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setFeedback(res);
    setVisible(true);

    // Rule 6: Show the message for about 3 to 4 seconds, auto-dismisses, doesn't block learner
    timerRef.current = setTimeout(() => {
      dismissFeedback();
    }, 3800);

    return res;
  }, [user, dismissFeedback]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // Determine avatar icon for Visionary
  const avatarSrc = user?.avatar_path 
    ? (user.avatar_path.startsWith('http') ? user.avatar_path : `/${user.avatar_path.replace(/^\/+/, '')}`)
    : (user?.gender === 'female' 
        ? '/assets/visionaries/visionary_avatar_girl.png' 
        : '/assets/visionaries/visionary_avatar_boy.png');

  return (
    <VisionaryFeedbackContext.Provider value={{ triggerFeedback, dismissFeedback, activeFeedback: feedback }}>
      {children}

      {/* Floating Visionary Feedback Toast / Speech Bubble */}
      {feedback && (
        <aside
          aria-label="Visionary motivational message"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 pointer-events-none max-w-sm sm:max-w-md w-full px-4"
        >
          <div
            className={`pointer-events-auto transform transition-all duration-300 ease-out ${
              visible ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95'
            } rounded-3xl p-4 shadow-2xl backdrop-blur-xl border flex items-start gap-3.5 ${
              feedback.pool === 'FORWARD'
                ? 'bg-gradient-to-r from-slate-950/95 via-indigo-950/95 to-slate-950/95 border-cyan-500/50 shadow-cyan-500/20 text-white'
                : feedback.pool === 'FALLBACK'
                ? 'bg-gradient-to-r from-slate-950/95 via-purple-950/95 to-slate-950/95 border-purple-400/50 shadow-purple-500/20 text-white'
                : 'bg-gradient-to-r from-slate-950/95 via-blue-950/95 to-slate-950/95 border-blue-400/50 shadow-blue-500/20 text-white'
            }`}
          >
            {/* Avatar / Mission Icon */}
            <div className="relative shrink-0 mt-0.5">
              <div className="w-12 h-12 rounded-2xl p-0.5 bg-gradient-to-tr from-cyan-400 to-indigo-500 shadow-md flex items-center justify-center overflow-hidden">
                <img
                  src={avatarSrc}
                  alt="Visionary Avatar"
                  className="w-full h-full object-cover rounded-[14px]"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextSibling.style.display = 'flex';
                  }}
                />
                <div className="hidden w-full h-full items-center justify-center bg-slate-900 text-cyan-300">
                  <Rocket className="w-6 h-6 animate-pulse" />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-cyan-400 border-2 border-slate-950 flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-slate-950" />
              </span>
            </div>

            {/* Message Body */}
            <div className="flex-1 min-w-0 pr-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-cyan-400 flex items-center gap-1">
                  {feedback.pool === 'OPENING' && <Compass className="w-3 h-3" />}
                  {feedback.pool === 'FORWARD' && <Sparkles className="w-3 h-3" />}
                  {feedback.pool === 'FALLBACK' && <Rocket className="w-3 h-3" />}
                  {feedback.pool === 'OPENING' ? 'Mission Launch' : feedback.pool === 'FORWARD' ? 'Stellar Leap' : 'Course Correction'}
                </span>
                <span className="text-[9px] font-mono text-slate-400">VISIONARY</span>
              </div>
              <p className="text-xs font-medium leading-relaxed text-slate-100 antialiased selection:bg-cyan-500 selection:text-white">
                {feedback.message}
              </p>
            </div>

            {/* Quick Dismiss Button */}
            <button
              onClick={dismissFeedback}
              className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </aside>
      )}
    </VisionaryFeedbackContext.Provider>
  );
};

export const useVisionaryFeedback = () => {
  const ctx = useContext(VisionaryFeedbackContext);
  if (!ctx) {
    return {
      triggerFeedback: () => null,
      dismissFeedback: () => {},
      activeFeedback: null
    };
  }
  return ctx;
};

export default VisionaryFeedbackContext;
