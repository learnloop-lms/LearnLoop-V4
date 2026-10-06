import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeToggle } from '../context/ThemeContext';
import { useVisionaryFeedback } from '../context/VisionaryFeedbackContext';
import { 
  ArrowLeft, BookOpen, CheckCircle, Clock, Zap, 
  HelpCircle, Code2, Lock, ChevronDown, ChevronUp, MessageSquare, Plus, Award, ExternalLink,
  Check, AlertCircle, ArrowRight, Sparkles, Trophy
} from 'lucide-react';

export default function CourseView() {
  const { courseId } = useParams();
  const [searchParams] = useSearchParams();
  const { user, activeTheme, API_BASE, fetchProfile } = useAuth();
  const { triggerFeedback } = useVisionaryFeedback();
  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [modulesSummary, setModulesSummary] = useState([]);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [progress, setProgress] = useState(null);
  const [isMaterialReadLocal, setIsMaterialReadLocal] = useState(false);
  const [courseLeaderboard, setCourseLeaderboard] = useState(null);
  const [peerQueries, setPeerQueries] = useState([]);
  const [newQueryText, setNewQueryText] = useState('');
  const [showAskModal, setShowAskModal] = useState(false);
  const [replyText, setReplyText] = useState({});
  const [showMysteryModal, setShowMysteryModal] = useState(false);
  const [showRewardsModal, setShowRewardsModal] = useState(false);
  const [showRevalModal, setShowRevalModal] = useState(false);
  const [revalReason, setRevalReason] = useState('');
  const [submittingReval, setSubmittingReval] = useState(false);
  const [revalMsg, setRevalMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCourseDetails();
    fetchModules();
    fetchModulesSummary();
    fetchCourseLeaderboard();
  }, [courseId]);

  const fetchModulesSummary = async () => {
    try {
      const res = await axios.get(`${API_BASE}/courses/${courseId}/modules-completion-summary`);
      setModulesSummary(res.data);
    } catch (err) {
      console.error('Failed to fetch modules completion summary:', err);
    }
  };

  const fetchCourseLeaderboard = async () => {
    try {
      const res = await axios.get(`${API_BASE}/leaderboards/${courseId}`);
      setCourseLeaderboard(res.data);
    } catch (err) {
      console.error('Failed to fetch course leaderboard:', err);
    }
  };

  useEffect(() => {
    if (course?.title) {
      triggerFeedback('course_opened', { course: course.title });
    }
  }, [course?.id]);

  useEffect(() => {
    if (activeModuleId) {
      fetchMaterials(activeModuleId);
      fetchPeerQueries(activeModuleId);
      fetchModuleProgress(activeModuleId);
      if (user) {
        const stored = localStorage.getItem(`material_read_${user.id}_${activeModuleId}`) === 'true';
        setIsMaterialReadLocal(stored);
      }
    }
  }, [activeModuleId, user]);

  useEffect(() => {
    const modParam = searchParams.get('module');
    if (modParam && modules.some(m => m.id === modParam)) {
      setActiveModuleId(modParam);
    }
  }, [searchParams, modules]);

  const fetchCourseDetails = async () => {
    try {
      const res = await axios.get(`${API_BASE}/courses`);
      const found = res.data.find(c => c.id === courseId);
      setCourse(found);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchModules = async () => {
    try {
      const res = await axios.get(`${API_BASE}/courses/${courseId}/modules`);
      setModules(res.data);
      if (res.data.length > 0) {
        const targetMod = searchParams.get('module');
        const savedMod = localStorage.getItem(`last_module_${user?.id}_${courseId}`);
        if (targetMod && res.data.some(m => m.id === targetMod)) {
          setActiveModuleId(targetMod);
        } else if (savedMod && res.data.some(m => m.id === savedMod)) {
          setActiveModuleId(savedMod);
        } else {
          setActiveModuleId(res.data[0].id);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeModuleId && user) {
      localStorage.setItem(`last_module_${user.id}_${courseId}`, activeModuleId);
    }
  }, [activeModuleId, user, courseId]);

  const fetchModuleProgress = async (moduleId) => {
    try {
      const res = await axios.get(`${API_BASE}/courses/modules/${moduleId}/student-progress`);
      setProgress(res.data);
      fetchModulesSummary();
    } catch (err) {
      console.error('Error fetching student progress:', err);
    }
  };

  const fetchMaterials = async (moduleId) => {
    try {
      const res = await axios.get(`${API_BASE}/courses/modules/${moduleId}/materials`);
      setMaterials(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkMaterialRead = () => {
    if (user && activeModuleId) {
      localStorage.setItem(`material_read_${user.id}_${activeModuleId}`, 'true');
    }
    setIsMaterialReadLocal(true);
    triggerFeedback('progress_forward', { course: course?.title });
  };

  const isMaterialRead = Boolean(
    isMaterialReadLocal || 
    (user && activeModuleId && localStorage.getItem(`material_read_${user.id}_${activeModuleId}`) === 'true') ||
    progress?.quiz_completed ||
    progress?.task_submitted
  );

  const regularMaterials = materials.filter((m) => !m.is_locked_bonus);
  const mysteryMaterials = materials.filter((m) => m.is_locked_bonus);
  const isMysteryUnlocked = Boolean(progress?.quiz_passed);

  // Resume Course: Auto-focus and scroll to where learner left off
  useEffect(() => {
    if (progress) {
      const step = searchParams.get('step');
      if (step === 'material') {
        document.getElementById('stage-material')?.scrollIntoView({ behavior: 'smooth' });
      } else if (progress.quiz_passed && !progress.task_submitted) {
        // Quiz completed and passed! Auto-scroll to Stage 3 Assignment
        setTimeout(() => {
          document.getElementById('stage-task')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      } else if (isMaterialRead && !progress.quiz_passed) {
        // Study material read! Auto-scroll to Stage 2 Quiz
        setTimeout(() => {
          document.getElementById('stage-quiz')?.scrollIntoView({ behavior: 'smooth' });
        }, 500);
      }
    }
  }, [progress, isMaterialRead, searchParams]);

  const fetchPeerQueries = async (moduleId) => {
    try {
      const res = await axios.get(`${API_BASE}/peer/module/${moduleId}/queries`);
      setPeerQueries(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePostQuery = async (e) => {
    e.preventDefault();
    if (!newQueryText.trim()) return;
    try {
      await axios.post(`${API_BASE}/peer/query`, {
        module_id: activeModuleId,
        query_text: newQueryText
      });
      setNewQueryText('');
      setShowAskModal(false);
      await fetchProfile(); // Synchronize coin balance immediately
      fetchPeerQueries(activeModuleId);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to post query. Ensure you have at least 20 coins.');
    }
  };

  const handleRequestRevaluation = async (e) => {
    e.preventDefault();
    if (!revalReason.trim()) return;
    setSubmittingReval(true);
    try {
      await axios.post(`${API_BASE}/revaluations`, {
        assessment_type: 'task',
        assessment_id: progress?.task_submission_id,
        student_reason: revalReason
      });
      setRevalMsg('Revaluation appeal submitted to instructor!');
      setTimeout(() => {
        setShowRevalModal(false);
        setRevalReason('');
        setRevalMsg('');
        fetchModuleProgress(activeModuleId);
      }, 1500);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit revaluation request.');
    } finally {
      setSubmittingReval(false);
    }
  };

  const handlePostAnswer = async (queryId) => {
    const text = replyText[queryId];
    if (!text || !text.trim()) return;
    try {
      await axios.post(`${API_BASE}/peer/answer`, {
        query_id: queryId,
        answer_text: text
      });
      setReplyText({ ...replyText, [queryId]: '' });
      fetchPeerQueries(activeModuleId);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to post answer.');
    }
  };

  const handleAcknowledge = async (answerId) => {
    try {
      await axios.post(`${API_BASE}/peer/acknowledge/${answerId}`);
      fetchPeerQueries(activeModuleId);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to acknowledge.');
    }
  };

  const { isLight } = useTheme();
  const activeModule = modules.find((m) => m.id === activeModuleId) || modules[0];

  const userTier = user?.leaderboard_level || (user?.cognitive_level === 'slow' ? 'Stepper' : user?.cognitive_level === 'fast' ? 'Glider' : 'Jogger');
  const hasLeaderboard = !activeTheme?.visibleElements || activeTheme.visibleElements.includes('Leaderboard');
  const currentTierList = userTier === 'Stepper' 
    ? (courseLeaderboard?.stepper_leaderboard || [])
    : userTier === 'Glider'
    ? (courseLeaderboard?.glider_leaderboard || [])
    : (courseLeaderboard?.jogger_leaderboard || []);

  const tierConfig = {
    Stepper: {
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
      accent: 'border-emerald-500/40',
      headerBg: 'from-emerald-500/15 via-teal-500/10 to-transparent',
      text: 'text-emerald-600 dark:text-emerald-400',
      label: 'Stepper Tier'
    },
    Jogger: {
      badge: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
      accent: 'border-amber-500/40',
      headerBg: 'from-amber-500/15 via-yellow-500/10 to-transparent',
      text: 'text-amber-600 dark:text-amber-400',
      label: 'Jogger Tier'
    },
    Glider: {
      badge: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
      accent: 'border-purple-500/40',
      headerBg: 'from-purple-500/15 via-indigo-500/10 to-transparent',
      text: 'text-purple-600 dark:text-purple-400',
      label: 'Glider Tier'
    }
  };
  const activeTierCfg = tierConfig[userTier] || tierConfig.Jogger;

  const bgOverlay = isLight 
    ? `linear-gradient(to bottom, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.22)), url(${activeTheme.bgImage})`
    : `linear-gradient(to bottom, rgba(10, 15, 29, 0.88), rgba(5, 8, 16, 0.96)), url(${activeTheme.bgImage})`;

  return (
    <div 
      className={`min-h-screen font-sans bg-cover bg-center bg-fixed transition-colors duration-200 ${
        isLight ? 'text-slate-900' : 'text-slate-100'
      }`}
      style={{ backgroundImage: bgOverlay }}
    >
      {/* Top Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md px-4 md:px-8 py-3 border-b shadow-xs ${
        isLight ? 'bg-white/85 border-white/60' : 'bg-slate-950/80 border-slate-800'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Left: Navigation and Course title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/dashboard')}
              className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
              }`}
              title="Return to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="font-black text-sm truncate">{course?.title || 'Course Classroom'}</h1>
              <p className="text-[11px] text-slate-500">
                Join Code: <span className="font-mono text-blue-600 dark:text-cyan-400 font-bold">{course?.join_code}</span>
              </p>
            </div>
          </div>

          {/* Middle: Common Elements (Hearts, Coins, Keys) */}
          <div className={`flex items-center gap-3 px-3 py-1.5 rounded-2xl border backdrop-blur-md ${
            isLight ? 'bg-white/80 border-slate-200/80 shadow-xs' : 'bg-slate-900/80 border-slate-800'
          }`}>
            {/* Hearts */}
            <div className="flex items-center gap-1.5" title="Hearts / Lifelines">
              <img src={activeTheme.icons.hearts} alt="Hearts" className="w-6 h-6 object-contain shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
              <div>
                <span className="text-[8px] uppercase font-bold text-slate-400 block -mb-1">Hearts</span>
                <span className="font-black text-xs text-rose-500">{user?.hearts ?? 5}/5</span>
              </div>
            </div>

            <div className={`w-px h-5 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

            {/* Coins */}
            <div className="flex items-center gap-1.5" title="Reward Coins (Spendable on lifelines & peer queries)">
              <img src={activeTheme.icons.coins} alt="Coins" className="w-6 h-6 object-contain shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
              <div>
                <span className="text-[8px] uppercase font-bold text-slate-400 block -mb-1">Coins</span>
                <span className="font-black text-xs text-amber-500">{user?.total_coins ?? 0}</span>
              </div>
            </div>

            <div className={`w-px h-5 ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`} />

            {/* Keys */}
            <div className="flex items-center gap-1.5" title="Keys - Used to unlock advanced concepts">
              <img src={activeTheme.icons.keys} alt="Keys" className="w-6 h-6 object-contain shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
              <div>
                <span className="text-[8px] uppercase font-bold text-slate-400 block -mb-1">Keys</span>
                <span className="font-black text-xs text-cyan-500">{user?.total_keys ?? 1}</span>
              </div>
            </div>
          </div>

          {/* Right: Theme Toggle & Archetype Elements */}
          <div className="flex items-center gap-2">
            <ThemeToggle />

            {/* Badges: Visible ONLY for Visionaries, Mentors, Conquerors (HIDDEN for Pioneers) */}
            {activeTheme?.visibleElements?.includes('Badges') && (
              <Link
                to="/collectibles"
                className={`p-2 sm:px-3 sm:py-2 rounded-xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isLight ? 'bg-white/80 hover:bg-white text-slate-700 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title="Trophies & Badges"
              >
                <Award className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">Badges</span>
              </Link>
            )}

            {/* Mystery Box: Visible ONLY for Mentors & Pioneers (HIDDEN for Visionaries & Conquerors) */}
            {activeTheme?.visibleElements?.includes('Mystery') && activeTheme.icons?.mystery && (
              <button
                onClick={() => setShowMysteryModal(true)}
                className={`p-2 sm:px-3 sm:py-2 rounded-xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isLight ? 'bg-white/80 hover:bg-amber-50 text-amber-800 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-slate-700'
                }`}
                title="Mystery Box Secrets"
              >
                <img src={activeTheme.icons.mystery} alt="Mystery Box" className="w-4 h-4 object-contain" />
                <span className="hidden sm:inline">Mystery Box</span>
              </button>
            )}

            {/* Rewards Vault: Visible ONLY for Pioneers */}
            {activeTheme?.visibleElements?.includes('Rewards') && (
              <button
                onClick={() => setShowRewardsModal(true)}
                className={`p-2 sm:px-3 sm:py-2 rounded-xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isLight ? 'bg-white/80 hover:bg-emerald-50 text-emerald-800 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-emerald-300 border-slate-700'
                }`}
                title="Pioneer Milestone Rewards"
              >
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span className="hidden sm:inline">Rewards Vault</span>
              </button>
            )}

            {/* Leaderboard: Visible for Visionaries, Pioneers, Conquerors (HIDDEN for Mentors) */}
            {activeTheme?.visibleElements?.includes('Leaderboard') && (
              <Link
                to={`/leaderboard/${courseId}`}
                className={`p-2 sm:px-3 sm:py-2 rounded-xl border transition cursor-pointer flex items-center gap-1.5 text-xs font-bold ${
                  isLight ? 'bg-white/80 hover:bg-blue-50 text-blue-700 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-blue-300 border-slate-700'
                }`}
                title="Leaderboard Standings"
              >
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="hidden sm:inline">Leaderboard</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Left Sidebar: Modules List (Sequential Unlocking) */}
        <div className="lg:col-span-1 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
            Course Topics & Concepts
          </h2>

          <div className="space-y-2">
            {modules.map((m, idx) => {
              const isActive = m.id === activeModuleId;
              const isFirst = idx === 0;
              const prevMod = idx > 0 ? modules[idx - 1] : null;
              const prevSummary = prevMod ? modulesSummary.find(s => s.module_id === prevMod.id) : null;
              const isUnlocked = isFirst || Boolean(prevSummary?.task_submitted || prevSummary?.is_completed);

              const currentSummary = modulesSummary.find(s => s.module_id === m.id);
              const isCompleted = Boolean(currentSummary?.task_submitted || currentSummary?.is_completed);

              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (!isUnlocked) {
                      alert(`Module ${m.module_no} is locked. Complete previous module (Module ${prevMod?.module_no}: ${prevMod?.concept_name}) first to unlock this module!`);
                      return;
                    }
                    setActiveModuleId(m.id);
                  }}
                  className={`w-full text-left p-3.5 rounded-2xl transition border ${
                    !isUnlocked
                      ? (isLight ? 'bg-slate-100/70 border-slate-200 text-slate-400 opacity-60 cursor-not-allowed' : 'bg-slate-950/40 border-slate-800/80 text-slate-500 opacity-50 cursor-not-allowed')
                      : isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 cursor-pointer'
                      : isLight
                      ? 'bg-white/75 backdrop-blur-md border-white/60 text-slate-800 hover:bg-white cursor-pointer'
                      : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className={`font-mono text-[10px] font-bold ${isActive ? 'text-white' : isUnlocked ? 'text-blue-600 dark:text-cyan-400' : 'text-slate-400'}`}>
                      MODULE {m.module_no}
                    </span>
                    <div className="flex items-center gap-1">
                      {isCompleted ? (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${isActive ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'}`}>
                          ✓ Done
                        </span>
                      ) : !isUnlocked ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-500 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5" /> Locked
                        </span>
                      ) : (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-white/20 text-white' : isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'}`}>
                          Tier {m.complexity_cmc}
                        </span>
                      )}
                    </div>
                  </div>
                  <h4 className="font-semibold text-xs line-clamp-1">
                    {m.concept_name}
                  </h4>
                  {!isUnlocked && prevMod && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1 font-medium">
                      <Lock className="w-2.5 h-2.5 shrink-0" />
                      Complete Mod {prevMod.module_no} to unlock
                    </p>
                  )}
                </button>
              );
            })}
          </div>

          {/* Embedded Dynamic Tier Leaderboard (shows Stepper if Stepper, Jogger if Jogger, Glider if Glider) */}
          {hasLeaderboard && (
            <div className={`mt-6 rounded-3xl p-4 border transition-all ${
              isLight ? 'bg-white/80 backdrop-blur-md border-white/60 shadow-lg' : 'bg-slate-900/85 backdrop-blur-md border-slate-800 shadow-xl text-white'
            }`}>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${activeTierCfg.headerBg} border ${activeTierCfg.accent} flex items-center justify-center shrink-0`}>
                    <Trophy className={`w-4 h-4 ${activeTierCfg.text}`} />
                  </div>
                  <div>
                    <h3 className="font-black text-xs tracking-tight">
                      {userTier} Leaderboard
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium">
                      Classmates in your tier
                    </p>
                  </div>
                </div>

                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${activeTierCfg.badge}`}>
                  {userTier}
                </span>
              </div>

              {/* Classmates List in this tier */}
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {currentTierList.length === 0 ? (
                  <p className="text-[11px] text-slate-400 py-4 text-center">
                    No classmates in {userTier} tier yet.
                  </p>
                ) : (
                  currentTierList.map((entry, idx) => {
                    const isCurrentUser = entry.student_id === user?.id;
                    const rank = idx + 1;
                    return (
                      <div
                        key={entry.student_id || idx}
                        className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition ${
                          isCurrentUser
                            ? isLight
                              ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-400/50 shadow-sm'
                              : 'bg-amber-950/40 border-amber-500/60 ring-2 ring-amber-400/40 shadow-sm'
                            : isLight
                            ? 'bg-white/60 border-slate-200/80 hover:bg-white'
                            : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Rank indicator */}
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                            rank === 1
                              ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                              : rank === 2
                              ? 'bg-slate-300 text-slate-900 font-bold dark:bg-slate-700 dark:text-slate-100'
                              : rank === 3
                              ? 'bg-amber-700/60 text-white font-bold'
                              : isLight ? 'text-slate-500 bg-slate-100' : 'text-slate-400 bg-slate-800'
                          }`}>
                            {rank}
                          </div>

                          {/* Avatar */}
                          <div className="w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-white/40">
                            <img
                              src={entry.avatar_path || activeTheme.icons.coins}
                              alt=""
                              className="w-full h-full object-contain p-0.5"
                              onError={(e) => { e.target.src = activeTheme.icons.coins; }}
                            />
                          </div>

                          {/* Name and Tag */}
                          <div className="min-w-0">
                            <p className={`text-xs font-bold truncate ${isCurrentUser ? 'text-amber-700 dark:text-amber-300 font-black' : isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                              {entry.name} {isCurrentUser && <span className="text-[10px] font-black uppercase text-amber-600 dark:text-amber-400">(You)</span>}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {entry.regno || entry.pt_ls}
                            </p>
                          </div>
                        </div>

                        {/* Points & Coins */}
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-black block ${isCurrentUser ? 'text-amber-600 dark:text-amber-400' : activeTierCfg.text}`}>
                            {entry.total_score} pts
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">
                            🪙 {entry.total_coins}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* View full 3-tier board link */}
              <Link
                to={`/leaderboard/${courseId}`}
                className="mt-3 block text-center py-2 px-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30 transition"
              >
                View All Tiers & Standings &rarr;
              </Link>
            </div>
          )}
        </div>

        {/* Right Main Content: Active Module Workspace */}
        <div className="lg:col-span-3 space-y-6">
          {activeModule ? (
            <>
              {/* Module Header Card */}
              <div 
                className={`rounded-3xl p-6 border shadow-lg backdrop-blur-md ${
                  isLight ? 'border-white/60 text-slate-900' : 'border-slate-800 shadow-2xl text-white'
                }`}
                style={{ background: isLight ? 'rgba(255, 255, 255, 0.75)' : activeTheme.cardBg }}
              >
                <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 dark:text-cyan-400">
                      Module {activeModule.module_no} • Sequential Mastery
                    </span>
                    <h2 className="text-2xl font-black mt-1">
                      {activeModule.concept_name}
                    </h2>
                    <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                      Your current cognitive status is{' '}
                      <span className="font-bold text-amber-500 capitalize">{user?.cognitive_level || 'average'} ({user?.leaderboard_level})</span>.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                      progress?.task_submitted
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                        : progress?.quiz_passed
                        ? 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-950 dark:text-cyan-300'
                        : isMaterialRead
                        ? 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                        : 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {progress?.task_submitted ? 'Module Complete' : progress?.quiz_passed ? 'Stage 3: Task Active' : isMaterialRead ? 'Stage 2: Quiz Ready' : 'Stage 1: Study Material'}
                    </span>
                  </div>
                </div>

                <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                  Follow the stages one by one: <strong>1. Review Study Material</strong> &rarr; <strong>2. Pass Adaptive Quiz</strong> &rarr; <strong>3. Complete Coding Task</strong>.
                </p>

                {/* 3 SEQUENTIAL MILESTONES: ONE BY ONE */}
                <div className="mt-6 space-y-6">

                  {/* LEVEL 1: STUDY MATERIAL */}
                  <div id="stage-material" className={`p-6 rounded-3xl border transition-all ${
                    isMaterialRead
                      ? (isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-900/60')
                      : (isLight ? 'bg-white/80 border-blue-200 shadow-md' : 'bg-slate-900/90 border-blue-900/60 shadow-xl')
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                          1
                        </span>
                        <div>
                          <h3 className={`font-bold text-sm flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            <BookOpen className="w-4 h-4 text-blue-500" />
                            Level 1: Study Material ({user?.leaderboard_level || 'General'} Tier)
                          </h3>
                          <p className="text-[11px] text-slate-500">Read the assigned topic notes and document to unlock the quiz.</p>
                        </div>
                      </div>

                      {isMaterialRead ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Completed & Read
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300">
                          <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          Required Reading
                        </span>
                      )}
                    </div>

                    {/* Regular Materials content */}
                    {regularMaterials.length === 0 ? (
                      <div className={`p-4 rounded-2xl border text-xs text-center ${
                        isLight ? 'bg-white/60 border-white/60 text-slate-500' : 'bg-slate-950/60 border-slate-800 text-slate-400'
                      }`}>
                        No study material assigned for this module yet.
                      </div>
                    ) : (
                      regularMaterials.map((mat) => (
                        <div key={mat.id} className={`p-4 rounded-2xl border space-y-3 mb-3 ${
                          isLight ? 'bg-white/90 border-slate-200 text-slate-800' : 'bg-slate-950/70 border-slate-800 text-slate-200'
                        }`}>
                          <div className="flex items-center justify-between">
                            <h4 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>{mat.title}</h4>
                            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${
                              isLight ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-cyan-950 text-cyan-300 border-cyan-800'
                            }`}>
                              {mat.learning_level} Material
                            </span>
                          </div>

                          <div 
                            className={`text-xs leading-relaxed prose max-w-none ${isLight ? 'prose-slate text-slate-700' : 'prose-invert text-slate-300'}`}
                            dangerouslySetInnerHTML={{ __html: mat.content_html }}
                          />

                          {mat.pdf_url && (
                            <div className="pt-2">
                              <a
                                href={mat.pdf_url.startsWith('http') ? mat.pdf_url : `/${mat.pdf_url.replace(/^\/+/, '')}`}
                                target="_blank"
                                rel="noreferrer"
                                onClick={handleMarkMaterialRead}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                              >
                                <span>Open Reference / Drive Document</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            </div>
                          )}
                        </div>
                      ))
                    )}

                    {/* Bottom Action for Level 1 */}
                    <div className="pt-3 flex items-center justify-between">
                      {!isMaterialRead ? (
                        <button
                          onClick={handleMarkMaterialRead}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs shadow-md shadow-blue-500/20 cursor-pointer flex items-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          Mark as Read & Understood (Unlocks Quiz)
                        </button>
                      ) : (
                        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle className="w-4 h-4" />
                          <span>Material reviewed. Level 2 Adaptive Quiz is unlocked below!</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* LEVEL 2: ADAPTIVE QUIZ */}
                  <div id="stage-quiz" className={`p-6 rounded-3xl border transition-all ${
                    progress?.quiz_passed
                      ? (isLight ? 'bg-emerald-50/40 border-emerald-200' : 'bg-emerald-950/20 border-emerald-900/60')
                      : isMaterialRead
                      ? (isLight ? 'bg-amber-50/40 border-amber-300 shadow-md' : 'bg-slate-900/90 border-amber-500/40 shadow-xl')
                      : (isLight ? 'bg-slate-100/70 border-slate-200 opacity-60' : 'bg-slate-950/40 border-slate-800/80 opacity-50')
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                          progress?.quiz_passed 
                            ? 'bg-emerald-600 text-white' 
                            : isMaterialRead 
                            ? 'bg-amber-500 text-white' 
                            : 'bg-slate-400 text-white'
                        }`}>
                          2
                        </span>
                        <div>
                          <h3 className={`font-bold text-sm flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            <Zap className="w-4 h-4 text-amber-500" />
                            Level 2: Adaptive Quiz (10 Questions)
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            Required Passing Score: <span className="font-bold text-amber-600">{progress?.passing_threshold || 5.0} / 10</span>
                          </p>
                        </div>
                      </div>

                      {/* Quiz Status Badge */}
                      {progress?.quiz_passed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                          <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Passed (Score: {progress.quiz_score}/10)
                        </span>
                      ) : !isMaterialRead ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-400">
                          <Lock className="w-4 h-4" />
                          Locked
                        </span>
                      ) : progress?.quiz_completed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300">
                          <AlertCircle className="w-4 h-4 text-amber-600" />
                          Retake Needed (Score: {progress.quiz_score}/10)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300 dark:bg-cyan-950 dark:text-cyan-300">
                          <Sparkles className="w-4 h-4 text-blue-600 dark:text-cyan-400" />
                          Ready to Take
                        </span>
                      )}
                    </div>

                    {/* Quiz Body Info */}
                    {!isMaterialRead ? (
                      <p className="text-xs text-slate-500 italic">
                        Please review and mark Level 1 Study Material as read above to enable this quiz.
                      </p>
                    ) : progress?.quiz_passed ? (
                      <div className="space-y-3">
                        <div className={`p-4 rounded-2xl border text-xs ${
                          isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
                        }`}>
                          <p className="font-bold flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            Congratulations! You passed the Adaptive Quiz with {progress.quiz_score}/10.
                          </p>
                          <p className="text-[11px] mt-1 text-emerald-800 dark:text-emerald-300">
                            The quiz stage is now complete. Proceed directly to Level 3 Task Adaptation below!
                          </p>
                        </div>
                        {/* Disabled button as requested: "if they redirect to assignment that time only assignment has to enable it and quiz has to disable" */}
                        <button
                          disabled
                          className="px-5 py-2.5 rounded-xl bg-slate-300 dark:bg-slate-800 text-slate-500 font-bold text-xs cursor-not-allowed flex items-center gap-2 opacity-70"
                        >
                          <Lock className="w-4 h-4" />
                          Quiz Passed & Completed (Disabled)
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {progress?.quiz_completed && (
                          <div className={`p-4 rounded-2xl border text-xs ${
                            isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/50 border-amber-800 text-amber-200'
                          }`}>
                            <p className="font-bold">
                              Score: {progress.quiz_score} / 10 (Passing threshold: {progress.passing_threshold} / 10).
                            </p>
                            <p className="text-[11px] mt-1">
                              You need to score above the threshold to unlock the coding assignment. Review the material and retake the quiz!
                            </p>
                          </div>
                        )}
                        <p className="text-xs text-slate-500">
                          10 questions calibrated to your cognitive tier. Lifelines (50:50, Hint, Ask Expert) are available inside.
                        </p>
                        <button
                          onClick={() => navigate(`/quiz/${activeModule.id}`)}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-red-600 text-white font-bold text-xs shadow-lg shadow-amber-500/20 hover:opacity-95 transition flex items-center gap-2 cursor-pointer"
                        >
                          <Zap className="w-4 h-4" />
                          {progress?.quiz_completed ? 'Retake Adaptive Quiz (10 Qs)' : 'Take Adaptive Quiz (10 Qs)'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* LEVEL 3: TASK ADAPTATION WORKBENCH */}
                  <div id="stage-task" className={`p-6 rounded-3xl border transition-all ${
                    progress?.task_submitted
                      ? (isLight ? 'bg-indigo-50/40 border-indigo-200' : 'bg-indigo-950/20 border-indigo-900/60')
                      : progress?.quiz_passed
                      ? (isLight ? 'bg-cyan-50/40 border-cyan-300 shadow-md' : 'bg-slate-900/90 border-cyan-500/40 shadow-xl')
                      : (isLight ? 'bg-slate-100/70 border-slate-200 opacity-60' : 'bg-slate-950/40 border-slate-800/80 opacity-50')
                  }`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs ${
                          progress?.task_submitted 
                            ? 'bg-indigo-600 text-white' 
                            : progress?.quiz_passed 
                            ? 'bg-cyan-600 text-white' 
                            : 'bg-slate-400 text-white'
                        }`}>
                          3
                        </span>
                        <div>
                          <h3 className={`font-bold text-sm flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            <Code2 className="w-4 h-4 text-cyan-500" />
                            Level 3: Task Adaptation / Coding Workbench
                          </h3>
                          <p className="text-[11px] text-slate-500">
                            ANN Model 3 Personalized Challenge & Compiler Workspace
                          </p>
                        </div>
                      </div>

                      {/* Task Status Badge */}
                      {progress?.task_submitted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 border border-indigo-300 dark:bg-indigo-950 dark:text-indigo-300">
                          <CheckCircle className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          {progress.task_status === 'graded' ? `Graded (${progress.task_score} marks)` : 'Submitted (Under Review)'}
                        </span>
                      ) : !progress?.quiz_passed ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300 dark:bg-slate-800 dark:text-slate-400">
                          <Lock className="w-4 h-4" />
                          Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300">
                          <Sparkles className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          Unlocked & Active
                        </span>
                      )}
                    </div>

                    {/* Task Body Info */}
                    {!progress?.quiz_passed ? (
                      <p className="text-xs text-slate-500 italic">
                        Locked: Pass the Level 2 Adaptive Quiz with a score &ge; {progress?.passing_threshold || 5.0} to enable this task challenge.
                      </p>
                    ) : progress?.task_submitted ? (
                      <div className="space-y-3">
                        <div className={`p-4 rounded-2xl border text-xs ${
                          progress.task_status === 'graded'
                            ? (isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-emerald-950/50 border-emerald-800 text-emerald-200')
                            : (isLight ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : 'bg-indigo-950/50 border-indigo-800 text-indigo-200')
                        }`}>
                          <p className="font-bold flex items-center gap-1.5">
                            <CheckCircle className="w-4 h-4" />
                            {progress.task_status === 'graded'
                              ? `Evaluated by Instructor: Awarded ${progress.task_score} marks.`
                              : 'Your solution has been submitted and is awaiting instructor grading.'}
                          </p>
                          {progress.task_feedback && (
                            <p className="mt-2 text-[11px] italic bg-white/70 dark:bg-slate-900/70 p-2.5 rounded-xl border border-indigo-100 dark:border-indigo-900">
                              <strong>Teacher Feedback:</strong> &ldquo;{progress.task_feedback}&rdquo;
                            </p>
                          )}

                          {/* Revaluation Status Banner */}
                          {progress.revaluation_status === 'pending' && (
                            <div className="mt-3 p-2.5 rounded-xl bg-purple-100/90 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 text-[11px] text-purple-900 dark:text-purple-300 flex items-center gap-2">
                              <Clock className="w-4 h-4 text-purple-600 shrink-0" />
                              <span>Your Revaluation Request has been submitted and is currently pending instructor review.</span>
                            </div>
                          )}

                          {progress.revaluation_status === 'accepted' && (
                            <div className="mt-3 p-2.5 rounded-xl bg-emerald-100/90 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-[11px] text-emerald-900 dark:text-emerald-300">
                              <div className="flex items-center gap-2 font-bold">
                                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Revaluation Accepted! Revised Mark: {progress.revaluation_revised_score ?? progress.task_score} marks.</span>
                              </div>
                              {progress.revaluation_notes && (
                                <p className="mt-1 text-[10px] text-emerald-800 dark:text-emerald-400 italic">
                                  Teacher Notes: &ldquo;{progress.revaluation_notes}&rdquo;
                                </p>
                              )}
                            </div>
                          )}

                          {progress.revaluation_status === 'rejected' && (
                            <div className="mt-3 p-2.5 rounded-xl bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300">
                              <div className="flex items-center gap-2 font-semibold">
                                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                                <span>Revaluation Reviewed: Original mark retained ({progress.task_score} marks).</span>
                              </div>
                              {progress.revaluation_notes && (
                                <p className="mt-1 text-[10px] text-slate-500 italic">
                                  Notes: &ldquo;{progress.revaluation_notes}&rdquo;
                                </p>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            onClick={() => navigate(`/task/${activeModule.id}`)}
                            className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
                          >
                            <Code2 className="w-4 h-4" />
                            View Submitted Code & Execution
                          </button>

                          {progress.task_status === 'graded' && !progress.revaluation_status && (
                            <button
                              onClick={() => setShowRevalModal(true)}
                              className="px-4 py-2.5 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/40 dark:hover:bg-purple-900/50 border border-purple-300 dark:border-purple-700 text-purple-700 dark:text-purple-300 font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <HelpCircle className="w-4 h-4" />
                              Request Revaluation
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Your assignment is dynamically generated based on your current cognitive progress. Write code, test using the integrated compiler, and submit for faculty review.
                        </p>
                        <button
                          onClick={() => navigate(`/task/${activeModule.id}`)}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 hover:opacity-95 transition flex items-center gap-2 cursor-pointer"
                        >
                          <Code2 className="w-4 h-4" />
                          Open Task & Coding Workbench
                        </button>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Peer Learning System Hub for this Module */}
              <div 
                className={`rounded-3xl p-6 border shadow-lg backdrop-blur-md space-y-4 ${
                  isLight ? 'border-white/60 text-slate-900' : 'border-slate-800 bg-slate-900/60 text-white'
                }`}
                style={{ background: isLight ? 'rgba(255, 255, 255, 0.75)' : undefined }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className={`font-bold text-sm flex items-center gap-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      <MessageSquare className="w-4 h-4 text-purple-600" />
                      Peer Learning System (Collaborative Support)
                    </h3>
                    <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
                      Raise query (-20 coins) • Answer a peer • Get acknowledged (+30 coins!)
                    </p>
                  </div>

                  <button
                    onClick={() => setShowAskModal(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs flex items-center gap-1.5 transition cursor-pointer shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Ask Peers (-20 Coins)
                  </button>
                </div>

                {/* Queries List */}
                <div className="space-y-3">
                  {peerQueries.length === 0 ? (
                    <p className="text-xs text-slate-500 py-3 text-center">
                      No peer queries for this module yet. Be the first to ask or help a classmate!
                    </p>
                  ) : (
                    peerQueries.map((q) => (
                      <div key={q.query_id} className={`p-4 rounded-2xl border space-y-3 ${
                        isLight ? 'bg-white/80 border-slate-200 text-slate-800' : 'bg-slate-950/80 border-slate-800 text-slate-200'
                      }`}>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`font-bold ${isLight ? 'text-blue-700' : 'text-cyan-300'}`}>{q.inquirer_name}</span>
                          <span className="text-[10px] uppercase font-bold text-slate-500">{q.status}</span>
                        </div>
                        <p className={`text-xs ${isLight ? 'text-slate-700' : 'text-slate-200'}`}>{q.query_text}</p>

                        {/* Answers */}
                        {q.answers.length > 0 && (
                          <div className={`space-y-2 border-t pt-2 pl-3 ${isLight ? 'border-slate-200' : 'border-slate-800'}`}>
                            {q.answers.map((a) => (
                              <div key={a.answer_id} className={`p-2.5 rounded-xl border flex items-start justify-between gap-3 text-xs ${
                                isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900/80 border-slate-800/80 text-slate-300'
                              }`}>
                                <div>
                                  <span className={`font-semibold text-[11px] ${isLight ? 'text-emerald-700' : 'text-emerald-400'}`}>{a.helper_name}: </span>
                                  <span>{a.answer_text}</span>
                                </div>
                                {q.inquirer_id === user?.id && !a.is_acknowledged && (
                                  <button
                                    onClick={() => handleAcknowledge(a.answer_id)}
                                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shrink-0 cursor-pointer shadow"
                                    title="Acknowledge this answer to reward helper with 30 coins"
                                  >
                                    Acknowledge (+30 Coins)
                                  </button>
                                )}
                                {a.is_acknowledged && (
                                  <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1 shrink-0">
                                    <CheckCircle className="w-3 h-3" /> Acknowledged
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply box */}
                        {q.inquirer_id !== user?.id && (
                          <div className="flex gap-2 pt-1">
                            <input
                              type="text"
                              value={replyText[q.query_id] || ''}
                              onChange={(e) => setReplyText({ ...replyText, [q.query_id]: e.target.value })}
                              placeholder="Write a helpful explanation..."
                              className={`flex-1 rounded-xl px-3 py-1.5 text-xs border focus:outline-none focus:border-purple-500 ${
                                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-200'
                              }`}
                            />
                            <button
                              onClick={() => handlePostAnswer(q.query_id)}
                              className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs cursor-pointer shadow"
                            >
                              Reply
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 text-slate-500 text-xs">
              Select a module from the left to view lessons and assessments.
            </div>
          )}
        </div>
      </div>

      {/* Ask Question Modal */}
      {showAskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className={`w-full max-w-md rounded-3xl p-6 shadow-2xl border ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <h3 className="font-bold text-base mb-1">Raise a Peer Query</h3>
            <p className="text-xs text-slate-500 mb-4">
              Posting a query costs <span className="text-amber-500 font-bold">20 coins</span> from your balance.
            </p>

            <form onSubmit={handlePostQuery} className="space-y-4">
              <textarea
                required
                rows={4}
                value={newQueryText}
                onChange={(e) => setNewQueryText(e.target.value)}
                placeholder="What concept or code problem do you need help with?"
                className={`w-full rounded-xl p-3 text-xs border focus:outline-none focus:border-purple-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-800 text-slate-200'
                }`}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAskModal(false)}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                    isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-xs font-semibold shadow hover:opacity-95 cursor-pointer"
                >
                  Post Query (-20 Coins)
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MYSTERY BOX MODAL (ACCESSIBLE VIA TOP BAR FOR MENTORS & PIONEERS) */}
      {showMysteryModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-3xl p-6 sm:p-8 border shadow-2xl relative ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <button
              onClick={() => setShowMysteryModal(false)}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center space-y-4">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shadow-lg">
                <img
                  src={activeTheme.icons.mystery || activeTheme.icons.coins}
                  alt="Mystery Box"
                  className="w-12 h-12 object-contain drop-shadow"
                />
              </div>

              <div>
                <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                  {user?.pt_ls || 'Explorer'} Archetype Vault
                </span>
                <h3 className="text-xl font-black mt-2">Mystery Box Secrets</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Hidden bonus resources, curated reference links, and secret documents.
                </p>
              </div>

              {/* Single Condition Rule */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 text-left">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs shrink-0">
                    {progress?.quiz_passed ? '✓' : '🔒'}
                  </span>
                  <p className="font-bold text-xs text-slate-800 dark:text-slate-200">
                    Complete module quizzes with 80%+ score
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Pass your module adaptive quiz to open that module's Mystery Box and inspect secret study links.
                </p>
              </div>

              {/* Show Unlocked Contents if Passed */}
              {isMysteryUnlocked && mysteryMaterials.length > 0 && (
                <div className="space-y-2 text-left pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                    <span>🎉</span> Unlocked Secret Materials ({activeModule?.concept_name}):
                  </h4>
                  {mysteryMaterials.map((mat) => (
                    <div key={mat.id} className="p-3 rounded-xl border bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-xs">
                      <p className="font-bold">{mat.title}</p>
                      {mat.pdf_url && (
                        <a
                          href={mat.pdf_url.startsWith('http') ? mat.pdf_url : `/${mat.pdf_url.replace(/^\/+/, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-cyan-400 hover:underline"
                        >
                          <span>Open Secret Drive / Document</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

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

      {/* REWARDS VAULT MODAL (FOR PIONEERS) */}
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
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Jogger Trailblazer</h4>
                      <p className="text-[10px] text-slate-500">Accelerated pace milestone</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-amber-600 dark:text-amber-400 bg-white/80 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800">
                    +250 Coins
                  </span>
                </div>

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
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">Glider Apex Legend</h4>
                      <p className="text-[10px] text-slate-500">Mastery cognitive flight</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-purple-600 dark:text-purple-400 bg-white/80 dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800">
                    +500 Coins
                  </span>
                </div>
              </div>

              <button
                onClick={() => setShowRewardsModal(false)}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs transition cursor-pointer shadow-md"
              >
                Close Rewards Vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STUDENT TASK REVALUATION REQUEST MODAL */}
      {showRevalModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className={`w-full max-w-lg rounded-3xl p-6 sm:p-8 border shadow-2xl relative ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <button
              onClick={() => { setShowRevalModal(false); setRevalReason(''); setRevalMsg(''); }}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
              ✕
            </button>

            <h3 className="text-xl font-black mb-1">Request Task Mark Revaluation</h3>
            <p className="text-xs text-slate-500 mb-4">
              Appeal your assignment evaluation to your instructor for a second review.
            </p>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs mb-4 flex items-center justify-between">
              <div>
                <span className="font-bold text-slate-700 dark:text-slate-300 block">{activeModule?.concept_name}</span>
                <span className="text-[11px] text-slate-400">Current Awarded Score:</span>
              </div>
              <span className="text-sm font-black text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-3 py-1 rounded-xl border border-purple-200 dark:border-purple-800">
                {progress?.task_score} marks
              </span>
            </div>

            <form onSubmit={handleRequestRevaluation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">
                  Reason for Revaluation Appeal <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Explain why your code or answer deserves an increased mark (e.g., covered specific edge cases, output matched problem requirements)..."
                  value={revalReason}
                  onChange={(e) => setRevalReason(e.target.value)}
                  className={`w-full p-3 rounded-2xl border text-xs focus:outline-none focus:border-purple-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-slate-950 border-slate-700 text-white'
                  }`}
                />
              </div>

              {revalMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  <span>{revalMsg}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowRevalModal(false); setRevalReason(''); setRevalMsg(''); }}
                  className="flex-1 py-3 rounded-xl border font-bold text-xs hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReval || !revalReason.trim()}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-md transition"
                >
                  {submittingReval ? 'Sending Appeal...' : 'Submit Revaluation Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

