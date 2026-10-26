import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeToggle } from '../context/ThemeContext';
import { useVisionaryFeedback } from '../context/VisionaryFeedbackContext';
import { 
  ArrowLeft, Play, Send, Terminal, Code2, 
  FileText, CheckCircle, AlertCircle, RefreshCw,
  Maximize2, Minimize2, ShieldAlert, ShieldCheck, Zap,
  Users, GraduationCap, Sparkles, CheckCircle2, X, HelpCircle
} from 'lucide-react';
import ElementRatingModal from '../components/ElementRatingModal';
import AppreciationModal from '../components/AppreciationModal';

export default function TaskView() {
  const { moduleId } = useParams();
  const { user, activeTheme, API_BASE } = useAuth();
  const { isLight } = useTheme();
  const { triggerFeedback } = useVisionaryFeedback();
  const [taskData, setTaskData] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [descriptiveText, setDescriptiveText] = useState('');
  const [running, setRunning] = useState(false);
  const [runOutput, setRunOutput] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showTaskAppreciation, setShowTaskAppreciation] = useState(false);

  // Pre-Submission Health Check Diagnostics
  const [showPreCheckModal, setShowPreCheckModal] = useState(false);
  const [preChecking, setPreChecking] = useState(false);
  const [preCheckData, setPreCheckData] = useState(null);

  // Instant Evaluation Results Modal
  const [showEvalResultModal, setShowEvalResultModal] = useState(false);
  const [evalResult, setEvalResult] = useState(null);

  // Task Lifelines
  const [swapping, setSwapping] = useState(false);

  // Ask Peers Modal (2 text boxes: bold heading + description)
  const [showPeerModal, setShowPeerModal] = useState(false);
  const [peerHeading, setPeerHeading] = useState('');
  const [peerDescription, setPeerDescription] = useState('');
  const [postingPeer, setPostingPeer] = useState(false);

  // Ask the Expert Modal (auto attaches code snapshot)
  const [showExpertModal, setShowExpertModal] = useState(false);
  const [expertHeading, setExpertHeading] = useState('');
  const [expertQuery, setExpertQuery] = useState('');
  const [postingExpert, setPostingExpert] = useState(false);

  // Game Zone Anti-Cheat Lockdown State
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [showStrikeWarning, setShowStrikeWarning] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchTask();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, [moduleId]);

  // Anti-Cheat & Game Zone Arena Tab Switch Monitor
  useEffect(() => {
    if (submitted) return;

    const handleVisibilityChange = () => {
      if (document.hidden && !submitted) {
        setStrikes((prev) => prev + 1);
        setShowStrikeWarning(true);
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [submitted]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  };

  const fetchTask = async () => {
    try {
      const res = await axios.get(`${API_BASE}/tasks/module/${moduleId}`);
      setTaskData(res.data);
      if (res.data.allowed_compilers && res.data.allowed_compilers.length > 0) {
        const defaultLang = res.data.allowed_compilers.includes('python') ? 'python' : res.data.allowed_compilers[0];
        setSelectedLanguage(defaultLang);
        if (res.data.starter_code) {
          const starter = typeof res.data.starter_code === 'string'
            ? res.data.starter_code
            : (res.data.starter_code[defaultLang] || res.data.starter_code.default || '');
          if (starter) setCode(starter);
        }
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'No task challenges available for this module yet.');
      navigate(-1);
    }
  };

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang);
    if (taskData?.starter_code) {
      const starter = typeof taskData.starter_code === 'string'
        ? taskData.starter_code
        : (taskData.starter_code[lang] || taskData.starter_code.default || '');
      setCode(starter);
    } else {
      setCode('');
    }
    setRunOutput(null);
  };

  const handleRunCode = async () => {
    setRunning(true);
    setRunOutput(null);
    try {
      const res = await axios.post(`${API_BASE}/tasks/run-code`, {
        language: selectedLanguage,
        code: code
      });
      setRunOutput(res.data);
      if (res.data?.success) {
        triggerFeedback('progress_forward', { course: taskData?.title });
      } else {
        triggerFeedback('progress_backward', { course: taskData?.title });
      }
    } catch (err) {
      setRunOutput({
        success: false,
        output: '',
        error: err.response?.data?.detail || 'Execution error.'
      });
      triggerFeedback('progress_backward', { course: taskData?.title });
    } finally {
      setRunning(false);
    }
  };

  // 1. Initial Submit Button Click: Pre-check diagnostic for programming, or direct submit for descriptive
  const handleInitiateSubmit = async () => {
    if (submitting || preChecking) return;

    if (taskData?.task_type === 'programming') {
      setPreChecking(true);
      try {
        const res = await axios.post(`${API_BASE}/tasks/pre-check`, {
          task_id: taskData.task_id,
          programming_language: selectedLanguage,
          code: code
        });
        setPreCheckData(res.data);
        setShowPreCheckModal(true);
      } catch (err) {
        alert(err.response?.data?.detail || 'Pre-check failed. Proceeding with submit.');
        handleFinalSubmit();
      } finally {
        setPreChecking(false);
      }
    } else {
      // Descriptive submission evaluates directly
      handleFinalSubmit();
    }
  };

  // 2. Final Submission with Automated Evaluation
  const handleFinalSubmit = async () => {
    if (submitting) return;
    setShowPreCheckModal(false);
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/tasks/submit`, {
        task_id: taskData.task_id,
        programming_language: taskData.task_type === 'programming' ? selectedLanguage : null,
        submitted_code: taskData.task_type === 'programming' ? code : null,
        submitted_text: taskData.task_type === 'descriptive' ? descriptiveText : null,
        compiler_output: runOutput?.output || ''
      });

      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }

      setSubmitted(true);
      setEvalResult(res.data);
      setShowEvalResultModal(true);
      triggerFeedback('progress_forward', { course: taskData?.title });
    } catch (err) {
      console.error('Task submission error:', err);
      alert(err.response?.data?.detail || err.message || 'Failed to submit task.');
    } finally {
      setSubmitting(false);
    }
  };

  // 3. Task Swap Lifeline
  const handleSwapTask = async () => {
    if (!window.confirm('Swap this task challenge with another question of equal difficulty? (2 free swaps, then costs 1 heart)')) {
      return;
    }
    setSwapping(true);
    try {
      const res = await axios.post(`${API_BASE}/tasks/swap`, {
        module_id: moduleId,
        current_task_id: taskData.task_id
      });
      alert(res.data.message);
      setTaskData((prev) => ({
        ...prev,
        task_id: res.data.task_id,
        title: res.data.title,
        complexity_qlc: res.data.complexity_qlc,
        task_type: res.data.task_type,
        problem_statement: res.data.problem_statement,
        starter_code: res.data.starter_code,
        max_marks: res.data.max_marks
      }));
      setCode('');
      setRunOutput(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Cannot swap task.');
    } finally {
      setSwapping(false);
    }
  };

  // 4. Post Query to Peer Board
  const handlePostPeerQuery = async (e) => {
    e.preventDefault();
    if (!peerHeading.trim() || !peerDescription.trim()) {
      alert('Please fill both the heading and description.');
      return;
    }
    setPostingPeer(true);
    try {
      await axios.post(`${API_BASE}/peer/query`, {
        module_id: moduleId,
        heading: peerHeading,
        query_text: peerDescription
      });
      alert('Your question has been posted to classmates on the peer board! (Deducted 20 coins)');
      setShowPeerModal(false);
      setPeerHeading('');
      setPeerDescription('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to post peer query.');
    } finally {
      setPostingPeer(false);
    }
  };

  // 5. Ask the Expert (Course Instructor)
  const handlePostExpertQuery = async (e) => {
    e.preventDefault();
    if (!expertHeading.trim() || !expertQuery.trim()) {
      alert('Please fill both heading and question.');
      return;
    }
    setPostingExpert(true);
    try {
      await axios.post(`${API_BASE}/tasks/expert-query`, {
        task_id: taskData.task_id,
        module_id: moduleId,
        heading: expertHeading,
        query_text: expertQuery,
        code_snapshot: code,
        compiler_output: runOutput?.output || ''
      });
      alert('Your query has been sent to the course instructor with your code diagnostic snapshot!');
      setShowExpertModal(false);
      setExpertHeading('');
      setExpertQuery('');
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to contact expert.');
    } finally {
      setPostingExpert(false);
    }
  };

  const handleEvalModalProceed = () => {
    setShowEvalResultModal(false);
    setShowTaskAppreciation(true);
  };

  const handleTaskAppreciationClose = () => {
    setShowTaskAppreciation(false);
    setShowRatingModal(true);
  };

  const handleRatingModalClose = async () => {
    setShowRatingModal(false);
    const targetCourseId = taskData?.course_id;
    if (!targetCourseId) {
      navigate(-1);
      return;
    }
    try {
      const res = await axios.get(`${API_BASE}/courses/${targetCourseId}/modules`);
      const modules = res.data || [];
      const currIdx = modules.findIndex((m) => m.id === moduleId);
      if (currIdx >= 0 && currIdx + 1 < modules.length) {
        const nextMod = modules[currIdx + 1];
        navigate(`/course/${targetCourseId}?module=${nextMod.id}`);
      } else {
        navigate(`/course/${targetCourseId}`);
      }
    } catch (e) {
      navigate(`/course/${targetCourseId}`);
    }
  };

  if (!taskData) {
    return (
      <div className={`min-h-screen flex items-center justify-center text-xs ${
        isLight ? 'bg-slate-50 text-slate-500' : 'bg-slate-950 text-slate-400'
      }`}>
        Loading adaptive task challenge (Model 3)...
      </div>
    );
  }

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
              {taskData.title}
            </h1>
            <p className="text-[11px] text-slate-500">
              Assigned Complexity: <span className="font-bold text-blue-600 dark:text-cyan-300 capitalize">{taskData.predicted_qlc}</span> (from Model 3)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          {taskData.task_type === 'programming' && (
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500 hidden sm:inline">Compiler:</span>
              <select
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className={`border text-xs font-mono font-bold px-2.5 py-1.5 rounded-xl focus:outline-none ${
                  isLight 
                    ? 'bg-slate-100 border-slate-300 text-blue-800 focus:border-blue-500' 
                    : 'bg-slate-900 border-slate-800 text-cyan-300 focus:border-cyan-500'
                }`}
              >
                {taskData.allowed_compilers?.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* TASK LIFELINES: SWAP & PEER HELP & ASK EXPERT */}
          {!submitted && (
            <div className="flex items-center gap-1.5">
              {/* Swap Question */}
              <button
                type="button"
                onClick={handleSwapTask}
                disabled={swapping}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isLight 
                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300' 
                    : 'bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border-amber-800/80'
                }`}
                title="Swap with another question of equal difficulty"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${swapping ? 'animate-spin' : ''}`} />
                <span className="hidden lg:inline">Swap</span>
              </button>

              {/* Ask Peers */}
              <button
                type="button"
                onClick={() => setShowPeerModal(true)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isLight 
                    ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-300' 
                    : 'bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border-indigo-800/80'
                }`}
                title="Ask classmates on the module peer board"
              >
                <Users className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Ask Peers</span>
              </button>

              {/* Ask Expert */}
              <button
                type="button"
                onClick={() => setShowExpertModal(true)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  isLight 
                    ? 'bg-purple-50 hover:bg-purple-100 text-purple-800 border-purple-300' 
                    : 'bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border-purple-800/80'
                }`}
                title="Ask course instructor (code snapshot is auto-attached)"
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span className="hidden lg:inline">Ask Expert</span>
              </button>
            </div>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1 transition cursor-pointer ${
              isLight ? 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100' : 'bg-slate-900 border-slate-700 text-slate-200 hover:bg-slate-800'
            }`}
            title="Toggle Game Zone Fullscreen Lockdown"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <ThemeToggle />

          {!submitted ? (
            <button
              onClick={handleInitiateSubmit}
              disabled={submitting || preChecking}
              className="px-4 md:px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {preChecking ? 'Analyzing...' : submitting ? 'Evaluating...' : 'Submit to Faculty'}
            </button>
          ) : (
            <span className={`px-4 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 ${
              isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-emerald-950 text-emerald-300 border-emerald-800'
            }`}>
              <CheckCircle className="w-4 h-4 text-emerald-500" /> Submitted
            </span>
          )}
        </div>
      </header>

      {/* Main Workbench Layout */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Side: Problem Statement */}
        <div 
          className={`rounded-3xl p-6 border flex flex-col justify-between backdrop-blur-md select-none ${
            isLight ? 'border-white/60 shadow-lg text-slate-900' : 'border-slate-800 shadow-2xl text-white'
          }`}
          onCopy={(e) => e.preventDefault()}
          onCut={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
          style={{ background: isLight ? 'rgba(255, 255, 255, 0.78)' : activeTheme.cardBg }}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-cyan-950 text-cyan-300 border-cyan-800'
              }`}>
                {taskData.task_type} Challenge
              </span>
              <span className="text-slate-500 font-medium">Max Marks: {taskData.max_marks}</span>
            </div>

            <h2 className={`text-xl font-black ${isLight ? 'text-slate-900' : 'text-white'}`}>
              {taskData.title}
            </h2>

            <div className={`prose max-w-none text-xs leading-relaxed whitespace-pre-line p-4 rounded-2xl border ${
              isLight ? 'bg-white/60 border-white/60 text-slate-800' : 'prose-invert bg-slate-950/60 border-slate-800/80 text-slate-300'
            }`}>
              {taskData.problem_statement}
            </div>

            {taskData.pdf_attachment && (
              <div className={`p-3 rounded-xl border flex items-center justify-between ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
              }`}>
                <div className={`flex items-center gap-2 text-xs ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                  <FileText className={`w-4 h-4 ${isLight ? 'text-blue-600' : 'text-cyan-400'}`} />
                  <span>Google Docs Assignment</span>
                </div>
                <a
                  href={taskData.pdf_attachment}
                  target="_blank"
                  rel="noreferrer"
                  className={`text-xs font-semibold ${isLight ? 'text-blue-600 hover:text-blue-700' : 'text-cyan-400 hover:text-cyan-300'}`}
                >
                  Open Google Doc
                </a>
              </div>
            )}
          </div>

          {/* Submission Status banner */}
          {submitted && evalResult && (
            <div className={`mt-6 p-4 rounded-2xl border text-xs ${
              isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="w-4 h-4" /> Evaluated Solution
                </h4>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-black text-xs">
                  Score: {evalResult.score} / {taskData.max_marks}
                </span>
              </div>
              <p className={`text-[11px] leading-relaxed ${isLight ? 'text-emerald-800' : 'text-emerald-300/80'}`}>
                {evalResult.explanation}
              </p>
            </div>
          )}
        </div>

        {/* Right Side: Code Editor / Multi-line Text Box */}
        <div className="space-y-4 flex flex-col justify-between">
          
          {taskData.task_type === 'programming' ? (
            <>
              {/* Code Editor Container */}
              <div className={`flex-1 border rounded-3xl p-4 flex flex-col ${
                isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-950 border-slate-800 shadow-2xl'
              }`}>
                <div className={`flex items-center justify-between pb-3 mb-2 border-b text-xs font-mono ${
                  isLight ? 'border-slate-200 text-slate-600' : 'border-slate-800/80 text-slate-400'
                }`}>
                  <span className="font-semibold text-blue-600 dark:text-cyan-400">
                    solution.{selectedLanguage === 'python' ? 'py' : selectedLanguage === 'java' ? 'java' : selectedLanguage === 'cpp' ? 'cpp' : 'c'}
                  </span>
                  <button
                    onClick={handleRunCode}
                    disabled={running}
                    className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5 fill-white" />
                    {running ? 'Compiling...' : 'Run Code'}
                  </button>
                </div>

                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="// Write your solution here..."
                  rows={16}
                  className={`flex-1 w-full bg-transparent font-mono text-xs leading-relaxed resize-none focus:outline-none ${
                    isLight ? 'text-slate-900 placeholder-slate-400' : 'text-slate-200 placeholder-slate-600'
                  }`}
                  spellCheck="false"
                />
              </div>

              {/* Terminal / Output Console */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 font-mono text-xs min-h-[140px] max-h-[220px] overflow-y-auto shadow-md">
                <div className="flex items-center gap-2 text-slate-400 mb-2 border-b border-slate-800/60 pb-1 text-[11px]">
                  <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-semibold text-slate-300">Execution Output Terminal</span>
                </div>

                {running ? (
                  <p className="text-cyan-400 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Compiling and running {selectedLanguage}...
                  </p>
                ) : runOutput ? (
                  <div>
                    {runOutput.output && (
                      <pre className="text-emerald-400 whitespace-pre-wrap">{runOutput.output}</pre>
                    )}
                    {runOutput.error && (
                      <pre className="text-red-400 whitespace-pre-wrap">{runOutput.error}</pre>
                    )}
                  </div>
                ) : (
                  <p className="text-slate-500 italic">Click 'Run Code' to execute your program.</p>
                )}
              </div>
            </>
          ) : (
            /* Descriptive Task */
            <div className={`flex-1 border rounded-3xl p-6 flex flex-col ${
              isLight ? 'bg-white border-slate-200 shadow-md' : 'bg-slate-950 border-slate-800 shadow-2xl'
            }`}>
              <h3 className={`text-sm font-bold mb-2 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                Your Detailed Answer
              </h3>
              <textarea
                value={descriptiveText}
                onChange={(e) => setDescriptiveText(e.target.value)}
                placeholder="Type your explanation, algorithm trace, or analysis here..."
                rows={18}
                className={`flex-1 w-full border rounded-2xl p-4 text-xs leading-relaxed resize-none focus:outline-none focus:border-blue-500 ${
                  isLight 
                    ? 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400' 
                    : 'bg-slate-900 border-slate-800 text-slate-200 placeholder-slate-600'
                }`}
              />
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: PRE-SUBMISSION HEALTH CHECK DIAGNOSTICS */}
      {showPreCheckModal && preCheckData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl p-6 md:p-8 border shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 ${
            isLight ? 'bg-white text-slate-900 border-slate-300' : 'bg-slate-950 text-white border-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h3 className="font-black text-base">Pre-Submission Code Health Check</h3>
              </div>
              <button 
                onClick={() => setShowPreCheckModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Test Summary Banner */}
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${
              preCheckData.passed_visible === preCheckData.total_visible
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
            }`}>
              <div className="flex items-center gap-2.5">
                {preCheckData.passed_visible === preCheckData.total_visible ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                ) : (
                  <AlertCircle className="w-6 h-6 text-amber-500" />
                )}
                <div>
                  <h4 className="font-extrabold text-sm">
                    {preCheckData.passed_visible} of {preCheckData.total_visible} Visible Tests Passed
                  </h4>
                  <p className="text-[11px] opacity-80">
                    {preCheckData.passed_visible === preCheckData.total_visible
                      ? 'Looking great! Ready for official autograding.'
                      : 'Some test cases or syntax requirements were not met.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Diagnostics List */}
            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-slate-500">Test Case Diagnostics:</h5>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {preCheckData.diagnostics?.map((diag, i) => (
                  <div key={i} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px]">
                    {diag}
                  </div>
                ))}
              </div>
            </div>

            {/* Warnings (if any) */}
            {preCheckData.warnings?.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 text-xs space-y-1">
                <span className="font-bold">Notice:</span>
                {preCheckData.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] leading-snug">• {w}</p>
                ))}
              </div>
            )}

            {/* Coins Cost Indicator */}
            <div className="text-[11px] text-slate-500 text-center">
              {preCheckData.coins_deducted === 0 ? (
                <span className="text-emerald-600 font-bold">First pre-check check is FREE!</span>
              ) : (
                <span>Spent <strong className="text-amber-500">{preCheckData.coins_deducted} Coins</strong> for this diagnostic check.</span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowPreCheckModal(false)}
                className={`flex-1 py-3 rounded-2xl border text-xs font-bold transition cursor-pointer ${
                  isLight 
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' 
                    : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700'
                }`}
              >
                ✏️ Edit Code
              </button>

              <button
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : '🚀 Proceed to Final Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: INSTANT EVALUATION RESULT MODAL */}
      {showEvalResultModal && evalResult && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl p-6 md:p-8 border shadow-2xl space-y-5 text-center animate-in zoom-in-95 duration-200 ${
            isLight ? 'bg-white text-slate-900 border-slate-200' : 'bg-slate-950 text-white border-slate-800'
          }`}>
            <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-emerald-400 animate-pulse" />
            </div>

            <div>
              <span className="text-[10px] font-black tracking-widest uppercase px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                Hybrid Neuro-Symbolic Autograder
              </span>
              <h3 className="text-2xl font-black mt-2">
                Task Challenge Evaluated!
              </h3>
            </div>

            {/* Score Showcase */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Score Awarded</span>
              <div className="text-4xl font-black text-emerald-500 mt-1">
                {evalResult.score} <span className="text-lg text-slate-400 font-medium">/ {taskData.max_marks}</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Confidence: <strong className="text-indigo-400 capitalize">{evalResult.confidence}</strong> • Leaderboard points applied
              </p>
            </div>

            {/* Explanation / Quoted Evidence */}
            <div className={`p-4 rounded-2xl border text-left text-xs leading-relaxed ${
              isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-900/90 border-slate-800 text-slate-200'
            }`}>
              <h5 className="font-bold text-slate-500 text-[11px] uppercase mb-1">Feedback & Evidence:</h5>
              <p>{evalResult.explanation}</p>
            </div>

            <button
              onClick={handleEvalModalProceed}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-xs cursor-pointer shadow-lg shadow-indigo-500/25 transition"
            >
              Continue to Element Rating (Algorithm 3) →
            </button>
          </div>
        </div>
      )}

      {/* MODAL 3: ASK PEERS MODAL (2 Text Boxes: Bold Heading + Description) */}
      {showPeerModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-4 ${
            isLight ? 'bg-white text-slate-900 border-slate-300' : 'bg-slate-950 text-white border-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-500" />
                <h3 className="font-black text-sm">Ask Classmate Peers</h3>
              </div>
              <button 
                onClick={() => setShowPeerModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePostPeerQuery} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">1. Question Title (Bold Heading on Board):</label>
                <input
                  type="text"
                  placeholder="e.g., Segmentation Fault in Reverse Loop"
                  value={peerHeading}
                  onChange={(e) => setPeerHeading(e.target.value)}
                  className="w-full p-2.5 rounded-xl border text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">2. Description (Describe your doubt / code):</label>
                <textarea
                  placeholder="Describe your error or paste the part you are stuck on..."
                  value={peerDescription}
                  onChange={(e) => setPeerDescription(e.target.value)}
                  rows={5}
                  className="w-full p-2.5 rounded-xl border text-xs leading-relaxed bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:border-indigo-500 resize-none"
                  required
                />
              </div>

              <p className="text-[11px] text-slate-500">
                Cost: <strong className="text-amber-500">20 Coins</strong> per peer question. Peers answering earn points!
              </p>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPeerModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postingPeer}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {postingPeer ? 'Posting...' : 'Post to Peer Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ASK THE EXPERT (Auto Attaches Code Snapshot) */}
      {showExpertModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl space-y-4 ${
            isLight ? 'bg-white text-slate-900 border-slate-300' : 'bg-slate-950 text-white border-slate-800'
          }`}>
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-5 h-5 text-purple-500" />
                <h3 className="font-black text-sm">Ask Course Instructor</h3>
              </div>
              <button 
                onClick={() => setShowExpertModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handlePostExpertQuery} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1">Subject / Heading:</label>
                <input
                  type="text"
                  placeholder="e.g., Clarification on Test Case 2"
                  value={expertHeading}
                  onChange={(e) => setExpertHeading(e.target.value)}
                  className="w-full p-2.5 rounded-xl border text-xs font-bold bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Your Question / Doubt:</label>
                <textarea
                  placeholder="Explain where you are confused or what error you cannot clear..."
                  value={expertQuery}
                  onChange={(e) => setExpertQuery(e.target.value)}
                  rows={4}
                  className="w-full p-2.5 rounded-xl border text-xs leading-relaxed bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 focus:outline-none focus:border-purple-500 resize-none"
                  required
                />
              </div>

              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-300 text-[11px] leading-relaxed">
                ℹ️ <strong>Automatic Diagnostic Snapshot:</strong> Your current code editor contents and compiler error trace will be packaged and sent to the teacher dashboard.
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowExpertModal(false)}
                  className="flex-1 py-2.5 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={postingExpert}
                  className="flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {postingExpert ? 'Sending...' : 'Send to Instructor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gamification Element Rating Modal (Algorithm 3) */}
      {showRatingModal && (
        <ElementRatingModal
          moduleId={moduleId}
          onClose={handleRatingModalClose}
        />
      )}

      {/* APPRECIATION ANIMATION MODAL (HAPPY - TASK COMPLETED) */}
      <AppreciationModal
        isOpen={showTaskAppreciation}
        onClose={handleTaskAppreciationClose}
        type="happy"
        title="Coding Task Completed!"
        subtitle={`Splendid work, ${user?.name}! Your adaptive challenge response has been recorded. Earning points and advancing progress!`}
        coinsAwarded={50}
        archetype={user?.pt_ls || 'Pioneers'}
        buttonText="Proceed to Next Milestone"
      />

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
              Focus loss or tab switching detected. While the coding task challenge is active, your screen is restricted to prevent malpractice.
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
              Return to Task Arena
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
