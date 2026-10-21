import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeToggle } from '../context/ThemeContext';
import { 
  BookOpen, Plus, Award, LogOut, ChevronRight, Sparkles, 
  Heart, Zap, Key, Shield, User, Compass, CheckCircle2,
  LayoutDashboard, GraduationCap, Edit3, Lock, Mail, Building, Hash,
  Clock, Flame, CheckCircle, BarChart3, TrendingUp, ExternalLink,
  Gamepad2, ArrowRight
} from 'lucide-react';

import AppreciationModal from '../components/AppreciationModal';
import GameElementsTourModal from '../components/GameElementsTourModal';

export default function StudentDashboard() {
  const { user, activeTheme, API_BASE, logout, fetchProfile } = useAuth();
  const { isLight } = useTheme();
  const navigate = useNavigate();

  const [activeMenu, setActiveMenu] = useState('dashboard'); // 'dashboard', 'courses', 'profile'
  const [courses, setCourses] = useState([]);
  const [collectibles, setCollectibles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Gamification Modals
  const [showMysteryModal, setShowMysteryModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showAppreciationModal, setShowAppreciationModal] = useState(false);
  const [showTourModal, setShowTourModal] = useState(false);
  const [mysteryVault, setMysteryVault] = useState(null);
  const [loadingMystery, setLoadingMystery] = useState(false);
  const [selectedStackedModule, setSelectedStackedModule] = useState(null);

  // Join Course Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Profile Edit State
  const [editName, setEditName] = useState('');
  const [editGender, setEditGender] = useState('female');
  const [editDept, setEditDept] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  useEffect(() => {
    fetchMyCourses();
    fetchMyCollectibles();
    if (user) {
      setEditName(user.name || '');
      setEditGender(user.gender || 'female');
      setEditDept(user.department || '');
      setEditEmail(user.email || '');

      // Auto-show game elements tour on student's first visit
      const hasSeen = localStorage.getItem(`seen_game_elements_tour_${user.id}`);
      if (!hasSeen) {
        setShowTourModal(true);
      }
    }
  }, [user]);

  const handleCloseTour = () => {
    if (user?.id) {
      localStorage.setItem(`seen_game_elements_tour_${user.id}`, 'true');
    }
    setShowTourModal(false);
  };

  const fetchMyCourses = async () => {
    try {
      const res = await axios.get(`${API_BASE}/students/my-courses`);
      setCourses(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyCollectibles = async () => {
    try {
      const res = await axios.get(`${API_BASE}/students/collectibles`);
      setCollectibles(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMysteryVault = async () => {
    setLoadingMystery(true);
    try {
      const res = await axios.get(`${API_BASE}/students/mystery-vault`);
      setMysteryVault(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMystery(false);
    }
  };

  useEffect(() => {
    if (showMysteryModal) {
      fetchMysteryVault();
    }
  }, [showMysteryModal]);

  const handleJoinCourse = async (e) => {
    e.preventDefault();
    setJoining(true);
    setJoinError('');
    try {
      await axios.post(`${API_BASE}/courses/enroll`, {
        join_code: joinCode.trim().toUpperCase()
      });
      setShowJoinModal(false);
      setJoinCode('');
      fetchMyCourses();
    } catch (err) {
      setJoinError(err.response?.data?.detail || 'Failed to join course. Please check the code.');
    } finally {
      setJoining(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg('');
    try {
      await axios.put(`${API_BASE}/students/profile`, {
        name: editName,
        gender: editGender,
        department: editDept,
        email: editEmail,
        new_password: editPassword || null
      });
      setProfileMsg('Profile updated successfully!');
      setEditPassword('');
      await fetchProfile();
      setTimeout(() => setProfileMsg(''), 3000);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const cogColors = {
    Stepper: isLight ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60',
    Jogger: isLight ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-amber-950/80 text-amber-300 border-amber-700/60',
    Glider: isLight ? 'bg-purple-100 text-purple-800 border-purple-300' : 'bg-purple-950/80 text-purple-300 border-purple-700/60'
  };

  // Fullest, vivid background image: very subtle overlay so the artwork is 100% visible!
  const bgOverlay = isLight 
    ? `linear-gradient(to bottom, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.22)), url(${activeTheme.bgImage})`
    : `linear-gradient(to bottom, rgba(10, 15, 29, 0.75), rgba(5, 8, 16, 0.88)), url(${activeTheme.bgImage})`;

  // Frosted glass card style: lightly transparent so the wallpaper shines through!
  const frostedCard = isLight
    ? 'bg-white/75 backdrop-blur-md border border-white/60 shadow-lg shadow-slate-900/5'
    : 'bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl';

  return (
    <div 
      className={`min-h-screen font-sans bg-cover bg-center bg-fixed transition-colors duration-200 ${
        isLight ? 'text-slate-900' : 'text-slate-100'
      }`}
      style={{ backgroundImage: bgOverlay }}
    >
      {/* Top Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md px-4 md:px-8 py-3 border-b shadow-xs ${
        isLight ? 'bg-white/80 border-white/50' : 'bg-slate-950/80 border-slate-800'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* User Profile Overview */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-indigo-400 shadow-sm bg-white/40 shrink-0">
              <img 
                src={user?.avatar_path || activeTheme.icons.coins} 
                alt="Avatar" 
                className="w-full h-full object-contain p-0.5"
                onError={(e) => { e.target.src = activeTheme.icons.coins; }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-base md:text-lg tracking-tight">{user?.name}</span>
                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${cogColors[user?.leaderboard_level] || cogColors.Jogger}`}>
                  {user?.leaderboard_level || 'Jogger'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold">
                {user?.pt_ls || 'Classified'} • Reg: {user?.regno}
              </p>
            </div>
          </div>

          {/* Gamification Bar (Hearts, Coins, Keys in header) */}
          <div className={`hidden md:flex items-center gap-5 px-5 py-2 rounded-2xl border shadow-xs ${
            isLight ? 'bg-white/70 border-white/60' : 'bg-slate-900/80 border-slate-800'
          }`}>
            {/* Hearts */}
            <div className="flex items-center gap-2" title="Hearts (Lives) - 1 regenerates every 30 mins">
              <img src={activeTheme.icons.hearts} alt="Hearts" className="w-7 h-7 object-contain shrink-0" />
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block -mb-1">Hearts</span>
                <span className="font-black text-sm text-red-500">{user?.hearts ?? 5}/5</span>
              </div>
            </div>

            <div className={`w-px h-6 ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`} />

            {/* Coins */}
            <div className="flex items-center gap-2" title="Earned from assessments and helpful peer learning">
              <img src={activeTheme.icons.coins} alt="Coins" className="w-7 h-7 object-contain shrink-0" />
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block -mb-1">Coins</span>
                <span className="font-black text-sm text-amber-500">{user?.total_coins ?? 0}</span>
              </div>
            </div>

            <div className={`w-px h-6 ${isLight ? 'bg-slate-200' : 'bg-slate-700'}`} />

            {/* Keys */}
            <div className="flex items-center gap-2" title="Keys - Used to unlock advanced concepts">
              <img src={activeTheme.icons.keys} alt="Keys" className="w-7 h-7 object-contain shrink-0" />
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block -mb-1">Keys</span>
                <span className="font-black text-sm text-cyan-500">{user?.total_keys ?? 1}</span>
              </div>
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Badges: Visible ONLY for Visionaries, Mentors, Conquerors (HIDDEN FOR PIONEERS) */}
            {activeTheme?.visibleElements?.includes('Badges') && (
              <Link
                to="/collectibles"
                className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isLight ? 'bg-white/80 hover:bg-white text-slate-700 border-white/60' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title="View Collectibles & Trophy Room"
              >
                <Award className="w-5 h-5 text-amber-500" />
                <span className="hidden lg:inline">Badges ({collectibles.length})</span>
              </Link>
            )}

            {/* Mystery Box: Visible for Mentors & Pioneers */}
            {activeTheme?.visibleElements?.includes('Mystery') && activeTheme.icons?.mystery && (
              <button
                onClick={() => setShowMysteryModal(true)}
                className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isLight ? 'bg-white/80 hover:bg-amber-50 text-amber-800 border-white/60' : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                }`}
                title="Mystery Box Secrets"
              >
                <img src={activeTheme.icons.mystery} alt="Mystery" className="w-5 h-5 object-contain" />
                <span className="hidden lg:inline">Mystery Box</span>
              </button>
            )}

            {/* Rewards Vault: Visible for Pioneers */}
            {activeTheme?.visibleElements?.includes('Rewards') && (
              <button
                onClick={() => setShowRewardsModal(true)}
                className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isLight ? 'bg-white/80 hover:bg-emerald-50 text-emerald-800 border-white/60' : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
                }`}
                title="Pioneer Explorer Rewards Vault"
              >
                <Sparkles className="w-5 h-5 text-emerald-500" />
                <span className="hidden lg:inline">Rewards Vault</span>
              </button>
            )}

            {/* Leaderboard: Visible for Visionaries, Pioneers, Conquerors */}
            {activeTheme?.visibleElements?.includes('Leaderboard') && courses.length > 0 && (
              <Link
                to={`/leaderboard/${courses[0]?.id}`}
                className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isLight ? 'bg-white/80 hover:bg-blue-50 text-blue-700 border-white/60' : 'bg-slate-800 hover:bg-slate-700 text-blue-300 border-slate-700'
                }`}
                title="Course Leaderboard"
              >
                <Award className="w-5 h-5 text-blue-500" />
                <span className="hidden lg:inline">Leaderboard</span>
              </Link>
            )}

            <button
              onClick={logout}
              className={`p-2.5 rounded-2xl border transition cursor-pointer ${
                isLight ? 'bg-white/80 hover:bg-red-50 text-slate-600 hover:text-red-600 border-white/60' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-red-400 border-slate-700'
              }`}
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout: Left Sidebar + Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row gap-6">
        
        {/* Left Column: Large Avatar Card + Navigation Sidebar */}
        <aside className="w-full md:w-72 shrink-0 space-y-4">
          
          {/* ================================================================= */}
          {/* 1. LARGE SIZE AVATAR SHOWCASE (WHERE USER CIRCLED IN RED)          */}
          {/* ================================================================= */}
          <div className={`p-6 rounded-3xl text-center flex flex-col items-center transition-all ${frostedCard}`}>
            <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3 block">
              Character Spotlight
            </span>

            {/* Extra Large Avatar Frame (160px / 40 Tailwind) */}
            <div className="relative group mb-3">
              <div className="w-40 h-40 md:w-44 md:h-44 rounded-3xl p-3 bg-gradient-to-b from-indigo-500/15 via-blue-500/10 to-transparent border-2 border-indigo-400/60 shadow-inner flex items-center justify-center">
                <img 
                  src={user?.avatar_path || activeTheme.icons.coins} 
                  alt={user?.name} 
                  className="w-full h-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-300"
                  onError={(e) => { e.target.src = activeTheme.icons.coins; }}
                />
              </div>

              {/* Cognitive Tier Badge on Avatar */}
              <span className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-[10px] font-black uppercase px-3 py-0.5 rounded-full border shadow-md whitespace-nowrap ${
                cogColors[user?.leaderboard_level] || cogColors.Jogger
              }`}>
                {user?.leaderboard_level || 'Jogger'} Tier
              </span>
            </div>

            <h3 className="font-black text-lg md:text-xl tracking-tight text-slate-900 dark:text-white mt-2">
              {user?.name}
            </h3>
            <p className="text-xs font-bold text-slate-500 mt-0.5">
              Reg: {user?.regno}
            </p>

            <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100/90 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>{user?.pt_ls || 'Pioneer'} Archetype</span>
            </div>
          </div>

          {/* Navigation Menu */}
          <div className={`p-4 rounded-3xl space-y-2 ${frostedCard}`}>
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-3 block mb-2">
              Navigation Menu
            </span>

            {/* Menu 1: Dashboard */}
            <button
              onClick={() => setActiveMenu('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition cursor-pointer ${
                activeMenu === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : isLight ? 'text-slate-600 hover:bg-white/80 hover:text-slate-900' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-5 h-5" />
              <span>Dashboard</span>
            </button>

            {/* Menu 2: Courses */}
            <button
              onClick={() => setActiveMenu('courses')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition cursor-pointer ${
                activeMenu === 'courses'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : isLight ? 'text-slate-600 hover:bg-white/80 hover:text-slate-900' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <GraduationCap className="w-5 h-5" />
              <span>Courses ({courses.length})</span>
            </button>

            {/* Menu 3: Profile */}
            <button
              onClick={() => setActiveMenu('profile')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-bold text-sm transition cursor-pointer ${
                activeMenu === 'profile'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25'
                  : isLight ? 'text-slate-600 hover:bg-white/80 hover:text-slate-900' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <User className="w-5 h-5" />
              <span>My Profile</span>
            </button>

            {/* Menu 4: Collaborative Activity */}
            <Link
              to="/collaborative"
              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-bold text-sm transition cursor-pointer border ${
                isLight 
                  ? 'bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-transparent border-indigo-200 text-indigo-700 hover:bg-indigo-50' 
                  : 'bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-transparent border-indigo-900/60 text-indigo-300 hover:bg-indigo-950/40'
              }`}
            >
              <div className="flex items-center gap-3">
                <Gamepad2 className="w-5 h-5 text-indigo-500 animate-pulse" />
                <span>Collaborative Activity</span>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-xs">
                Squad
              </span>
            </Link>
          </div>

          {/* Quick Enrolled Classes Card */}
          <div className={`p-5 rounded-3xl space-y-3 ${frostedCard}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Active Classes</span>
              <button
                onClick={() => setShowJoinModal(true)}
                className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                + Join
              </button>
            </div>
            {courses.length === 0 ? (
              <p className="text-xs text-slate-400">No classes enrolled yet.</p>
            ) : (
              courses.slice(0, 3).map((c) => (
                <Link
                  key={c.id}
                  to={`/course/${c.id}`}
                  className={`block p-2.5 rounded-xl border text-xs font-bold truncate transition ${
                    isLight ? 'bg-white/60 hover:bg-white border-white/60 text-slate-800' : 'hover:bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  {c.title}
                </Link>
              ))
            )}
          </div>
        </aside>

        {/* Right Main Panel */}
        <main className="flex-1 space-y-6">
          
          {/* ================================================================= */}
          {/* VIEW 1: DASHBOARD (PROGRESS, ANALYTICS & SUMMARY)                 */}
          {/* ================================================================= */}
          {activeMenu === 'dashboard' && (
            <div className="space-y-6">
              
              {/* Hero Banner */}
              <div className={`p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 ${frostedCard}`}>
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
                    <Sparkles className="w-3.5 h-3.5" />
                    {user?.pt_ls || 'Learner'} Realm Active
                  </div>
                  <h2 className="text-2xl md:text-3xl font-black tracking-tight">
                    Welcome back, {user?.name}!
                  </h2>
                  <p className="text-sm text-slate-500 max-w-xl">
                    Track your adaptive learning progress, cognitive tier rank, and complete tasks to earn coins and badges!
                  </p>
                </div>

                <button
                  onClick={() => setShowJoinModal(true)}
                  className="px-6 py-3.5 rounded-2xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/25 flex items-center gap-2 transition cursor-pointer shrink-0"
                >
                  <Plus className="w-5 h-5" />
                  <span>Join Class with Code</span>
                </button>
              </div>

              {/* ============================================================= */}
              {/* 2. ATTRACTIVE LARGE ASSETS BAR: HEARTS, COINS & KEYS           */}
              {/* (EXACTLY WHERE THE GREEN ARROW POINTS IN THE USER'S IMAGE)   */}
              {/* ============================================================= */}
              <div className={`p-6 rounded-3xl ${frostedCard}`}>
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      Student Game Assets & Lives Inventory
                    </h3>
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                      Cognitive Tier: {user?.leaderboard_level || 'Jogger'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTourModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition cursor-pointer shadow-xs"
                    title="View Rules, Costs, and Usage for All 10 Game Elements"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>🎮 Game Elements & Rules Guide</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* 1. Large Hearts */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-red-500/15 via-rose-500/10 to-transparent border border-red-300/80 dark:border-red-900 flex items-center gap-4 hover:scale-[1.02] transition-transform shadow-xs">
                    <div className="w-16 h-16 rounded-2xl bg-white/80 dark:bg-slate-900 p-2 border border-red-200 dark:border-red-800 flex items-center justify-center shadow-inner shrink-0">
                      <img src={activeTheme.icons.hearts} alt="Hearts" className="w-12 h-12 object-contain drop-shadow-md animate-pulse" />
                    </div>
                    <div>
                      <span className="text-xs uppercase font-extrabold text-red-700 dark:text-red-400 block -mb-0.5">Lives (Hearts)</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-red-600 dark:text-red-400">{user?.hearts ?? 5}</span>
                        <span className="text-xs font-extrabold text-slate-500">/ 5</span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5">+1 heart every 30m</p>
                    </div>
                  </div>

                  {/* 2. Large Coins */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 via-yellow-500/10 to-transparent border border-amber-300/80 dark:border-amber-900 flex items-center gap-4 hover:scale-[1.02] transition-transform shadow-xs">
                    <div className="w-16 h-16 rounded-2xl bg-white/80 dark:bg-slate-900 p-2 border border-amber-200 dark:border-amber-800 flex items-center justify-center shadow-inner shrink-0">
                      <img src={activeTheme.icons.coins} alt="Coins" className="w-12 h-12 object-contain drop-shadow-md hover:rotate-12 transition-transform" />
                    </div>
                    <div>
                      <span className="text-xs uppercase font-extrabold text-amber-700 dark:text-amber-400 block -mb-0.5">Total Coins</span>
                      <div className="text-3xl font-black text-amber-600 dark:text-amber-300">
                        {user?.total_coins ?? 0}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5">Earned from quizzes & tasks</p>
                    </div>
                  </div>

                  {/* 3. Large Keys */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-cyan-500/15 via-blue-500/10 to-transparent border border-cyan-300/80 dark:border-cyan-900 flex items-center gap-4 hover:scale-[1.02] transition-transform shadow-xs">
                    <div className="w-16 h-16 rounded-2xl bg-white/80 dark:bg-slate-900 p-2 border border-cyan-200 dark:border-cyan-800 flex items-center justify-center shadow-inner shrink-0">
                      <img src={activeTheme.icons.keys} alt="Keys" className="w-12 h-12 object-contain drop-shadow-md hover:rotate-12 transition-transform" />
                    </div>
                    <div>
                      <span className="text-xs uppercase font-extrabold text-cyan-700 dark:text-cyan-400 block -mb-0.5">Concept Keys</span>
                      <div className="text-3xl font-black text-cyan-600 dark:text-cyan-300">
                        {user?.total_keys ?? 1}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 font-medium mt-0.5">Unlocks advanced concepts</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Collaborative Activity / Game Zone Quick Launch Banner */}
              <div className={`p-6 rounded-3xl border transition-all ${
                isLight 
                  ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white shadow-xl shadow-indigo-500/20' 
                  : 'bg-gradient-to-r from-indigo-950 via-purple-950 to-slate-900 text-white border-indigo-700/60 shadow-xl'
              }`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center shrink-0">
                      <Gamepad2 className="w-8 h-8 text-white animate-bounce" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/20 text-white">
                          Squad Environment
                        </span>
                        <span className="text-xs text-white/80 font-bold">4-Member Teams</span>
                      </div>
                      <h3 className="text-lg font-black text-white mt-0.5">Collaborative Activity • Game Zone</h3>
                      <p className="text-xs text-white/80 max-w-xl">
                        Team up with Visionaries, Pioneers, Mentors, and Conquerors to solve adaptive programming challenges together in real time!
                      </p>
                    </div>
                  </div>

                  <Link
                    to="/collaborative"
                    className="px-6 py-3 rounded-2xl bg-white text-indigo-700 hover:bg-slate-100 font-extrabold text-xs shadow-lg transition-transform hover:scale-105 shrink-0 flex items-center justify-center gap-2"
                  >
                    <span>Enter Collaborative Platform</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              {/* ============================================================= */}
              {/* STACKED BAR CHART: MENTORS & CONQUERORS (PROGRESS BAR ELEMENT)*/}
              {/* ============================================================= */}
              {activeTheme?.visibleElements?.includes('ProgressBar') && (() => {
                const totalCourseModules = courses.reduce((acc, c) => acc + (c.modules_count || 0), 0);
                const totalCompletedModules = courses.reduce((acc, c) => acc + (c.completed_count || 0), 0);
                const overallPercentage = totalCourseModules > 0 ? Math.round((totalCompletedModules / totalCourseModules) * 100) : 0;
                const maxModCount = Math.max(1, ...courses.map((c) => c.modules_count || 1));

                return (
                  <div className={`p-6 md:p-8 rounded-3xl space-y-6 transition-all ${frostedCard}`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-4 border-slate-200 dark:border-slate-800">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 mb-1.5">
                          <BarChart3 className="w-3.5 h-3.5" />
                          <span>{user?.pt_ls || 'Mentors & Conquerors'} Adaptive Mechanic</span>
                        </div>
                        <h3 className="text-lg md:text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                          Course Curriculum Mastery Tracker
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Modular Stacked Chart • X-Axis: Enrolled Courses • Y-Axis: Module Milestones
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="px-4 py-2 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 text-right">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block -mb-0.5">Overall Mastery</span>
                          <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                            {totalCompletedModules} / {totalCourseModules} Modules ({overallPercentage}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {courses.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">No enrolled courses to plot. Join a class to visualize your modular curriculum progress.</p>
                    ) : (
                      <div className="space-y-4">
                        {/* The Stacked Bar Chart Plot Area */}
                        <div className="p-4 sm:p-6 rounded-2xl bg-slate-950/20 dark:bg-slate-950/50 border border-slate-200/60 dark:border-slate-800/80 overflow-x-auto">
                          <div className="min-w-[500px] flex gap-4">
                            
                            {/* Y-Axis Column */}
                            <div className="w-16 shrink-0 flex flex-col justify-between py-2 text-right pr-3 border-r-2 border-slate-300 dark:border-slate-700">
                              <span className="text-[9px] font-black uppercase text-indigo-500 block mb-2 transform -rotate-90 origin-bottom-left translate-y-8">
                                Modules (Y)
                              </span>
                              {Array.from({ length: maxModCount }, (_, i) => maxModCount - i).map((lvl) => (
                                <div key={lvl} className="h-16 flex items-center justify-end text-[11px] font-mono font-bold text-slate-400">
                                  Lvl {lvl}
                                </div>
                              ))}
                              <div className="h-6 flex items-center justify-end text-[10px] font-bold text-slate-500">
                                Start
                              </div>
                            </div>

                            {/* X-Axis Columns (Courses) */}
                            <div className="flex-1 flex gap-8 sm:gap-12 items-end pt-4 pb-2">
                              {courses.map((c) => {
                                const modulesList = c.modules_progress || [];
                                const cPct = c.modules_count > 0 ? Math.round(((c.completed_count || 0) / c.modules_count) * 100) : 0;

                                return (
                                  <div key={c.id} className="flex flex-col items-center">
                                    
                                    {/* The Stacked Column (modules stacked bottom-to-top) */}
                                    <div className="w-32 sm:w-36 md:w-44 flex flex-col-reverse gap-2 p-2 rounded-2xl bg-slate-200/50 dark:bg-slate-900/80 border border-slate-300 dark:border-slate-700/80 shadow-inner">
                                      {modulesList.length === 0 ? (
                                        <div className="h-16 flex items-center justify-center text-[10px] text-slate-400">
                                          No modules
                                        </div>
                                      ) : (
                                        modulesList.map((m) => {
                                          const isSelected = selectedStackedModule?.module?.module_id === m.module_id;
                                          return (
                                            <div
                                              key={m.module_id}
                                              onClick={() => setSelectedStackedModule({ course: c, module: m })}
                                              className={`h-16 rounded-xl p-2.5 flex flex-col justify-between transition-all cursor-pointer transform hover:scale-[1.02] shadow-sm select-none ${
                                                m.status === 'completed'
                                                  ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 text-white border-2 border-emerald-400 shadow-emerald-500/25'
                                                  : m.status === 'in_progress'
                                                  ? 'bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 text-white border-2 border-cyan-300 shadow-cyan-500/25 animate-pulse'
                                                  : m.status === 'active'
                                                  ? 'bg-gradient-to-tr from-indigo-700 to-purple-600 text-white border-2 border-indigo-400'
                                                  : 'bg-slate-300/60 dark:bg-slate-800/80 border border-slate-400/40 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                                              } ${isSelected ? 'ring-4 ring-amber-400' : ''}`}
                                              title={`Click to inspect Module ${m.module_no}: ${m.concept_name}`}
                                            >
                                              <div className="flex items-center justify-between text-[10px] font-black uppercase">
                                                <span>Module {m.module_no}</span>
                                                <span>
                                                  {m.status === 'completed' ? '✓ Done' : m.status === 'in_progress' ? '⚡ Active' : m.status === 'active' ? '▶ Next' : '🔒 Locked'}
                                                </span>
                                              </div>
                                              <p className="text-[11px] font-bold truncate">
                                                {m.concept_name}
                                              </p>
                                              <div className="flex justify-between items-center text-[9px] font-semibold opacity-90">
                                                <span>{m.quiz_passed ? `Quiz: ${m.quiz_percentage}%` : m.quiz_score !== null ? `Quiz: ${m.quiz_percentage}%` : 'Quiz: --'}</span>
                                                <span>{m.task_submitted ? 'Task: Done' : 'Task: --'}</span>
                                              </div>
                                            </div>
                                          );
                                        })
                                      )}
                                    </div>

                                    {/* Course Label on X-Axis */}
                                    <div className="mt-3 text-center max-w-[150px]">
                                      <h4 className="font-black text-xs text-slate-800 dark:text-slate-200 truncate" title={c.title}>
                                        {c.title}
                                      </h4>
                                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 block mt-0.5">
                                        {c.completed_count || 0} / {c.modules_count || 0} Modules ({cPct}%)
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>

                        {/* Chart Legend */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs">
                          <div className="flex flex-wrap items-center gap-4">
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Legend:</span>
                            <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                              <span className="w-3 h-3 rounded-full bg-emerald-500 shadow-xs" />
                              <span>Completed</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-bold text-cyan-600 dark:text-cyan-400 text-xs">
                              <span className="w-3 h-3 rounded-full bg-cyan-500 shadow-xs" />
                              <span>In Progress</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-bold text-indigo-600 dark:text-indigo-400 text-xs">
                              <span className="w-3 h-3 rounded-full bg-indigo-500 shadow-xs" />
                              <span>Next Active</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-bold text-slate-500 text-xs">
                              <span className="w-3 h-3 rounded-full bg-slate-600 shadow-xs" />
                              <span>Locked</span>
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400 italic">Click any module block in the chart to inspect details</span>
                        </div>

                        {/* Selected Module Detail Panel */}
                        {selectedStackedModule && (
                          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border-2 border-indigo-400/60 dark:border-indigo-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-indigo-600 text-white">
                                  {selectedStackedModule.course.title}
                                </span>
                                <span className="text-xs font-black text-indigo-900 dark:text-indigo-200">
                                  Module {selectedStackedModule.module.module_no}: {selectedStackedModule.module.concept_name}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">
                                Status: <strong className="capitalize">{selectedStackedModule.module.status}</strong> • Quiz: <strong>{selectedStackedModule.module.quiz_passed ? `Passed (${selectedStackedModule.module.quiz_percentage}%)` : selectedStackedModule.module.quiz_score !== null ? `Score ${selectedStackedModule.module.quiz_percentage}%` : 'Not Attempted'}</strong> • Task Challenge: <strong>{selectedStackedModule.module.task_submitted ? 'Submitted' : 'Pending'}</strong>
                              </p>
                            </div>
                            <Link
                              to={`/course/${selectedStackedModule.course.id}?module=${selectedStackedModule.module.module_id}`}
                              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition self-start sm:self-auto cursor-pointer"
                            >
                              Launch Module &rarr;
                            </Link>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Research Metrics & Progress Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Metric 1: Cognitive Tier */}
                <div className={`p-5 rounded-3xl ${frostedCard}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Cognitive Tier</span>
                    <TrendingUp className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-2xl font-black text-blue-600">
                    {user?.leaderboard_level || 'Jogger'}
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Streak count: <strong>{user?.level_streak_count || 0}</strong>
                  </span>
                </div>

                {/* Metric 2: Enrolled Courses */}
                <div className={`p-5 rounded-3xl ${frostedCard}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Courses</span>
                    <BookOpen className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="text-2xl font-black text-indigo-600">
                    {courses.length} Classes
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Active enrollments
                  </span>
                </div>

                {/* Metric 3: Total Coins */}
                <div className={`p-5 rounded-3xl ${frostedCard}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Total Coins</span>
                    <img src={activeTheme.icons.coins} alt="Coins" className="w-6 h-6 object-contain" />
                  </div>
                  <div className="text-2xl font-black text-amber-500">
                    {user?.total_coins ?? 0}
                  </div>
                  <span className="text-xs text-slate-400 mt-1 block">
                    Earned & available
                  </span>
                </div>

                {/* Metric 4: Archetype-Specific Gamification Element */}
                {activeTheme?.visibleElements?.includes('Badges') ? (
                  <div className={`p-5 rounded-3xl ${frostedCard}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">Badges</span>
                      <Award className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="text-2xl font-black text-purple-600">
                      {collectibles.length} Earned
                    </div>
                    <Link to="/collectibles" className="text-xs text-blue-600 font-bold hover:underline mt-1 block">
                      View Trophy Room &rarr;
                    </Link>
                  </div>
                ) : activeTheme?.visibleElements?.includes('Rewards') ? (
                  <div className={`p-5 rounded-3xl ${frostedCard}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">Explorer Rewards</span>
                      <Sparkles className="w-5 h-5 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-500">
                      {user?.leaderboard_level === 'Glider' ? '+500' : user?.leaderboard_level === 'Jogger' ? '+250' : '+100'} Coins
                    </div>
                    <button 
                      onClick={() => setShowRewardsModal(true)}
                      className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline mt-1 block text-left cursor-pointer"
                    >
                      Open Rewards Vault &rarr;
                    </button>
                  </div>
                ) : activeTheme?.visibleElements?.includes('Mystery') ? (
                  <div className={`p-5 rounded-3xl ${frostedCard}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">Mystery Box</span>
                      <img src={activeTheme.icons.mystery} alt="Mystery" className="w-5 h-5 object-contain" />
                    </div>
                    <div className="text-2xl font-black text-amber-500">
                      Bonus Artifacts
                    </div>
                    <button 
                      onClick={() => setShowMysteryModal(true)}
                      className="text-xs text-amber-600 dark:text-amber-400 font-bold hover:underline mt-1 block text-left cursor-pointer"
                    >
                      Open Mystery Box &rarr;
                    </button>
                  </div>
                ) : (
                  <div className={`p-5 rounded-3xl ${frostedCard}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-500 uppercase">Class Rank</span>
                      <Award className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="text-2xl font-black text-blue-600">
                      {user?.leaderboard_level || 'Jogger'}
                    </div>
                    {courses[0] && (
                      <Link to={`/leaderboard/${courses[0].id}`} className="text-xs text-blue-600 font-bold hover:underline mt-1 block">
                        View Leaderboard &rarr;
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Course Progress Breakdown */}
              <div className={`p-6 md:p-8 rounded-3xl space-y-4 ${frostedCard}`}>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-600" />
                  Course Progress & Module Completion
                </h3>

                {courses.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4">No enrolled courses yet. Join a course using an instructor's join code.</p>
                ) : (
                  <div className="space-y-4">
                    {courses.map((c) => (
                      <div key={c.id} className={`p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isLight ? 'bg-white/60 border-white/60' : 'bg-slate-800/60 border-slate-700'
                      }`}>
                        <div className="flex-1">
                          <h4 className="font-bold text-base">{c.title}</h4>
                          <p className="text-xs text-slate-500">Instructor: {c.instructor_name} • Code: {c.join_code}</p>

                          {/* Progress Bar (Visible for Mentors & Conquerors) */}
                          {activeTheme?.visibleElements?.includes('ProgressBar') && (
                            <div className="mt-2.5 max-w-sm">
                              <div className="flex justify-between text-[11px] font-bold text-slate-400 mb-1">
                                <span>Curriculum Progress</span>
                                <span>{c.modules_count > 0 ? Math.round(((c.completed_count || 0) / c.modules_count) * 100) : 0}%</span>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700/80 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                                  style={{ width: `${c.modules_count > 0 ? Math.min(100, Math.round(((c.completed_count || 0) / c.modules_count) * 100)) : 0}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          <span className="text-xs font-bold px-3 py-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            {c.modules_count || 0} Modules Ready
                          </span>
                          {(() => {
                            const lastMod = localStorage.getItem(`last_module_${user?.id}_${c.id}`);
                            return (
                              <Link
                                to={lastMod ? `/course/${c.id}?module=${lastMod}` : `/course/${c.id}`}
                                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition shadow-xs"
                              >
                                {lastMod ? 'Resume Course' : 'Open Modules'}
                              </Link>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 2: COURSES (LIST & JOIN CLASSES)                             */}
          {/* ================================================================= */}
          {activeMenu === 'courses' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">My Enrolled Courses</h2>
                  <p className="text-xs text-slate-500">Select any course to view 3-tier study materials, take quizzes, and solve tasks.</p>
                </div>

                <button
                  onClick={() => setShowJoinModal(true)}
                  className="px-5 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 cursor-pointer shadow-sm self-start"
                >
                  <Plus className="w-4 h-4" /> Join New Course
                </button>
              </div>

              {courses.length === 0 ? (
                <div className={`p-12 text-center rounded-3xl ${frostedCard}`}>
                  <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <h3 className="text-base font-bold">No Courses Enrolled Yet</h3>
                  <p className="text-xs text-slate-500 mt-1 mb-4">Enter a course join code provided by your teacher to enroll.</p>
                  <button
                    onClick={() => setShowJoinModal(true)}
                    className="px-6 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold"
                  >
                    Join a Class
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {courses.map((course) => (
                    <Link
                      key={course.id}
                      to={`/course/${course.id}`}
                      className={`group p-6 rounded-3xl transition flex flex-col justify-between space-y-4 hover:scale-[1.01] ${frostedCard}`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                          <span className="font-mono bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold">
                            CODE: {course.join_code}
                          </span>
                          <span className="font-semibold">{course.modules_count || 0} Modules</span>
                        </div>
                        <h3 className="font-black text-lg group-hover:text-blue-600 transition">
                          {course.title}
                        </h3>
                        <p className="text-xs text-slate-500 line-clamp-2 mt-1">{course.description || 'No description provided.'}</p>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-500 pt-3 border-t border-white/40 dark:border-slate-800">
                        <div className="flex justify-between">
                          <span>Instructor:</span>
                          <span className="font-bold text-slate-700 dark:text-slate-300">{course.instructor_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Compilers:</span>
                          <span className="font-mono uppercase font-bold text-blue-600">{course.allowed_compilers?.join(', ')}</span>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-xs font-bold text-blue-600">
                        <span>Enter Course Classroom</span>
                        <ChevronRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 3: PROFILE (VIEW & EDIT STUDENT DETAILS)                     */}
          {/* ================================================================= */}
          {activeMenu === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-black">My Profile & Learner Traits</h2>
                <p className="text-xs text-slate-500">View or update your registration details, password, and psychological archetype traits.</p>
              </div>

              {profileMsg && (
                <div className="p-4 rounded-2xl bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold">
                  {profileMsg}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Form to Edit Details */}
                <div className={`lg:col-span-2 p-6 md:p-8 rounded-3xl ${frostedCard}`}>
                  <h3 className="text-base font-black mb-4 flex items-center gap-2">
                    <Edit3 className="w-4 h-4 text-blue-600" />
                    Edit Personal Information
                  </h3>

                  <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold mb-1">Full Name</label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full p-2.5 rounded-xl border text-sm bg-white/70 dark:bg-slate-800"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold mb-1">Register Number (Fixed)</label>
                        <input
                          type="text"
                          disabled
                          value={user?.regno || ''}
                          className="w-full p-2.5 rounded-xl border text-sm font-bold bg-slate-200/70 dark:bg-slate-700 text-slate-500 cursor-not-allowed"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold mb-1">Gender</label>
                        <select
                          value={editGender}
                          onChange={(e) => setEditGender(e.target.value)}
                          className="w-full p-2.5 rounded-xl border text-sm font-bold bg-white/70 dark:bg-slate-800"
                        >
                          <option value="female">Female</option>
                          <option value="male">Male</option>
                          <option value="others">Others</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">Department</label>
                      <input
                        type="text"
                        required
                        value={editDept}
                        onChange={(e) => setEditDept(e.target.value)}
                        className="w-full p-2.5 rounded-xl border text-sm bg-white/70 dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">Email Address</label>
                      <input
                        type="email"
                        required
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        className="w-full p-2.5 rounded-xl border text-sm bg-white/70 dark:bg-slate-800"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold mb-1">Change Password (leave blank to keep current)</label>
                      <input
                        type="password"
                        placeholder="••••••••"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        className="w-full p-2.5 rounded-xl border text-sm bg-white/70 dark:bg-slate-800"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                    >
                      {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
                    </button>
                  </form>
                </div>

                {/* Profile Summary & Archetype Traits */}
                <div className={`p-6 rounded-3xl space-y-4 ${frostedCard}`}>
                  <h3 className="text-base font-black">ANN Model 1 Traits</h3>
                  
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-blue-50/80 dark:bg-slate-800 border border-blue-200 dark:border-slate-700">
                      <span className="text-slate-500 font-bold block mb-1">Archetype:</span>
                      <span className="text-base font-black text-blue-600">{user?.pt_ls || 'Classified'}</span>
                    </div>

                    <div className="p-3 rounded-xl bg-indigo-50/80 dark:bg-slate-800 border border-indigo-200 dark:border-slate-700">
                      <span className="text-slate-500 font-bold block mb-1">Bartle Player Types:</span>
                      <span>Primary: <strong>{user?.ppt || 'Achiever'}</strong></span>
                      <br />
                      <span>Secondary: <strong>{user?.spt || 'Explorer'}</strong></span>
                    </div>

                    <div className="p-3 rounded-xl bg-purple-50/80 dark:bg-slate-800 border border-purple-200 dark:border-slate-700">
                      <span className="text-slate-500 font-bold block mb-1">Felder-Silverman Dimensions:</span>
                      <span className="leading-relaxed">
                        • {user?.ld1_active_reflective || 'Active'}
                        <br />
                        • {user?.ld2_sequential_global || 'Sequential'}
                        <br />
                        • {user?.ld3_sensing_intuitive || 'Sensing'}
                        <br />
                        • {user?.ld4_visual_verbal || 'Visual'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

        </main>
      </div>

      {/* JOIN CLASS MODAL */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl p-8 border shadow-2xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <h3 className="text-xl font-black mb-1">Join a Class</h3>
            <p className="text-xs text-slate-500 mb-6">Enter the class code given by your instructor.</p>

            {joinError && (
              <div className="p-3 mb-4 rounded-xl bg-red-100 border border-red-300 text-red-700 text-xs font-bold">
                {joinError}
              </div>
            )}

            <form onSubmit={handleJoinCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Class Join Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DSA2026 or 26DSKD0"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  className="w-full p-3 rounded-xl border text-sm font-mono uppercase font-bold tracking-widest bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="flex-1 py-3 rounded-xl border font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer shadow-md"
                >
                  {joining ? 'Joining...' : 'Join Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MYSTERY BOX MODAL (FOR MENTORS & PIONEERS) */}
      {showMysteryModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-xl max-h-[88vh] overflow-y-auto rounded-3xl p-6 sm:p-8 border shadow-2xl relative ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <button
              onClick={() => setShowMysteryModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center space-y-4">
              <div className="w-24 h-24 mx-auto p-2 rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shadow-lg">
                <img 
                  src={activeTheme.icons.mystery || activeTheme.icons.coins} 
                  alt="Mystery Box" 
                  className="w-20 h-20 object-contain drop-shadow-md hover:scale-110 transition-transform"
                />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                  {user?.pt_ls || 'Learner'} Mystery Vault
                </span>
                <h3 className="text-xl font-black mt-2">Mystery Box Secrets & Rewards</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Mystery Boxes contain surprise bonus materials, advanced concept keys, and cognitive challenge boosts!
                </p>
              </div>

              {/* Single Condition Rule (Specified by User) */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-left space-y-2 text-xs">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>Single Unlock Requirement:</span>
                </div>
                <div className="p-3 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-amber-300 dark:border-amber-700/60 flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs shrink-0">
                    ★
                  </span>
                  <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    Complete module quizzes with 80%+ score
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Score 80%+ on any module quiz to open that module's Mystery Box and reveal bonus study materials and secret reference links!
                </p>
              </div>

              {/* Dynamic Mystery Vault Contents */}
              <div className="space-y-3 text-left pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Your Module Mystery Boxes:
                  </h4>
                  {mysteryVault && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      {mysteryVault.total_unlocked} Unlocked
                    </span>
                  )}
                </div>

                {loadingMystery ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    Scanning quiz scores for 80%+ mastery...
                  </div>
                ) : !mysteryVault?.vaults || mysteryVault.vaults.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800">
                    No course modules found. Join a course and complete quizzes to unlock mystery boxes!
                  </div>
                ) : (
                  mysteryVault.vaults.map((vault) => (
                    <div
                      key={vault.module_id}
                      className={`p-4 rounded-2xl border transition-all ${
                        vault.is_unlocked
                          ? 'bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-transparent border-amber-400/80 dark:border-amber-500/60 shadow-xs'
                          : 'bg-slate-100/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                            vault.is_unlocked ? 'bg-amber-500 text-slate-950' : 'bg-slate-300 dark:bg-slate-700 text-slate-500'
                          }`}>
                            {vault.is_unlocked ? '🎁' : '🔒'}
                          </span>
                          <div>
                            <span className="font-extrabold text-xs text-slate-900 dark:text-white">
                              Module {vault.module_no}: {vault.concept_name}
                            </span>
                            <span className="text-[10px] text-slate-500 block">
                              {vault.course_title}
                            </span>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                            vault.is_unlocked
                              ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-500 border-slate-300 dark:border-slate-600'
                          }`}>
                            {vault.is_unlocked ? 'UNLOCKED 🎉' : 'LOCKED 🔒'}
                          </span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Quiz: {vault.quiz_percentage}%
                          </span>
                        </div>
                      </div>

                      {/* Unlocked Secret Materials */}
                      {vault.is_unlocked ? (
                        <div className="mt-3 pt-2.5 border-t border-amber-300/40 dark:border-amber-700/40 space-y-2">
                          <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 block">
                            Revealed Mystery Materials:
                          </span>
                          {vault.secret_materials && vault.secret_materials.length > 0 ? (
                            vault.secret_materials.map((mat) => (
                              <div
                                key={mat.id}
                                className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/90 border border-amber-300 dark:border-amber-700/60 flex items-center justify-between gap-2"
                              >
                                <div className="truncate">
                                  <p className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate">
                                    {mat.title}
                                  </p>
                                  <span className="text-[9px] uppercase font-semibold text-slate-400">
                                    Bonus {mat.learning_level} study material
                                  </span>
                                </div>
                                {mat.pdf_url ? (
                                  <a
                                    href={mat.pdf_url.startsWith('http') ? mat.pdf_url : `/${mat.pdf_url.replace(/^\/+/, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] inline-flex items-center gap-1 shrink-0 transition"
                                  >
                                    <span>Open Google Doc</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    Available in Classroom
                                  </span>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className="text-[11px] text-slate-400">Bonus notes & concepts unlocked for this module!</p>
                          )}
                        </div>
                      ) : (
                        <div className="mt-2 text-right">
                          <Link
                            to={`/course/${vault.course_id}?module=${vault.module_id}`}
                            onClick={() => setShowMysteryModal(false)}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                          >
                            <span>Score 80%+ on Quiz to Unlock</span>
                            <ChevronRight className="w-3 h-3" />
                          </Link>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => setShowMysteryModal(false)}
                className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs transition cursor-pointer shadow-md"
              >
                Close Mystery Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIONEER EXPLORER REWARDS VAULT MODAL (FOR PIONEERS) */}
      {showRewardsModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-3xl p-6 sm:p-8 border shadow-2xl relative ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <button
              onClick={() => setShowRewardsModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-lg">
                <Sparkles className="w-10 h-10 text-emerald-500" />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40">
                  Pioneer Archetype Rewards
                </span>
                <h3 className="text-xl font-black mt-2">Explorer Milestone Rewards</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Pioneers receive direct currency rewards upon mastering cognitive tiers!
                </p>
              </div>

              <div className="space-y-2.5 text-left">
                {/* Stepper Milestone */}
                <div className="p-3.5 rounded-2xl border flex items-center justify-between bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800">
                  <div className="flex items-center gap-3">
                    <span className="w-7 h-7 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xs">
                      ✓
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Stepper Pioneer Base</h4>
                      <p className="text-[10px] text-slate-500">Foundation exploration milestone</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-white/80 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    +100 Coins
                  </span>
                </div>

                {/* Jogger Milestone */}
                <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  user?.leaderboard_level === 'Jogger' || user?.leaderboard_level === 'Glider'
                    ? 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                      user?.leaderboard_level === 'Jogger' || user?.leaderboard_level === 'Glider'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>
                      {user?.leaderboard_level === 'Jogger' || user?.leaderboard_level === 'Glider' ? '✓' : '🔒'}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Jogger Tactician Upgrade</h4>
                      <p className="text-[10px] text-slate-500">Promoted to Average Tier via 2x 80%+ tasks</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-white/80 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                    +250 Coins
                  </span>
                </div>

                {/* Glider Milestone */}
                <div className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                  user?.leaderboard_level === 'Glider'
                    ? 'bg-purple-50/80 dark:bg-purple-950/30 border-purple-300 dark:border-purple-800'
                    : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-75'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                      user?.leaderboard_level === 'Glider'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                    }`}>
                      {user?.leaderboard_level === 'Glider' ? '✓' : '🔒'}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Glider Master Pathfinder</h4>
                      <p className="text-[10px] text-slate-500">Promoted to Fast Tier via consecutive mastery</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-purple-600 dark:text-purple-400 bg-white/80 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800">
                    +500 Coins
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRewardsModal(false)}
                  className="flex-1 py-3 rounded-xl border font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Close Vault
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowRewardsModal(false);
                    setShowAppreciationModal(true);
                  }}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-md"
                >
                  Celebrate Status 🎉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* APPRECIATION MODAL (VIDEO / ANIMATION) */}
      <AppreciationModal
        isOpen={showAppreciationModal}
        onClose={() => setShowAppreciationModal(false)}
        title="Explorer Recognition Award!"
        subtitle={`Congratulations ${user?.name}! Your Pioneer perseverance in ${user?.leaderboard_level || 'Stepper'} tier is commended.`}
        coinsAwarded={user?.leaderboard_level === 'Glider' ? 500 : user?.leaderboard_level === 'Jogger' ? 250 : 100}
        archetype={user?.pt_ls || 'Pioneers'}
      />

      {/* GAME ELEMENTS & LIFELINES TOUR MODAL */}
      <GameElementsTourModal
        isOpen={showTourModal}
        onClose={handleCloseTour}
      />

    </div>
  );
}
