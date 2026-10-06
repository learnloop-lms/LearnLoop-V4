import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeToggle } from '../context/ThemeContext';
import { ArrowLeft, Award, Sparkles, Shield, Compass, Zap } from 'lucide-react';

export default function CollectiblesView() {
  const { user, activeTheme, API_BASE } = useAuth();
  const { isLight } = useTheme();
  const [collectibles, setCollectibles] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchBadges();
  }, []);

  const fetchBadges = async () => {
    try {
      const res = await axios.get(`${API_BASE}/students/collectibles`);
      setCollectibles(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const tierColors = isLight
    ? {
        associate: 'text-blue-700 border-blue-200 bg-blue-50',
        professional: 'text-amber-700 border-amber-200 bg-amber-50',
        master: 'text-purple-700 border-purple-200 bg-purple-50'
      }
    : {
        associate: 'text-cyan-300 border-cyan-500/40 bg-cyan-950/40',
        professional: 'text-amber-300 border-amber-500/40 bg-amber-950/40',
        master: 'text-purple-300 border-purple-500/40 bg-purple-950/40'
      };

  const bgOverlay = isLight
    ? `linear-gradient(to bottom, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.22)), url(${activeTheme.bgImage})`
    : `linear-gradient(to bottom, rgba(10, 15, 29, 0.90), rgba(5, 8, 16, 0.96)), url(${activeTheme.bgImage})`;

  return (
    <div 
      className={`min-h-screen font-sans bg-cover bg-center bg-fixed flex flex-col transition-colors duration-200 ${
        isLight ? 'text-slate-900' : 'text-slate-100'
      }`}
      style={{ backgroundImage: bgOverlay }}
    >
      <header className={`sticky top-0 z-40 backdrop-blur-md px-4 md:px-8 py-3 flex items-center justify-between border-b shadow-xs ${
        isLight ? 'bg-white/80 border-white/50' : 'bg-slate-950/75 border-slate-800'
      }`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className={`font-bold text-sm flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
              <Award className="w-4 h-4 text-amber-500" />
              Collectibles & Badges Trophy Room
            </h1>
            <p className="text-[11px] text-slate-500">
              Preserves badges earned across all learner archetype transitions
            </p>
          </div>
        </div>

        <ThemeToggle />
      </header>

      <main className="max-w-6xl mx-auto w-full p-4 md:p-8 space-y-8">
        
        {/* Intro Card */}
        <div 
          className={`rounded-3xl p-6 border flex flex-col md:flex-row items-center justify-between gap-6 backdrop-blur-md ${
            isLight ? 'border-white/60 shadow-lg text-slate-900' : 'border-slate-800 shadow-2xl text-white'
          }`}
          style={{ background: isLight ? 'rgba(255, 255, 255, 0.78)' : activeTheme.cardBg }}
        >
          <div>
            <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${
              isLight ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-white/10 text-white'
            }`}>
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              Rule-Based Achievement System
            </div>
            <h2 className={`text-xl md:text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Your Badge Inventory ({collectibles.length} Unlocked)
            </h2>
            <p className={`text-xs mt-1 max-w-xl ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
              Associate badges are earned by mastering Basic challenges; Professional for Intermediate; and Master for Advanced. Even if your archetype evolves, your earlier badges stay permanently in your inventory!
            </p>
          </div>

          <div className="flex gap-4">
            <div className={`text-center p-3 rounded-2xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Associate</span>
              <p className={`text-xl font-bold ${isLight ? 'text-blue-700' : 'text-cyan-300'}`}>
                {collectibles.filter(b => b.badge_tier === 'associate').length}
              </p>
            </div>
            <div className={`text-center p-3 rounded-2xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Professional</span>
              <p className={`text-xl font-bold ${isLight ? 'text-amber-700' : 'text-amber-300'}`}>
                {collectibles.filter(b => b.badge_tier === 'professional').length}
              </p>
            </div>
            <div className={`text-center p-3 rounded-2xl border ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
            }`}>
              <span className="text-[10px] text-slate-400 uppercase font-bold">Master</span>
              <p className={`text-xl font-bold ${isLight ? 'text-purple-700' : 'text-purple-300'}`}>
                {collectibles.filter(b => b.badge_tier === 'master').length}
              </p>
            </div>
          </div>
        </div>

        {/* Badges Grid */}
        {collectibles.length === 0 ? (
          <div className={`text-center py-16 rounded-3xl border ${
            isLight ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-900/60 border-slate-800'
          }`}>
            <Award className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
              No Badges Earned Yet
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Complete module tasks and quizzes to earn Associate, Professional, and Master badges!
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {collectibles.map((b) => (
              <div 
                key={b.id}
                className={`rounded-3xl p-5 border text-center space-y-3 hover:scale-105 transition-all duration-300 ${
                  isLight 
                    ? 'bg-white/75 backdrop-blur-md border-white/60 shadow-md hover:bg-white' 
                    : 'border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-xl'
                }`}
              >
                <div className={`w-24 h-24 mx-auto rounded-2xl p-2 border flex items-center justify-center ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800 shadow-inner'
                }`}>
                  <img src={b.badge_icon_path} alt={b.concept_name} className="w-full h-full object-contain" />
                </div>

                <div>
                  <h4 className={`font-bold text-sm line-clamp-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    {b.concept_name}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-medium">{b.theme_archetype} Theme</p>
                </div>

                <div className={`pt-2 border-t flex items-center justify-between ${
                  isLight ? 'border-slate-200' : 'border-slate-800/80'
                }`}>
                  <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full border ${tierColors[b.badge_tier] || tierColors.associate}`}>
                    {b.badge_tier}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {new Date(b.earned_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
