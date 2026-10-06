import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Star, Eye, Check, X, Sparkles, Trophy, Award, Zap, BarChart3, Gift, Lock } from 'lucide-react';

const ELEMENTS = [
  { key: 'r_feedback', name: 'Feedback', desc: 'Real-time solution hints & conceptual explanations' },
  { key: 'r_leaderboard', name: 'Leaderboard', desc: 'Competitive ranking by points across Stepper, Jogger, Glider tiers' },
  { key: 'r_badges', name: 'Badges', desc: 'Collectible Associate, Professional, Master achievement emblems' },
  { key: 'r_progress_bar', name: 'Progress Bar', desc: 'Visual progress tracker through course syllabus' },
  { key: 'r_mystery', name: 'Mystery', desc: 'Hidden easter eggs, secret unlockable challenges & surprises' },
  { key: 'r_rewards', name: 'Rewards', desc: 'Tier-based bonus coin payouts (+100 Stepper, +250 Jogger, +500 Glider)' }
];

export default function ElementRatingModal({ moduleId, onClose }) {
  const { user, activeTheme, API_BASE, fetchProfile } = useAuth();
  const { isLight } = useTheme();
  const [ratings, setRatings] = useState({
    r_feedback: 4,
    r_leaderboard: 4,
    r_badges: 4,
    r_progress_bar: 3,
    r_mystery: 3,
    r_rewards: 4
  });
  const [previewElement, setPreviewElement] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleRate = (key, val) => {
    setRatings({ ...ratings, [key]: val });
  };

  const handleSubmit = async (isSkipped = false) => {
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/ratings/submit`, {
        module_id: moduleId,
        rating_skipped: isSkipped,
        ...(isSkipped ? {} : ratings)
      });
      await fetchProfile();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to save rating.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className={`w-full max-w-xl border rounded-3xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto ${
        isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
      }`}>
        <div className="text-center mb-6">
          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-2 ${
            isLight ? 'bg-purple-100 text-purple-800 border border-purple-200' : 'bg-purple-950 border border-purple-800 text-purple-300'
          }`}>
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            Adaptive Element Layer (Algorithm 3)
          </div>
          <h2 className={`text-xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
            Rate Your Experience
          </h2>
          <p className={`text-xs mt-1 max-w-md mx-auto ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
            Your ratings dynamically update your gamification profile. If your top 3 preferences match another archetype, you may transition!
          </p>
        </div>

        {/* Rating List */}
        <div className="space-y-4 mb-6">
          {ELEMENTS.map((elem) => {
            const isAssigned = activeTheme.visibleElements.includes(elem.name);
            return (
              <div 
                key={elem.key} 
                className={`p-3.5 rounded-2xl border transition ${
                  isLight
                    ? isAssigned ? 'bg-blue-50/50 border-blue-200' : 'bg-slate-50 border-slate-200'
                    : isAssigned ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-950/40 border-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {elem.name}
                    </span>
                    {isAssigned ? (
                      <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                        isLight ? 'bg-blue-100 text-blue-700 border-blue-300' : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                      }`}>
                        Active in your profile
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPreviewElement(elem)}
                        className={`text-[10px] font-semibold flex items-center gap-1 cursor-pointer ${
                          isLight ? 'text-amber-600 hover:text-amber-700' : 'text-amber-400 hover:text-amber-300'
                        }`}
                      >
                        <Eye className="w-3 h-3" /> Preview
                      </button>
                    )}
                  </div>

                  {/* Stars 1 to 5 */}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => handleRate(elem.key, star)}
                        className="p-1 hover:scale-110 transition cursor-pointer"
                      >
                        <Star
                          className={`w-4 h-4 ${
                            star <= ratings[elem.key]
                              ? 'text-amber-400 fill-amber-400'
                              : isLight ? 'text-slate-300' : 'text-slate-700'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>{elem.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div className={`flex items-center justify-between pt-4 border-t ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(true)}
            className={`text-xs font-medium cursor-pointer ${
              isLight ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            Skip Rating
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => handleSubmit(false)}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-500/25 transition cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Submit Ratings'}
          </button>
        </div>

        {/* Preview Modal for unassigned elements with rich visual mockups */}
        {previewElement && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className={`w-full max-w-xl border rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl relative max-h-[90vh] overflow-y-auto ${
              isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
            }`}>
              <div className="flex items-center justify-between border-b pb-3 border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">
                      {previewElement.name} (Visual Mechanic Preview)
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Experience how other learner archetypes see this feature
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewElement(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* DYNAMIC VISUAL MOCKUPS */}
              {previewElement.key === 'r_feedback' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 text-left text-white shadow-inner space-y-3">
                    <div className="flex items-center justify-between text-xs text-indigo-300 font-mono">
                      <span className="flex items-center gap-1.5 font-bold">
                        <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />
                        AI Feedback Console • Visionary Core
                      </span>
                      <span className="text-[10px] bg-indigo-900/60 px-2 py-0.5 rounded border border-indigo-700">Real-time</span>
                    </div>

                    <div className="bg-slate-950/90 p-3 rounded-xl border border-indigo-900 font-mono text-xs text-emerald-400">
                      <span className="text-slate-500">// Problem: Dynamic Memory in C</span><br />
                      <span className="text-purple-400">int</span> *arr = (<span className="text-purple-400">int</span>*)<span className="text-yellow-400">malloc</span>(n * <span className="text-yellow-400">sizeof</span>(<span className="text-purple-400">int</span>));
                    </div>

                    <div className="p-3 rounded-xl bg-blue-900/40 border border-blue-500/40 text-xs space-y-1.5">
                      <div className="flex items-center gap-2 font-bold text-cyan-300">
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        <span>Instant Solution Hint:</span>
                      </div>
                      <p className="text-[11px] text-slate-200 leading-relaxed">
                        In C, <code className="text-cyan-300">malloc()</code> requests heap bytes and yields <code className="text-cyan-300">void*</code>. Remember to guard against allocation failures: <code className="text-cyan-300">if (arr == NULL) return -1;</code> and always call <code className="text-cyan-300">free(arr);</code>.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-purple-950/50 border border-purple-500/30 text-[11px] text-purple-200 flex items-center gap-2">
                      <span className="text-base">🚀</span>
                      <span><strong>Visionary Uplink:</strong> Outstanding logic execution! Your conceptual accuracy is warp-speed locked!</span>
                    </div>
                  </div>
                </div>
              )}

              {previewElement.key === 'r_leaderboard' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-950/90 border border-blue-500/30 text-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <Trophy className="w-4 h-4 text-amber-400" />
                        Cognitive Tier Leaderboard
                      </span>
                      <div className="flex gap-1 text-[10px] font-bold">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">Stepper</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400">Jogger</span>
                        <span className="px-2 py-0.5 rounded bg-purple-600 text-white shadow-xs">Glider</span>
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      {/* Rank 1 */}
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center">1</span>
                          <div>
                            <p className="font-bold text-slate-100">Priya Sharma</p>
                            <p className="text-[10px] text-amber-400 font-semibold">Glider Master • 98% Accuracy</p>
                          </div>
                        </div>
                        <span className="font-black text-amber-400">2,850 XP</span>
                      </div>

                      {/* Rank 2 */}
                      <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-slate-400 text-slate-950 font-black text-xs flex items-center justify-center">2</span>
                          <div>
                            <p className="font-bold text-slate-100">Alex Chen</p>
                            <p className="text-[10px] text-slate-400 font-semibold">Glider Master • 94% Accuracy</p>
                          </div>
                        </div>
                        <span className="font-black text-slate-300">2,420 XP</span>
                      </div>

                      {/* Rank 3 - YOU */}
                      <div className="p-2.5 rounded-xl bg-indigo-900/40 border-2 border-indigo-500/60 flex items-center justify-between shadow-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-amber-700 text-amber-100 font-black text-xs flex items-center justify-center">3</span>
                          <div>
                            <p className="font-bold text-cyan-300">You (Student) ★</p>
                            <p className="text-[10px] text-cyan-400 font-semibold">Glider Tier • Top 5%</p>
                          </div>
                        </div>
                        <span className="font-black text-cyan-300">2,150 XP</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewElement.key === 'r_badges' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-950/90 border border-purple-500/30 text-white space-y-3">
                    <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5">
                      <Award className="w-4 h-4 text-purple-400" />
                      Achievement Emblems & Collectibles
                    </span>

                    <div className="grid grid-cols-3 gap-2.5 text-center">
                      <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mb-1 text-2xl">
                          🥉
                        </div>
                        <span className="font-bold text-[11px] text-amber-300">Associate</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">80%+ Quiz Passed</span>
                        <span className="mt-1 text-[8px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Unlocked</span>
                      </div>

                      <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center mb-1 text-2xl">
                          🥈
                        </div>
                        <span className="font-bold text-[11px] text-cyan-300">Professional</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">Medium Task 1st Try</span>
                        <span className="mt-1 text-[8px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">Unlocked</span>
                      </div>

                      <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex flex-col items-center">
                        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-1 text-2xl">
                          🥇
                        </div>
                        <span className="font-bold text-[11px] text-purple-300">Master</span>
                        <span className="text-[9px] text-slate-400 mt-0.5">3-Day Streak</span>
                        <span className="mt-1 text-[8px] uppercase font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">75% Progress</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewElement.key === 'r_progress_bar' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-slate-950/90 border border-blue-500/30 text-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                        <BarChart3 className="w-4 h-4 text-blue-400" />
                        Syllabus Progress Tracker
                      </span>
                      <span className="text-xs font-black text-emerald-400">65% Completed</span>
                    </div>

                    <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5">
                      <div className="bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-500 w-[65%]" />
                    </div>

                    <div className="space-y-2 text-xs pt-1">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                        <span className="font-bold text-emerald-300">Module 1: Pointers & Memory</span>
                        <span className="text-[10px] font-bold text-emerald-400">✓ Completed</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-between">
                        <span className="font-bold text-cyan-300">Module 2: Structs & File I/O</span>
                        <span className="text-[10px] font-bold text-cyan-400">⚡ In Progress (60%)</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between text-slate-500">
                        <span>Module 3: Linked Lists & Trees</span>
                        <span className="text-[10px] font-bold flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {previewElement.key === 'r_mystery' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-amber-950/80 border border-amber-500/40 text-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <Gift className="w-4 h-4 text-amber-400" />
                        Mystery Vault & Secret Artifacts
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        Unlock at 80%+
                      </span>
                    </div>

                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-2xl flex items-center justify-center shrink-0">
                        🎁
                      </div>
                      <div>
                        <p className="font-bold text-xs text-amber-200">Single Unlock Requirement:</p>
                        <p className="text-[11px] text-slate-300">Complete module quizzes with 80%+ score</p>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-900/60 text-xs space-y-1.5">
                      <p className="font-bold text-amber-400">Unlocks Inside This Box:</p>
                      <p className="text-[11px] text-slate-300">• 📄 Secret Cheatsheet: Top 25 C Pointer Interview Questions</p>
                      <p className="text-[11px] text-slate-300">• 🔑 Concept Master Key (+1 Key to bypass locked content)</p>
                      <p className="text-[11px] text-slate-300">• 💎 Secret Bounty Cache (+150 Coins)</p>
                    </div>
                  </div>
                </div>
              )}

              {previewElement.key === 'r_rewards' && (
                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-white space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        Pioneer Explorer Rewards Vault
                      </span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        Pioneer Exclusive
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-emerald-200">Stepper Base Milestone</p>
                          <p className="text-[10px] text-slate-400">Foundational exploration reward</p>
                        </div>
                        <span className="font-black text-xs text-emerald-400 bg-emerald-950 px-2.5 py-1 rounded-lg border border-emerald-700">+100 Coins</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-amber-200">Jogger Tactician Upgrade</p>
                          <p className="text-[10px] text-slate-400">Promoted to Average Tier via 2x 80%+ tasks</p>
                        </div>
                        <span className="font-black text-xs text-amber-400 bg-amber-950 px-2.5 py-1 rounded-lg border border-amber-700">+250 Coins</span>
                      </div>

                      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
                        <div>
                          <p className="font-bold text-purple-200">Glider Master Pathfinder</p>
                          <p className="text-[10px] text-slate-400">Promoted to Fast Tier via consecutive mastery</p>
                        </div>
                        <span className="font-black text-xs text-purple-400 bg-purple-950 px-2.5 py-1 rounded-lg border border-purple-700">+500 Coins</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] text-slate-500 dark:text-slate-400">
                💡 <strong>Adaptive Element Reclassification:</strong> Giving a 5-star rating to this mechanic will increase its weight in Algorithm 3 and may transition your archetype to unlock it permanently!
              </div>

              <button
                type="button"
                onClick={() => setPreviewElement(null)}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer shadow-md"
              >
                Close Preview & Rate Element
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
