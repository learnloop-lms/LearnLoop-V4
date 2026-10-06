import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeToggle } from '../context/ThemeContext';
import { ArrowLeft, Trophy, Medal, Award, Crown, Coins, Flame } from 'lucide-react';

export default function LeaderboardView() {
  const { courseId } = useParams();
  const { user, activeTheme, API_BASE } = useAuth();
  const { isLight } = useTheme();
  const [boardData, setBoardData] = useState(null);
  const [activeTab, setActiveTab] = useState(user?.leaderboard_level || 'Jogger');
  const navigate = useNavigate();

  useEffect(() => {
    fetchLeaderboard();
  }, [courseId]);

  const fetchLeaderboard = async () => {
    try {
      const res = await axios.get(`${API_BASE}/leaderboards/${courseId}`);
      setBoardData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const currentList =
    activeTab === 'Stepper'
      ? boardData?.stepper_leaderboard || []
      : activeTab === 'Glider'
      ? boardData?.glider_leaderboard || []
      : boardData?.jogger_leaderboard || [];

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
              <Trophy className="w-4 h-4 text-amber-500" />
              Course Leaderboard (Model 4 Cognitive Tiers)
            </h1>
            <p className="text-[11px] text-slate-500">
              Students compete within their assigned cognitive tier: Stepper, Jogger, Glider
            </p>
          </div>
        </div>

        <ThemeToggle />
      </header>

      <main className="max-w-4xl mx-auto w-full p-4 md:p-8 space-y-6">
        
        {/* Tier Switcher Tabs */}
        <div className={`flex p-1.5 rounded-2xl border shadow-md ${
          isLight ? 'bg-white/75 backdrop-blur-md border-white/60' : 'bg-slate-900/90 border-slate-800 shadow-xl'
        }`}>
          {[
            { key: 'Stepper', label: 'Stepper Board', color: 'from-emerald-600 to-teal-700', desc: 'Slow Tier' },
            { key: 'Jogger', label: 'Jogger Board', color: 'from-amber-600 to-yellow-600', desc: 'Average Tier' },
            { key: 'Glider', label: 'Glider Board', color: 'from-purple-600 to-indigo-700', desc: 'Fast Tier' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 rounded-xl font-bold text-xs transition flex flex-col items-center justify-center cursor-pointer ${
                activeTab === tab.key
                  ? `bg-gradient-to-r ${tab.color} text-white shadow-md`
                  : isLight 
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-100' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] font-normal opacity-85">{tab.desc}</span>
            </button>
          ))}
        </div>

        {/* Podium for Top 3 */}
        {currentList.length >= 3 && (
          <div className="grid grid-cols-3 gap-3 md:gap-6 pt-4 pb-2 items-end max-w-lg mx-auto">
            {/* Rank 2 */}
            <div className="text-center">
              <div className={`w-14 h-14 mx-auto rounded-2xl border-2 p-1 mb-2 relative ${
                isLight ? 'bg-slate-100 border-slate-400 shadow-sm' : 'bg-slate-800 border-slate-400'
              }`}>
                <Medal className="w-4 h-4 text-slate-400 absolute -top-2 -right-2" />
                <img src={currentList[1]?.avatar_path || activeTheme.icons.coins} alt="" className="w-full h-full object-cover rounded-xl" />
              </div>
              <span className={`text-xs font-bold block truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {currentList[1]?.name}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">{currentList[1]?.total_score} pts</span>
              <div className={`h-16 rounded-t-2xl mt-2 flex items-center justify-center font-bold text-sm ${
                isLight ? 'bg-slate-200 text-slate-700' : 'bg-slate-800/80 text-slate-400'
              }`}>
                #2
              </div>
            </div>

            {/* Rank 1 */}
            <div className="text-center">
              <div className="w-18 h-18 mx-auto rounded-2xl bg-amber-500/20 border-2 border-amber-500 p-1 mb-2 relative shadow-lg shadow-amber-500/20">
                <Crown className="w-5 h-5 text-amber-500 absolute -top-3 left-1/2 -translate-x-1/2" />
                <img src={currentList[0]?.avatar_path || activeTheme.icons.coins} alt="" className="w-full h-full object-cover rounded-xl" />
              </div>
              <span className={`text-xs font-bold block truncate ${isLight ? 'text-amber-800 font-black' : 'text-amber-300'}`}>
                {currentList[0]?.name}
              </span>
              <span className="text-[10px] text-amber-600 font-semibold">{currentList[0]?.total_score} pts</span>
              <div className={`h-24 rounded-t-2xl mt-2 flex items-center justify-center font-black text-base border-t ${
                isLight 
                  ? 'bg-gradient-to-t from-amber-300/40 to-amber-100/60 border-amber-400 text-amber-900' 
                  : 'bg-gradient-to-t from-amber-600/40 to-amber-500/20 border-amber-400 text-amber-300'
              }`}>
                #1
              </div>
            </div>

            {/* Rank 3 */}
            <div className="text-center">
              <div className={`w-14 h-14 mx-auto rounded-2xl border-2 p-1 mb-2 relative ${
                isLight ? 'bg-amber-50 border-amber-600 shadow-sm' : 'bg-slate-800 border-amber-700'
              }`}>
                <Medal className="w-4 h-4 text-amber-700 absolute -top-2 -right-2" />
                <img src={currentList[2]?.avatar_path || activeTheme.icons.coins} alt="" className="w-full h-full object-cover rounded-xl" />
              </div>
              <span className={`text-xs font-bold block truncate ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {currentList[2]?.name}
              </span>
              <span className="text-[10px] text-slate-500 font-medium">{currentList[2]?.total_score} pts</span>
              <div className={`h-12 rounded-t-2xl mt-2 flex items-center justify-center font-bold text-sm ${
                isLight ? 'bg-amber-100 text-amber-900' : 'bg-slate-800/80 text-amber-700'
              }`}>
                #3
              </div>
            </div>
          </div>
        )}

        {/* Full Table */}
        <div className={`rounded-3xl border overflow-hidden shadow-lg ${
          isLight ? 'bg-white/75 backdrop-blur-md border-white/60 shadow-slate-200/50' : 'border-slate-800 bg-slate-900/80 backdrop-blur-xl shadow-2xl'
        }`}>
          {currentList.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No students in the {activeTab} tier yet.
            </div>
          ) : (
            <div className={`divide-y ${isLight ? 'divide-slate-200' : 'divide-slate-800/80'}`}>
              {currentList.map((st, idx) => (
                <div 
                  key={st.student_id}
                  className={`p-4 flex items-center justify-between gap-4 transition ${
                    st.student_id === user?.id 
                      ? isLight ? 'bg-blue-50/80 border-l-4 border-blue-600' : 'bg-cyan-950/40 border-l-4 border-cyan-400' 
                      : isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-bold text-xs text-slate-400">
                      {idx + 1}
                    </span>
                    <img 
                      src={st.avatar_path || activeTheme.icons.coins} 
                      alt="" 
                      className={`w-10 h-10 rounded-xl object-cover border ${
                        isLight ? 'border-slate-200 bg-slate-100' : 'border-slate-700 bg-slate-800'
                      }`} 
                    />
                    <div>
                      <h4 className={`font-bold text-xs ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {st.name} {st.student_id === user?.id && <span className="text-blue-600 font-extrabold">(You)</span>}
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        {st.regno} • {st.pt_ls}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-right">
                    <div className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-300 font-bold">
                      <Coins className="w-3.5 h-3.5" />
                      <span>{st.total_coins}</span>
                    </div>

                    <div className={`border px-3 py-1.5 rounded-xl font-bold text-xs ${
                      isLight ? 'bg-slate-100 border-slate-300 text-blue-700' : 'bg-slate-950 border-slate-800 text-cyan-300'
                    }`}>
                      {st.total_score} pts
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
