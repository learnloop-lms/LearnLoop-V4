import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeToggle } from '../context/ThemeContext';
import { useVisionaryFeedback } from '../context/VisionaryFeedbackContext';
import { 
  ArrowLeft, Play, Send, Terminal, Code2, 
  FileText, CheckCircle, AlertCircle, RefreshCw
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchTask();
  }, [moduleId]);

  const fetchTask = async () => {
    try {
      const res = await axios.get(`${API_BASE}/tasks/module/${moduleId}`);
      setTaskData(res.data);
      if (res.data.allowed_compilers && res.data.allowed_compilers.length > 0) {
        const defaultLang = res.data.allowed_compilers.includes('python') ? 'python' : res.data.allowed_compilers[0];
        setSelectedLanguage(defaultLang);
        if (res.data.starter_code && res.data.starter_code[defaultLang]) {
          setCode(res.data.starter_code[defaultLang]);
        }
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'No task challenges available for this module yet.');
      navigate(-1);
    }
  };

  const handleLanguageChange = (lang) => {
    setSelectedLanguage(lang);
    if (taskData?.starter_code && taskData.starter_code[lang]) {
      setCode(taskData.starter_code[lang]);
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

  const handleSubmitTask = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await axios.post(`${API_BASE}/tasks/submit`, {
        task_id: taskData.task_id,
        programming_language: taskData.task_type === 'programming' ? selectedLanguage : null,
        submitted_code: taskData.task_type === 'programming' ? code : null,
        submitted_text: taskData.task_type === 'descriptive' ? descriptiveText : null,
        compiler_output: runOutput?.output || ''
      });
      setSubmitted(true);
      triggerFeedback('progress_forward', { course: taskData?.title });
      setShowTaskAppreciation(true);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to submit task.');
    } finally {
      setSubmitting(false);
    }
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

        <div className="flex items-center gap-3">
          {taskData.task_type === 'programming' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Compiler:</span>
              <select
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className={`border text-xs font-mono font-bold px-3 py-1.5 rounded-xl focus:outline-none ${
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

          <ThemeToggle />

          {!submitted ? (
            <button
              onClick={handleSubmitTask}
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {submitting ? 'Submitting...' : 'Submit to Faculty'}
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
        
        {/* Left Side: Problem Statement (Select-None & Anti-Copy Protected) */}
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
                  <span>Download Assignment PDF</span>
                </div>
                <a
                  href={taskData.pdf_attachment}
                  target="_blank"
                  rel="noreferrer"
                  className={`text-xs font-semibold ${isLight ? 'text-blue-600 hover:text-blue-700' : 'text-cyan-400 hover:text-cyan-300'}`}
                >
                  View Attachment
                </a>
              </div>
            )}
          </div>

          {/* Submission Status banner */}
          {submitted && (
            <div className={`mt-6 p-4 rounded-2xl border text-xs ${
              isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-emerald-950/60 border-emerald-800 text-emerald-200'
            }`}>
              <h4 className="font-bold flex items-center gap-1.5 mb-1 text-emerald-700 dark:text-emerald-400">
                <CheckCircle className="w-4 h-4" /> Solution Submitted for Faculty Review
              </h4>
              <p className={`text-[11px] ${isLight ? 'text-emerald-800' : 'text-emerald-300/80'}`}>
                Your instructor will grade your solution. When graded, Model 4 will calculate your total points and update your leaderboard rank!
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
    </div>
  );
}
