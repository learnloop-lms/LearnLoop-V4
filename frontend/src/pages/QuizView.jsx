import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeToggle } from '../context/ThemeContext';
import { useVisionaryFeedback } from '../context/VisionaryFeedbackContext';
import { 
  ArrowLeft, Clock, Zap, Heart, Coins, 
  HelpCircle, Sparkles, CheckCircle2, XCircle, AlertCircle, ArrowRight,
  ShieldAlert, Maximize2, Minimize2, Lock, ShieldCheck
} from 'lucide-react';
import ElementRatingModal from '../components/ElementRatingModal';
import AppreciationModal from '../components/AppreciationModal';

export default function QuizView() {
  const { moduleId } = useParams();
  const { user, activeTheme, API_BASE, fetchProfile } = useAuth();
  const { isLight } = useTheme();
  const { triggerFeedback } = useVisionaryFeedback();
  const [quizData, setQuizData] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { qId: option }
  const [eliminatedOptions, setEliminatedOptions] = useState({}); // { qId: ['B', 'C'] }
  const [doubleDipActive, setDoubleDipActive] = useState({}); // { qId: true }
  const [hints, setHints] = useState({}); // { qId: hintText }
  const [secondsRemaining, setSecondsRemaining] = useState(600); // 10 minutes default
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [toastMsg, setToastMsg] = useState(null); // { message, type }

  // Appreciation Animation Modal (Happy & Sad)
  const [showAppreciation, setShowAppreciation] = useState(false);
  const [appreciationType, setAppreciationType] = useState('happy'); // 'happy' or 'sad'

  // Game Zone Anti-Cheat Lockdown State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [showStrikeWarning, setShowStrikeWarning] = useState(false);

  const navigate = useNavigate();

  const showToast = (message, type = 'success') => {
    setToastMsg({ message, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  useEffect(() => {
    fetchQuiz();
    // Auto-enter Game Zone Fullscreen upon entering quiz arena
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    return () => {
      // Exit fullscreen automatically upon leaving quiz
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [moduleId]);

  // Countdown timer
  useEffect(() => {
    if (submissionResult) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [quizData, answers, submissionResult]);

  // Anti-Cheat & Game Zone Arena Monitor
  useEffect(() => {
    if (submissionResult) return;

    // Block keyboard copy/cut/paste/devtools shortcuts
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x', 'a', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        setShowStrikeWarning(true);
        return false;
      }
      if (e.key === 'F12') {
        e.preventDefault();
        setShowStrikeWarning(true);
        return false;
      }
    };

    // Block clipboard events
    const handleCopy = (e) => { e.preventDefault(); setShowStrikeWarning(true); };
    const handleCut = (e) => { e.preventDefault(); setShowStrikeWarning(true); };
    const handlePaste = (e) => { e.preventDefault(); setShowStrikeWarning(true); };
    const handleContextMenu = (e) => { e.preventDefault(); };

    // Genuine Tab switch detection (Alt+Tab, Windows key, new tab, switching away)
    const handleVisibilityChange = () => {
      if (document.hidden && !submissionResult) {
        setStrikes((prev) => prev + 1);
        setShowStrikeWarning(true);
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('copy', handleCopy);
    window.addEventListener('cut', handleCut);
    window.addEventListener('paste', handlePaste);
    window.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('copy', handleCopy);
      window.removeEventListener('cut', handleCut);
      window.removeEventListener('paste', handlePaste);
      window.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [submissionResult]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const fetchQuiz = async () => {
    try {
      const res = await axios.get(`${API_BASE}/quizzes/module/${moduleId}`);
      setQuizData(res.data);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to load quiz.', 'error');
      navigate(-1);
    }
  };

  const currentQ = quizData?.questions[currentIdx];

  const handleSelectOption = (opt) => {
    if (eliminatedOptions[currentQ.id]?.includes(opt)) return;

    if (doubleDipActive[currentQ.id]) {
      // Allow multi-selection for double dip
      const existing = answers[currentQ.id] || '';
      if (!existing) {
        setAnswers({ ...answers, [currentQ.id]: opt });
      } else if (!existing.includes(opt)) {
        setAnswers({ ...answers, [currentQ.id]: `${existing},${opt}` });
      }
    } else {
      setAnswers({ ...answers, [currentQ.id]: opt });
    }
  };

  const handleUseLifeline = async (type) => {
    try {
      const res = await axios.post(`${API_BASE}/quizzes/lifelines/use`, {
        lifeline_type: type,
        question_id: currentQ.id,
        module_id: moduleId
      });

      if (type === '50_50' && res.data.eliminated_options) {
        setEliminatedOptions({
          ...eliminatedOptions,
          [currentQ.id]: res.data.eliminated_options
        });
      } else if (type === 'double_dip') {
        setDoubleDipActive({ ...doubleDipActive, [currentQ.id]: true });
      } else if (type === 'hint') {
        setHints({ ...hints, [currentQ.id]: res.data.hint });
      } else if (type === 'extra_time') {
        setSecondsRemaining((prev) => prev + res.data.additional_seconds);
      } else if (type === 'swap' && res.data.new_question) {
        const updated = [...quizData.questions];
        updated[currentIdx] = res.data.new_question;
        setQuizData({ ...quizData, questions: updated });
      }

      await fetchProfile();
      showToast(res.data.message || 'Lifeline activated!', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Cannot use lifeline.', 'error');
    }
  };

  const handleSubmitQuiz = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const formatted = (quizData?.questions || []).map((q) => ({
        question_id: q.id,
        chosen_option: (answers[q.id] || '').split(',')[0] || (answers[q.id] || ''),
        lifelines_used: []
      }));

      const res = await axios.post(`${API_BASE}/quizzes/submit`, {
        module_id: moduleId,
        answers: formatted,
        ttq_seconds: 600 - secondsRemaining
      });

      // Exit fullscreen automatically upon submission
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      setSubmissionResult(res.data);
      await fetchProfile();

      if (res.data.passed) {
        triggerFeedback('progress_forward', { course: quizData?.concept_name });
        setAppreciationType('happy');
        setShowAppreciation(true);
      } else {
        triggerFeedback('progress_backward', { course: quizData?.concept_name });
        setAppreciationType('sad');
        setShowAppreciation(true);
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to submit quiz.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAppreciationClose = () => {
    setShowAppreciation(false);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    if (appreciationType === 'happy') {
      navigate(`/task/${moduleId}`);
    } else {
      const courseTarget = quizData?.course_id || '';
      navigate(courseTarget ? `/course/${courseTarget}?module=${moduleId}&step=material` : -1);
    }
  };

  if (!quizData) {
    return (
      <div className={`min-h-screen flex items-center justify-center text-xs ${
        isLight ? 'bg-slate-50 text-slate-500' : 'bg-slate-950 text-slate-400'
      }`}>
        Loading personalized quiz challenge...
      </div>
    );
  }

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
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
      {/* Top Header */}
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
            <h1 className={`font-bold text-sm ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {quizData.concept_name} Quiz
            </h1>
            <p className="text-[11px] text-slate-500">
              Question {currentIdx + 1} of {quizData.total_questions} • Tier:{' '}
              <span className="font-bold text-amber-500 capitalize">{quizData.student_cognitive_level}</span>
            </p>
          </div>
        </div>

        {/* Game Zone HUD, Timer, Lifelines & ThemeToggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Game Zone Arena Badge */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/30 text-[11px] font-black uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-purple-500 animate-ping" />
            <span>Game Zone Arena</span>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
              isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            title="Toggle Game Zone Fullscreen Lockdown"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            <span className="hidden md:inline">{isFullscreen ? 'Exit Arena' : 'Fullscreen'}</span>
          </button>

          {/* Strikes Counter (if any warning triggered) */}
          {strikes > 0 && (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-red-500/20 text-red-500 border border-red-500/40 text-xs font-black animate-pulse">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{strikes}/3 Strikes</span>
            </div>
          )}

          <div className={`flex items-center gap-2 border px-3 py-1.5 rounded-xl font-mono text-xs font-bold ${
            isLight ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-900 border-slate-800 text-cyan-300'
          }`}>
            <Clock className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-cyan-400'}`} />
            {formatTime(secondsRemaining)}
          </div>

          <div className={`flex items-center gap-3 border px-3 py-1 rounded-xl ${
            isLight ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/90 border-slate-800'
          }`}>
            <div className="flex items-center gap-1 text-xs">
              <img src={activeTheme.icons.hearts} alt="Hearts" className="w-5 h-5 object-contain" />
              <span className="font-bold text-red-500">{user?.hearts ?? 5}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <img src={activeTheme.icons.coins} alt="Coins" className="w-5 h-5 object-contain" />
              <span className="font-bold text-amber-600 dark:text-amber-300">{user?.total_coins ?? 0}</span>
            </div>
          </div>

          <ThemeToggle />
        </div>
      </header>

      {/* Main Container (Select-None & Anti-Cheat Protected) */}
      <div 
        className="flex-1 max-w-4xl mx-auto w-full p-4 md:p-8 flex flex-col justify-between select-none"
        onCopy={(e) => e.preventDefault()}
        onCut={(e) => e.preventDefault()}
        onPaste={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        
        {/* Lifelines Toolbar (Strictly within Quiz) */}
        {!submissionResult && (
          <div className={`border rounded-2xl p-3 mb-6 flex flex-wrap items-center justify-between gap-2 shadow-sm ${
            isLight ? 'bg-white/75 backdrop-blur-md border-white/60' : 'bg-slate-900/80 border-slate-800 shadow-xl'
          }`}>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}>
              Lifelines:
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleUseLifeline('50_50')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                  isLight 
                    ? 'bg-slate-50 border-slate-200 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-300' 
                    : 'bg-slate-950 border-slate-800 text-cyan-300 hover:border-cyan-500/50'
                }`}
                title="Eliminate two incorrect options"
              >
                <img src={activeTheme.icons.fifty_fifty} alt="50:50" className="w-5 h-5 object-contain" />
                <span>50:50 ({user?.free_fifty_fifty || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => handleUseLifeline('double_dip')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                  isLight 
                    ? 'bg-slate-50 border-slate-200 text-purple-700 hover:bg-purple-50 hover:border-purple-300' 
                    : 'bg-slate-950 border-slate-800 text-purple-300 hover:border-purple-500/50'
                }`}
                title="Select two options for this question"
              >
                <img src={activeTheme.icons.double_dip} alt="Double Dip" className="w-5 h-5 object-contain" />
                <span>Double Dip ({user?.free_double_dips || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => handleUseLifeline('swap')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                  isLight 
                    ? 'bg-slate-50 border-slate-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300' 
                    : 'bg-slate-950 border-slate-800 text-emerald-300 hover:border-emerald-500/50'
                }`}
                title="Swap with another question of equal difficulty"
              >
                <img src={activeTheme.icons.swap} alt="Swap" className="w-5 h-5 object-contain" />
                <span>Swap ({user?.free_swaps || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => handleUseLifeline('hint')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                  isLight 
                    ? 'bg-slate-50 border-slate-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300' 
                    : 'bg-slate-950 border-slate-800 text-amber-300 hover:border-amber-500/50'
                }`}
                title="Reveal question hint"
              >
                <img src={activeTheme.icons.hints} alt="Hint" className="w-5 h-5 object-contain" />
                <span>Hint ({user?.free_hints || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => handleUseLifeline('extra_time')}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-xs ${
                  isLight 
                    ? 'bg-slate-50 border-slate-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300' 
                    : 'bg-slate-950 border-slate-800 text-blue-300 hover:border-blue-500/50'
                }`}
                title="+1 Minute Time"
              >
                <img src={activeTheme.icons.extra_time} alt="Extra Time" className="w-5 h-5 object-contain" />
                <span>+1 Min ({user?.free_extra_time || 0})</span>
              </button>
            </div>
          </div>
        )}

        {/* Question Body */}
        {!submissionResult && currentQ && (
          <div 
            className={`rounded-3xl p-6 md:p-8 border backdrop-blur-md mb-6 space-y-6 flex-1 flex flex-col justify-between ${
              isLight ? 'bg-white/78 border-white/60 shadow-lg' : 'border-slate-800 shadow-2xl'
            }`}
            style={{ background: isLight ? 'rgba(255, 255, 255, 0.78)' : activeTheme.cardBg }}
          >
            <div>
              <div className="flex items-center justify-between text-xs mb-4">
                <span className={`font-semibold uppercase tracking-widest text-[10px] ${
                  isLight ? 'text-blue-600' : 'text-cyan-400'
                }`}>
                  Bloom's Taxonomy: {currentQ.blooms_level}
                </span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                  isLight ? 'bg-slate-100 text-slate-700 border border-slate-200' : 'bg-slate-800 text-slate-300'
                }`}>
                  {currentQ.cognitive_level} Tier
                </span>
              </div>

              {/* Question Text with Match Formatting and Monospace Code Blocks */}
              <div className="mb-6">
                {(() => {
                  const qText = currentQ.question_text || '';
                  
                  // Match the Following Parser (List - I and List - II)
                  const isMatchFormat = 
                    (qText.includes('List - I') || qText.includes('List I') || qText.includes('Column A') || qText.includes('Column - I')) &&
                    (qText.includes('List - II') || qText.includes('List II') || qText.includes('Column B') || qText.includes('Column - II'));

                  if (isMatchFormat) {
                    const lines = qText.split('\n').map((l) => l.trim()).filter(Boolean);
                    const introLines = [];
                    const colA = [];
                    const colB = [];
                    let activeList = null;

                    for (const line of lines) {
                      if (/^(List\s*-?\s*I\b|Column\s*-?\s*A\b)/i.test(line)) {
                        if (line.includes('\t') || /List\s*-?\s*II/i.test(line)) continue;
                        activeList = 'A';
                        continue;
                      }
                      if (/^(List\s*-?\s*II\b|Column\s*-?\s*B\b)/i.test(line)) {
                        activeList = 'B';
                        continue;
                      }

                      if (line.includes('\t')) {
                        const parts = line.split('\t').map((p) => p.trim()).filter(Boolean);
                        if (parts.length >= 2) {
                          colA.push(parts[0]);
                          colB.push(parts[1]);
                          continue;
                        }
                      }

                      if (activeList === 'A') colA.push(line);
                      else if (activeList === 'B') colB.push(line);
                      else introLines.push(line);
                    }

                    if (colA.length > 0 && colB.length > 0) {
                      return (
                        <div className="space-y-4">
                          {introLines.length > 0 && (
                            <h2 className={`text-base md:text-xl font-bold leading-relaxed ${isLight ? 'text-slate-900' : 'text-white'}`}>
                              {introLines.join(' ')}
                            </h2>
                          )}
                          <div className={`p-4 md:p-5 rounded-2xl border ${
                            isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/70 border-slate-800'
                          }`}>
                            <div className="grid grid-cols-2 gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 text-xs font-black uppercase tracking-wider">
                              <span className="text-blue-600 dark:text-cyan-400">List - I</span>
                              <span className="text-purple-600 dark:text-purple-400">List - II</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-3 text-xs md:text-sm font-mono">
                              <div className="space-y-2">
                                {colA.map((item, i) => (
                                  <div key={i} className={`p-2.5 rounded-xl border ${
                                    isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-200'
                                  }`}>
                                    {item}
                                  </div>
                                ))}
                              </div>
                              <div className="space-y-2">
                                {colB.map((item, i) => (
                                  <div key={i} className={`p-2.5 rounded-xl border ${
                                    isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-200'
                                  }`}>
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  }

                  // Code Snippet formatting for Programming Questions
                  const hasCode = 
                    qText.includes('```') || 
                    qText.includes('public class') || 
                    qText.includes('#include') || 
                    qText.includes('def ') || 
                    qText.includes('System.out.print') ||
                    (qText.includes('{\n') && qText.includes('}'));

                  if (hasCode) {
                    if (qText.includes('```')) {
                      const chunks = qText.split('```');
                      return (
                        <div className="space-y-3">
                          <h2 className={`text-base md:text-xl font-bold leading-relaxed whitespace-pre-wrap ${isLight ? 'text-slate-900' : 'text-white'}`}>
                            {chunks[0]}
                          </h2>
                          <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs md:text-sm overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                            <code>{chunks[1]}</code>
                          </pre>
                          {chunks[2] && (
                            <p className={`text-xs md:text-sm whitespace-pre-wrap ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                              {chunks[2]}
                            </p>
                          )}
                        </div>
                      );
                    } else {
                      const allLines = qText.split('\n');
                      const narr = [];
                      const snippet = [];
                      let inSnippet = false;

                      for (const ln of allLines) {
                        if (!inSnippet && (ln.includes('public class') || ln.includes('#include') || ln.includes('def ') || ln.includes('class ') || ln.includes('{'))) {
                          inSnippet = true;
                        }
                        if (inSnippet) snippet.push(ln);
                        else narr.push(ln);
                      }

                      if (snippet.length > 0) {
                        return (
                          <div className="space-y-3">
                            {narr.length > 0 && (
                              <h2 className={`text-base md:text-xl font-bold leading-relaxed whitespace-pre-wrap ${isLight ? 'text-slate-900' : 'text-white'}`}>
                                {narr.join('\n')}
                              </h2>
                            )}
                            <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-400 font-mono text-xs md:text-sm overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                              <code>{snippet.join('\n')}</code>
                            </pre>
                          </div>
                        );
                      }
                    }
                  }

                  // Default Multi-line Question with line-break preservation
                  return (
                    <h2 className={`text-base md:text-xl font-bold leading-relaxed whitespace-pre-wrap ${
                      isLight ? 'text-slate-900' : 'text-white'
                    }`}>
                      {qText}
                    </h2>
                  );
                })()}
              </div>

              {/* Revealed Hint */}
              {hints[currentQ.id] && (
                <div className={`p-3 mb-4 rounded-xl border text-xs flex items-center gap-2 ${
                  isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                }`}>
                  <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>Hint: {hints[currentQ.id]}</span>
                </div>
              )}

              {/* Options Rendering: Handles True/False (2 options), Fill in the Blanks (input), and MCQ/Match */}
              {(() => {
                const optA = (currentQ.option_a || '').trim();
                const optB = (currentQ.option_b || '').trim();
                const optC = (currentQ.option_c || '').trim();
                const optD = (currentQ.option_d || '').trim();

                // True / False Question Detection
                const isTrueFalse = 
                  (optA.toLowerCase() === 'true' && optB.toLowerCase() === 'false') ||
                  (optA.toLowerCase() === 'false' && optB.toLowerCase() === 'true') ||
                  (
                    (!optC || optC.toLowerCase() === 'option c' || optC === '-') &&
                    (!optD || optD.toLowerCase() === 'option d' || optD === '-') &&
                    (optA.toLowerCase() === 'true' || optB.toLowerCase() === 'false' || currentQ.question_text?.toLowerCase().includes('[true/false]') || currentQ.question_text?.toLowerCase().startsWith('true or false'))
                  );

                // Fill in the Blank Question Detection
                const isFillBlank = 
                  currentQ.question_text?.includes('___') ||
                  currentQ.question_text?.toLowerCase().includes('[blank]') ||
                  (currentQ.question_text?.toLowerCase().includes('fill in the blank') && (!optB || optB === '-' || optB.toLowerCase() === 'option b')) ||
                  (!optB && !optC && !optD && !isTrueFalse);

                // 1. FILL IN THE BLANKS: Text Box Input
                if (isFillBlank) {
                  return (
                    <div className="p-5 rounded-2xl border bg-slate-50/60 dark:bg-slate-900/60 border-blue-200 dark:border-blue-900/60 space-y-3">
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                        Type your answer in the blank space below:
                      </label>
                      <input
                        type="text"
                        autoFocus
                        placeholder="Type your answer here..."
                        value={answers[currentQ.id] || ''}
                        onChange={(e) => setAnswers({ ...answers, [currentQ.id]: e.target.value })}
                        className="w-full p-4 rounded-xl border text-sm font-semibold bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
                      />
                      <p className="text-[11px] text-slate-500 italic">
                        Tip: Answers are evaluated case-insensitively (all letters are automatically matched).
                      </p>
                    </div>
                  );
                }

                // 2. TRUE OR FALSE: Display EXACTLY 2 Options
                if (isTrueFalse) {
                  const tfOptions = [
                    { key: 'A', text: 'True' },
                    { key: 'B', text: 'False' }
                  ];

                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl mx-auto">
                      {tfOptions.map((opt) => {
                        const isEliminated = eliminatedOptions[currentQ.id]?.includes(opt.key);
                        const isSelected = answers[currentQ.id] === opt.key;

                        return (
                          <button
                            key={opt.key}
                            disabled={isEliminated}
                            onClick={() => handleSelectOption(opt.key)}
                            className={`p-5 rounded-2xl border text-center text-sm font-bold transition flex items-center justify-center gap-3 cursor-pointer shadow-sm ${
                              isEliminated
                                ? 'opacity-30 line-through bg-slate-100 border-slate-200 cursor-not-allowed'
                                : isSelected
                                ? isLight
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20 scale-[1.02]'
                                  : 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                                : isLight
                                ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-800'
                                : 'bg-slate-950/80 border-slate-800 text-slate-200 hover:border-slate-700'
                            }`}
                          >
                            <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                              {opt.key}
                            </span>
                            <span className="text-base">{opt.text}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                }

                // 3. STANDARD MCQ / MATCH THE FOLLOWING
                const rawOpts = [
                  { key: 'A', text: optA },
                  { key: 'B', text: optB },
                  { key: 'C', text: optC },
                  { key: 'D', text: optD }
                ];
                // Filter out empty or dummy placeholder options if fewer than 4 were specified
                const validOpts = rawOpts.filter((o, idx) => {
                  if (idx >= 2 && (!o.text || o.text === '-' || o.text.toLowerCase() === `option ${o.key.toLowerCase()}`)) {
                    return false;
                  }
                  return Boolean(o.text);
                });

                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {validOpts.map((opt) => {
                      const isEliminated = eliminatedOptions[currentQ.id]?.includes(opt.key);
                      const isSelected = answers[currentQ.id]?.includes(opt.key);

                      return (
                        <button
                          key={opt.key}
                          disabled={isEliminated}
                          onClick={() => handleSelectOption(opt.key)}
                          className={`p-4 rounded-2xl border text-left text-xs transition flex items-start gap-3 cursor-pointer ${
                            isEliminated
                              ? isLight
                                ? 'opacity-30 line-through bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                                : 'opacity-30 line-through bg-slate-950/40 border-slate-900 cursor-not-allowed'
                              : isSelected
                              ? isLight
                                ? 'bg-blue-50 border-blue-500 text-blue-950 font-bold shadow-md shadow-blue-500/10'
                                : 'bg-gradient-to-r from-cyan-600/40 to-indigo-600/40 border-cyan-400 text-white font-bold shadow-lg shadow-cyan-500/10'
                              : isLight
                              ? 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-800'
                              : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isSelected 
                              ? 'bg-blue-600 text-white' 
                              : isLight
                              ? 'bg-slate-200 text-slate-700'
                              : 'bg-slate-800 text-slate-400'
                          }`}>
                            {opt.key}
                          </span>
                          <span className="flex-1 mt-0.5 leading-relaxed">{opt.text}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Navigation Buttons */}
            <div className={`flex items-center justify-between pt-6 border-t ${
              isLight ? 'border-slate-200' : 'border-slate-800/80'
            }`}>
              <button
                type="button"
                disabled={currentIdx === 0}
                onClick={() => setCurrentIdx((prev) => prev - 1)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40 cursor-pointer border ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                Previous
              </button>

              <div className="flex gap-1.5">
                {quizData.questions.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentIdx(i)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                      currentIdx === i
                        ? 'bg-blue-600 text-white'
                        : answers[quizData.questions[i].id]
                        ? 'bg-emerald-600 text-white'
                        : isLight
                        ? 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>

              {currentIdx < quizData.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIdx((prev) => prev + 1)}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition shadow-xs"
                >
                  Next
                </button>
              ) : (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleSubmitQuiz}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Quiz'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quiz Submission Result Modal */}
        {submissionResult && (
          <div 
            className={`rounded-3xl p-8 border text-center space-y-6 ${
              isLight ? 'bg-white/95 border-slate-200 shadow-xl' : 'border-slate-800 shadow-2xl backdrop-blur-xl'
            }`}
            style={{ background: isLight ? '#ffffff' : activeTheme.cardBg }}
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
              <Sparkles className="w-8 h-8" />
            </div>

            <h2 className={`text-2xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
              Quiz Evaluation Complete!
            </h2>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-lg mx-auto">
              <div className={`p-4 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
              }`}>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Score</span>
                <p className={`text-2xl font-black ${isLight ? 'text-blue-700' : 'text-cyan-300'}`}>
                  {submissionResult.msq_score} / {submissionResult.total_questions}
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
              }`}>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Accuracy</span>
                <p className={`text-2xl font-black ${isLight ? 'text-emerald-700' : 'text-emerald-300'}`}>
                  {Math.round(submissionResult.accuracy * 100)}%
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
              }`}>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Status</span>
                <p className={`text-base font-bold mt-1 ${submissionResult.passed ? 'text-emerald-600' : 'text-amber-600'}`}>
                  {submissionResult.passed ? 'PASSED' : 'RETRY NEEDED'}
                </p>
              </div>

              <div className={`p-4 rounded-2xl border ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
              }`}>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Mistake HIT</span>
                <p className={`text-xs font-bold mt-2 capitalize ${isLight ? 'text-purple-700' : 'text-purple-300'}`}>
                  {submissionResult.mistake_category_hit} Tier
                </p>
              </div>
            </div>

            {/* Visionary Detailed Feedback Explanations */}
            {submissionResult.explanation_map && (
              <div className={`text-left border rounded-2xl p-5 space-y-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/80 border-slate-800'
              }`}>
                <h4 className={`font-bold text-xs uppercase tracking-wider flex items-center gap-1.5 ${
                  isLight ? 'text-blue-700' : 'text-cyan-400'
                }`}>
                  <Sparkles className="w-4 h-4" /> Visionary Feedback Engine (Active)
                </h4>
                <div className="space-y-2 text-xs">
                  {Object.entries(submissionResult.explanation_map).map(([qId, exp]) => (
                    <div key={qId} className={`p-2.5 rounded-xl border ${
                      isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}>
                      <p className="font-medium">{exp}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col items-center justify-center gap-3 pt-4">
              {submissionResult.passed ? (
                <>
                  <button
                    onClick={() => navigate(`/task/${moduleId}`)}
                    className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:opacity-95 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 cursor-pointer flex items-center gap-2"
                  >
                    <span>Proceed to Coding & Task Challenge</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => navigate(`/course/${quizData.course_id || ''}?module=${moduleId}&step=material`)}
                  className="px-8 py-3.5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-lg cursor-pointer flex items-center gap-2"
                >
                  Review Study Material & Retry Quiz
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* IN-APP LIFELINE & ACTION TOAST NOTIFICATION (Does not steal focus) */}
      {toastMsg && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none">
          <div className={`px-5 py-3 rounded-2xl shadow-2xl border text-xs font-black flex items-center gap-2.5 backdrop-blur-md ${
            toastMsg.type === 'error'
              ? 'bg-red-500/90 border-red-400 text-white shadow-red-500/30'
              : 'bg-emerald-500/95 border-emerald-300 text-white shadow-emerald-500/30'
          }`}>
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>{toastMsg.message}</span>
          </div>
        </div>
      )}

      {/* GAME ZONE ANTI-CHEAT LOCKDOWN ALERT MODAL */}
      {showStrikeWarning && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl p-6 md:p-8 border border-red-500/40 bg-slate-950 text-white shadow-2xl text-center space-y-4 relative">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-red-400 animate-bounce" />
            </div>

            <h3 className="text-xl font-black text-red-400 tracking-tight">
              Game Zone Lockdown Alert!
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Focus loss, tab switching, or shortcut key detected. While the quiz is in session, your screen is restricted to prevent copy/pasting questions.
            </p>

            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/80 text-xs font-bold text-red-300 flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-red-400" />
              <span>Integrity Warning Recorded: {strikes} of 3</span>
            </div>

            <button
              onClick={() => {
                setShowStrikeWarning(false);
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen().catch(() => {});
                }
              }}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs cursor-pointer shadow-lg shadow-red-500/25 transition"
            >
              Return to Quiz Arena
            </button>
          </div>
        </div>
      )}

      {/* APPRECIATION ANIMATION MODAL (HAPPY OR SAD) */}
      <AppreciationModal
        isOpen={showAppreciation}
        onClose={handleAppreciationClose}
        type={appreciationType}
        title={appreciationType === 'happy' ? "Quiz Challenge Passed!" : "Quiz Needs Revision"}
        subtitle={
          appreciationType === 'happy'
            ? `Sensational mastery! You scored ${submissionResult?.score ?? (submissionResult?.msq_score ?? 10)}/10 and passed the threshold. Stage 3 Task is unlocked!`
            : `You scored ${submissionResult?.score ?? (submissionResult?.msq_score ?? 0)}/10 (Threshold: 80%). Review the module study materials and re-attempt the quiz!`
        }
        coinsAwarded={appreciationType === 'happy' ? (submissionResult?.coins_earned || 25) : 0}
        archetype={user?.pt_ls || 'Pioneers'}
        buttonText={appreciationType === 'happy' ? "Proceed to Task & Assignment" : "Review Study Material & Retry"}
      />

      {/* Element Rating Modal */}
      {showRatingModal && (
        <ElementRatingModal
          moduleId={moduleId}
          onClose={() => {
            setShowRatingModal(false);
            navigate(-1);
          }}
        />
      )}
    </div>
  );
}
