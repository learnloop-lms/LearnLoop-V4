import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeToggle } from '../context/ThemeContext';
import { 
  BookOpen, Plus, Users, CheckCircle, Clock, Award, 
  Code2, LogOut, ChevronRight, Check, X, Sparkles, MessageSquare, ArrowRight,
  Filter, Edit3, Layers, FileText
} from 'lucide-react';

export default function TeacherDashboard() {
  const { user, API_BASE, logout } = useAuth();
  const { isLight } = useTheme();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL');
  const [selectedModuleFilter, setSelectedModuleFilter] = useState('ALL');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState('ALL'); // ALL, pending, graded
  const [editingSubmissionId, setEditingSubmissionId] = useState(null);
  const [pendingRevaluations, setPendingRevaluations] = useState([]);
  const [activeTab, setActiveTab] = useState('courses'); // courses, tasks, revaluations
  
  // New Course Modal State
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [allowedCompilers, setAllowedCompilers] = useState(['python', 'c', 'cpp', 'java']);
  const [creatingCourse, setCreatingCourse] = useState(false);

  // Grade Task State
  const [gradeScore, setGradeScore] = useState({});
  const [gradeFeedback, setGradeFeedback] = useState({});
  const [gradingId, setGradingId] = useState(null);

  // Resolve Revaluation State
  const [revalScore, setRevalScore] = useState({});
  const [revalNotes, setRevalNotes] = useState({});

  useEffect(() => {
    fetchTeacherCourses();
    fetchPendingTasks();
    fetchAllSubmissions();
    fetchPendingRevaluations();
  }, []);

  const fetchTeacherCourses = async () => {
    try {
      const res = await axios.get(`${API_BASE}/courses/teacher/my-courses`);
      setCourses(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingTasks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/tasks/pending-evaluations`);
      setPendingTasks(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAllSubmissions = async () => {
    try {
      const res = await axios.get(`${API_BASE}/tasks/submissions/all`);
      setAllSubmissions(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPendingRevaluations = async () => {
    try {
      const res = await axios.get(`${API_BASE}/revaluations/teacher/pending`);
      setPendingRevaluations(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setCreatingCourse(true);
    try {
      await axios.post(`${API_BASE}/courses`, {
        title,
        description,
        join_code: joinCode.trim().toUpperCase(),
        allowed_compilers: allowedCompilers,
        w1_quiz_weight: 0.5,
        w2_task_weight: 0.5,
        passing_threshold_p: 5.0
      });
      setShowCourseModal(false);
      setTitle('');
      setDescription('');
      setJoinCode('');
      fetchTeacherCourses();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create course.');
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleCompilerToggle = (lang) => {
    if (allowedCompilers.includes(lang)) {
      setAllowedCompilers(allowedCompilers.filter(l => l !== lang));
    } else {
      setAllowedCompilers([...allowedCompilers, lang]);
    }
  };

  const handleGradeTask = async (submissionId) => {
    const score = gradeScore[submissionId];
    const feedback = gradeFeedback[submissionId] || '';
    if (score === undefined || score === '') {
      alert('Please enter a valid mark.');
      return;
    }

    setGradingId(submissionId);
    try {
      const res = await axios.post(`${API_BASE}/tasks/grade/${submissionId}`, {
        mst_score: parseFloat(score),
        teacher_feedback: feedback
      });
      const tier = res.data?.model4_update?.leaderboard_level || res.data?.leaderboard_level || 'Updated';
      alert(`Graded successfully! Cognitive Model 4 updated student tier to: ${tier}`);
      fetchPendingTasks();
      fetchAllSubmissions();
      setEditingSubmissionId(null);
    } catch (err) {
      console.error('Grading error:', err);
      alert(err.response?.data?.detail || err.message || 'Grading failed.');
    } finally {
      setGradingId(null);
    }
  };

  const handleResolveRevaluation = async (revalId) => {
    const score = revalScore[revalId];
    const notes = revalNotes[revalId] || 'Reviewed and updated by instructor.';
    if (score === undefined || score === '') {
      alert('Please enter a revised score.');
      return;
    }

    try {
      await axios.post(`${API_BASE}/revaluations/${revalId}/resolve`, {
        status: 'accepted',
        revised_score: parseFloat(score),
        teacher_notes: notes
      });
      alert('Revaluation accepted and mark updated successfully!');
      fetchPendingRevaluations();
      fetchAllSubmissions();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to resolve revaluation.');
    }
  };

  const handleRejectRevaluation = async (revalId) => {
    const notes = revalNotes[revalId] || 'Original mark maintained after review.';
    try {
      await axios.post(`${API_BASE}/revaluations/${revalId}/resolve`, {
        status: 'rejected',
        teacher_notes: notes
      });
      alert('Revaluation finalized. Original mark retained.');
      fetchPendingRevaluations();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to reject revaluation.');
    }
  };

  // Calculate breakdown stats for courses and topics
  const courseCounts = courses.map((c) => {
    const subs = allSubmissions.filter((s) => s.course_id === c.id);
    const needToCorrect = subs.filter((s) => s.status === 'pending').length;
    const corrected = subs.filter((s) => s.status === 'graded').length;
    return {
      ...c,
      totalSubs: subs.length,
      needToCorrect,
      corrected
    };
  });

  const totalNeedToCorrect = allSubmissions.filter((s) => s.status === 'pending').length;
  const totalCorrected = allSubmissions.filter((s) => s.status === 'graded').length;

  const availableModules = React.useMemo(() => {
    let relevantSubs = allSubmissions;
    if (selectedCourseFilter !== 'ALL') {
      relevantSubs = allSubmissions.filter((s) => s.course_id === selectedCourseFilter);
    }
    const map = new Map();
    relevantSubs.forEach((s) => {
      if (s.module_id && !map.has(s.module_id)) {
        const need = relevantSubs.filter((x) => x.module_id === s.module_id && x.status === 'pending').length;
        const corr = relevantSubs.filter((x) => x.module_id === s.module_id && x.status === 'graded').length;
        map.set(s.module_id, {
          id: s.module_id,
          module_no: s.module_no,
          concept_name: s.concept_name,
          need,
          corr
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => (a.module_no || 0) - (b.module_no || 0));
  }, [allSubmissions, selectedCourseFilter]);

  const displayedSubmissions = allSubmissions.filter((s) => {
    if (selectedCourseFilter !== 'ALL' && s.course_id !== selectedCourseFilter) return false;
    if (selectedModuleFilter !== 'ALL' && s.module_id !== selectedModuleFilter) return false;
    if (submissionStatusFilter !== 'ALL' && s.status !== submissionStatusFilter) return false;
    return true;
  });

  return (
    <div 
      className={`min-h-screen font-sans bg-cover bg-center bg-fixed transition-colors duration-200 ${
        isLight ? 'text-slate-900' : 'text-slate-100'
      }`}
      style={{
        backgroundImage: isLight
          ? 'linear-gradient(to bottom, rgba(255, 255, 255, 0.78), rgba(245, 247, 250, 0.88)), url(/assets/teacher/teacher_bg.png)'
          : 'linear-gradient(to bottom, rgba(10, 15, 29, 0.88), rgba(5, 8, 16, 0.95)), url(/assets/teacher/teacher_bg.png)'
      }}
    >
      {/* Top Header */}
      <header className={`sticky top-0 z-40 backdrop-blur-md px-6 py-4 border-b ${
        isLight ? 'bg-white/80 border-white/60' : 'bg-slate-900/90 border-slate-800'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
              {user?.name?.slice(0, 2).toUpperCase() || 'FA'}
            </div>
            <div>
              <h1 className="font-extrabold text-base md:text-lg">{user?.name}</h1>
              <p className="text-xs text-slate-500">
                Faculty Portal • {user?.department} (ID: {user?.employee_id})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button
              onClick={logout}
              className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-center gap-2 text-xs font-bold ${
                isLight ? 'bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border-slate-200' : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-red-400 border-slate-700'
              }`}
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Navigation Tabs */}
        <div className={`flex border-b gap-8 text-sm font-bold ${
          isLight ? 'border-slate-200' : 'border-slate-800'
        }`}>
          <button
            onClick={() => setActiveTab('courses')}
            className={`pb-3 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'courses'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            My Courses & Classes ({courses.length})
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`pb-3 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'tasks'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Code2 className="w-4 h-4" />
            Task Submissions ({pendingTasks.length})
          </button>

          <button
            onClick={() => setActiveTab('revaluations')}
            className={`pb-3 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'revaluations'
                ? 'border-b-2 border-indigo-600 text-indigo-600'
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Revaluation Requests ({pendingRevaluations.length})
          </button>
        </div>

        {/* TAB 1: Courses & Classes */}
        {activeTab === 'courses' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Managed Classes</h2>
                <p className="text-xs text-slate-500">
                  Click any class card to manage its curriculum, topics, materials, and quizzes.
                </p>
              </div>

              <button
                onClick={() => setShowCourseModal(true)}
                className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-500/20 flex items-center gap-2 transition cursor-pointer shrink-0"
              >
                <Plus className="w-5 h-5" /> + Create New Class
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <div 
                  key={course.id} 
                  onClick={() => navigate(`/teacher/course/${course.id}`)}
                  className={`p-6 rounded-3xl border transition cursor-pointer shadow-xs hover:shadow-lg hover:border-indigo-500 space-y-4 group ${
                    isLight ? 'bg-white/75 backdrop-blur-md border-white/60' : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-extrabold tracking-widest px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      Join Code: {course.join_code}
                    </span>
                    <span className="text-xs font-bold text-slate-400">{course.modules_count || 0} Modules</span>
                  </div>

                  <div>
                    <h3 className="font-black text-lg text-slate-900 dark:text-white group-hover:text-indigo-600 transition">
                      {course.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-1">{course.description || 'No description'}</p>
                  </div>

                  <div className="space-y-2 text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Compilers:</span>
                      <span className="font-mono uppercase font-bold text-indigo-600">{course.allowed_compilers?.join(', ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Enrolled Students:</span>
                      <span className="font-bold text-emerald-600">{course.enrolled_students_count || 0}</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs font-bold text-indigo-600">
                    <span>Open Class & Modules</span>
                    <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1 transition" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: Task Submissions Evaluation */}
        {activeTab === 'tasks' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">Student Coding & Task Submissions</h2>
                <p className="text-xs text-slate-500">
                  Review student problem statements, code, outputs, and grade tasks. Grading triggers Model 4 for leaderboard cognitive updates.
                </p>
              </div>

              {/* Submissions KPI Counters */}
              <div className="flex flex-wrap items-center gap-3">
                <div className={`px-4 py-2 rounded-2xl border text-xs flex items-center gap-2 ${
                  isLight ? 'bg-white border-slate-200 shadow-xs' : 'bg-slate-900 border-slate-800'
                }`}>
                  <span className="text-slate-500 font-bold">Total:</span>
                  <span className="font-extrabold text-blue-600 dark:text-cyan-400">{allSubmissions.length}</span>
                </div>

                <div className={`px-4 py-2 rounded-2xl border text-xs flex items-center gap-2 ${
                  isLight ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-xs' : 'bg-amber-950/50 border-amber-800 text-amber-300'
                }`}>
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span className="font-bold">Need to Correct:</span>
                  <span className="font-black text-amber-600 dark:text-amber-400 text-sm">{totalNeedToCorrect}</span>
                </div>

                <div className={`px-4 py-2 rounded-2xl border text-xs flex items-center gap-2 ${
                  isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-xs' : 'bg-emerald-950/50 border-emerald-800 text-emerald-300'
                }`}>
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="font-bold">Corrected:</span>
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">{totalCorrected}</span>
                </div>
              </div>
            </div>

            {/* Course & Module Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {courseCounts.map((c) => {
                const isSelected = selectedCourseFilter === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedCourseFilter('ALL');
                        setSelectedModuleFilter('ALL');
                      } else {
                        setSelectedCourseFilter(c.id);
                        setSelectedModuleFilter('ALL');
                      }
                    }}
                    className={`p-4 rounded-2xl border transition cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border-blue-600'
                        : isLight
                        ? 'bg-white/80 border-slate-200 hover:border-slate-300 shadow-xs'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className={`font-mono font-bold ${isSelected ? 'text-white' : 'text-blue-600 dark:text-cyan-400'}`}>
                        {c.join_code}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isSelected ? 'bg-white/20 text-white' : isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {c.totalSubs} Submissions
                      </span>
                    </div>
                    <h3 className="font-bold text-sm line-clamp-1 mb-2.5">{c.title}</h3>

                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        isSelected
                          ? 'bg-amber-400 text-amber-950'
                          : isLight
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-amber-950 text-amber-300'
                      }`}>
                        Need to Correct: {c.needToCorrect}
                      </span>

                      <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${
                        isSelected
                          ? 'bg-emerald-400 text-emerald-950'
                          : isLight
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-emerald-950 text-emerald-300'
                      }`}>
                        Corrected: {c.corrected}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Filter Bar */}
            <div className={`p-4 rounded-2xl border flex flex-wrap items-center justify-between gap-4 ${
              isLight ? 'bg-white/80 border-slate-200 shadow-xs' : 'bg-slate-900/80 border-slate-800'
            }`}>
              {/* Status Switcher */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setSubmissionStatusFilter('ALL')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                    submissionStatusFilter === 'ALL'
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  All ({allSubmissions.length})
                </button>

                <button
                  type="button"
                  onClick={() => setSubmissionStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    submissionStatusFilter === 'pending'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-amber-600 dark:text-amber-400 hover:opacity-80'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  Need to Correct ({totalNeedToCorrect})
                </button>

                <button
                  type="button"
                  onClick={() => setSubmissionStatusFilter('graded')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    submissionStatusFilter === 'graded'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-emerald-600 dark:text-emerald-400 hover:opacity-80'
                  }`}
                >
                  <CheckCircle className="w-3 h-3" />
                  Corrected ({totalCorrected})
                </button>
              </div>

              {/* Course & Module Dropdowns */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {/* Course Dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold">Course:</span>
                  <select
                    value={selectedCourseFilter}
                    onChange={(e) => {
                      setSelectedCourseFilter(e.target.value);
                      setSelectedModuleFilter('ALL');
                    }}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium focus:outline-none focus:border-indigo-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-700 text-slate-200'
                    }`}
                  >
                    <option value="ALL">All Courses ({allSubmissions.length})</option>
                    {courseCounts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} (Need: {c.needToCorrect}, Done: {c.corrected})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Module Dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-semibold">Module:</span>
                  <select
                    value={selectedModuleFilter}
                    onChange={(e) => setSelectedModuleFilter(e.target.value)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-medium focus:outline-none focus:border-indigo-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-slate-950 border-slate-700 text-slate-200'
                    }`}
                  >
                    <option value="ALL">All Topics / Modules</option>
                    {availableModules.map((m) => (
                      <option key={m.id} value={m.id}>
                        Mod {m.module_no}: {m.concept_name} (Need: {m.need}, Done: {m.corr})
                      </option>
                    ))}
                  </select>
                </div>

                {(selectedCourseFilter !== 'ALL' || selectedModuleFilter !== 'ALL' || submissionStatusFilter !== 'ALL') && (
                  <button
                    onClick={() => {
                      setSelectedCourseFilter('ALL');
                      setSelectedModuleFilter('ALL');
                      setSubmissionStatusFilter('ALL');
                    }}
                    className="text-[11px] font-bold text-indigo-600 dark:text-cyan-400 hover:underline cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            </div>

            {/* Submissions List */}
            {displayedSubmissions.length === 0 ? (
              <div className={`text-center py-16 rounded-3xl border text-xs text-slate-400 ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}>
                No submissions found matching the selected filters.
              </div>
            ) : (
              <div className="space-y-6">
                {displayedSubmissions.map((sub) => {
                  const isGraded = sub.status === 'graded';
                  const isEditing = editingSubmissionId === sub.submission_id;

                  return (
                    <div 
                      key={sub.submission_id} 
                      className={`p-6 rounded-3xl border space-y-5 transition shadow-sm ${
                        isLight ? 'bg-white border-slate-200' : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      {/* Top Header: Course & Topic Hierarchy + Status */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-extrabold text-blue-600 dark:text-cyan-400 uppercase tracking-wide">
                              {sub.course_title || 'Course'}
                            </span>
                            <span className="text-slate-400">&bull;</span>
                            <span className="font-semibold text-slate-700 dark:text-slate-300">
                              Module {sub.module_no}: {sub.concept_name}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-black text-base text-slate-900 dark:text-white">
                              {sub.student_name}
                            </span>
                            <span className="text-xs text-slate-400">({sub.student_regno})</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              isLight ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}>
                              {sub.student_pt_ls || 'Visionaries'} &bull; {sub.student_cognitive_level?.toUpperCase() || 'AVERAGE'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 ${
                            isGraded
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {isGraded ? (
                              <>
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                Corrected (Score: {sub.mst_score}/{sub.max_marks})
                              </>
                            ) : (
                              <>
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                Need to Correct
                              </>
                            )}
                          </span>

                          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                            isLight ? 'bg-slate-100 text-slate-600' : 'bg-slate-800 text-slate-300'
                          }`}>
                            {sub.programming_language?.toUpperCase() || 'DESCRIPTIVE'} &bull; {sub.complexity_qlc} Tier
                          </span>
                        </div>
                      </div>

                      {/* QUESTION / PROBLEM STATEMENT BOX */}
                      <div className={`p-5 rounded-2xl border space-y-2 ${
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-slate-950/60 border-slate-800 text-slate-200'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="flex items-center gap-1.5 text-indigo-600 dark:text-cyan-400 uppercase tracking-wider text-[11px]">
                            <BookOpen className="w-3.5 h-3.5" />
                            Question Problem Statement: {sub.task_title}
                          </span>
                          <span className="text-slate-500 font-medium text-[11px]">
                            Max Marks: {sub.max_marks} &bull; Difficulty: {sub.complexity_qlc}
                          </span>
                        </div>
                        <div className="text-xs leading-relaxed whitespace-pre-line font-sans text-slate-800 dark:text-slate-200">
                          {sub.problem_statement || 'No problem statement recorded.'}
                        </div>
                      </div>

                      {/* STUDENT'S ANSWER: CODE OR DESCRIPTIVE TEXT */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-blue-500" />
                          Student's Submitted Answer:
                        </h4>

                        {sub.submitted_code && (
                          <div className="bg-slate-950 text-slate-100 rounded-2xl p-4 font-mono text-xs overflow-x-auto max-h-64 border border-slate-800 shadow-inner">
                            <pre>{sub.submitted_code}</pre>
                          </div>
                        )}

                        {sub.compiler_output && (
                          <div className="bg-slate-950 text-emerald-400 rounded-2xl p-3.5 font-mono text-xs border border-emerald-900/50 shadow-inner">
                            <strong className="text-slate-400 block mb-1">Execution / Terminal Output:</strong>
                            <pre className="whitespace-pre-wrap">{sub.compiler_output}</pre>
                          </div>
                        )}

                        {sub.submitted_text && (
                          <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 text-xs whitespace-pre-wrap leading-relaxed border border-slate-200 dark:border-slate-700">
                            {sub.submitted_text}
                          </div>
                        )}
                      </div>

                      {/* GRADING & FEEDBACK SECTION */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                        {isGraded && !isEditing ? (
                          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Awarded Mark:</span>
                                <span className="font-extrabold text-base text-emerald-600 dark:text-emerald-400">
                                  {sub.mst_score} / {sub.max_marks}
                                </span>
                                {sub.evaluated_at && (
                                  <span className="text-[11px] text-slate-400 ml-2">
                                    (Graded on {new Date(sub.evaluated_at).toLocaleDateString()})
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-300">
                                <strong>Feedback:</strong> {sub.teacher_feedback || 'No comments.'}
                              </p>
                            </div>

                            <button
                              onClick={() => {
                                setEditingSubmissionId(sub.submission_id);
                                setGradeScore({ ...gradeScore, [sub.submission_id]: sub.mst_score });
                                setGradeFeedback({ ...gradeFeedback, [sub.submission_id]: sub.teacher_feedback || '' });
                              }}
                              className={`px-4 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                isLight ? 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                              }`}
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Re-grade / Update
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-xs font-bold">
                              <span className="text-slate-700 dark:text-slate-300">
                                {isEditing ? 'Update Grade & Feedback:' : 'Enter Grade & Feedback (Need to Correct):'}
                              </span>
                              <span className="text-slate-400 text-[11px]">Maximum marks: {sub.max_marks}</span>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3">
                              <input
                                type="number"
                                min="0"
                                max={sub.max_marks || 100}
                                placeholder={`Marks (0-${sub.max_marks || 100})`}
                                value={gradeScore[sub.submission_id] ?? ''}
                                onChange={(e) => setGradeScore({ ...gradeScore, [sub.submission_id]: e.target.value })}
                                className="w-full sm:w-40 p-2.5 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-indigo-500"
                              />

                              <input
                                type="text"
                                placeholder="Faculty feedback / comments for the student..."
                                value={gradeFeedback[sub.submission_id] ?? ''}
                                onChange={(e) => setGradeFeedback({ ...gradeFeedback, [sub.submission_id]: e.target.value })}
                                className="flex-1 p-2.5 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800 focus:outline-none focus:border-indigo-500"
                              />

                              <div className="flex items-center gap-2 shrink-0">
                                {isEditing && (
                                  <button
                                    onClick={() => setEditingSubmissionId(null)}
                                    className={`px-4 py-2.5 rounded-xl border text-xs font-bold cursor-pointer ${
                                      isLight ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300' : 'bg-slate-800 text-slate-300 border-slate-700'
                                    }`}
                                  >
                                    Cancel
                                  </button>
                                )}

                                <button
                                  onClick={() => handleGradeTask(sub.submission_id)}
                                  disabled={gradingId === sub.submission_id}
                                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50"
                                >
                                  {gradingId === sub.submission_id ? 'Evaluating...' : 'Submit Grade & Trigger Model 4'}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Revaluations */}
        {activeTab === 'revaluations' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black">Student Mark Revaluation Requests</h2>
              <p className="text-xs text-slate-500">Inspect revaluation appeals filed by students and update marks if justified.</p>
            </div>

            {pendingRevaluations.length === 0 ? (
              <div className={`text-center py-16 rounded-3xl border text-xs text-slate-400 ${
                isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
              }`}>
                No pending revaluation requests.
              </div>
            ) : (
              <div className="space-y-6">
                {pendingRevaluations.map((r) => (
                  <div key={r.id} className={`p-6 rounded-3xl border space-y-4 shadow-sm ${
                    isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                  }`}>
                    {/* Header: Student & Course Details */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-base">{r.student_name}</span>
                          <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold">
                            {r.student_regno}
                          </span>
                          <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                            {r.assessment_type} Revaluation
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          {r.course_title && `${r.course_title} • `}{r.module_name && `${r.module_name} • `}{r.task_title || 'Task Challenge'}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                          isLight ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-amber-950/40 text-amber-300 border-amber-800'
                        }`}>
                          Original Score: {r.current_score} marks
                        </span>
                      </div>
                    </div>

                    {/* Question / Problem Statement */}
                    {r.question_text && (
                      <div className={`p-4 rounded-2xl border ${
                        isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'
                      }`}>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-blue-500" />
                          Task Problem Statement (Question)
                        </h4>
                        <p className="text-xs leading-relaxed font-mono whitespace-pre-wrap text-slate-800 dark:text-slate-200">
                          {r.question_text}
                        </p>
                      </div>
                    )}

                    {/* Student's Answer / Code Submission */}
                    <div className={`p-4 rounded-2xl border ${
                      isLight ? 'bg-slate-900 text-slate-100 border-slate-800' : 'bg-black/80 text-emerald-400 border-slate-800'
                    }`}>
                      <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-800">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                          <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                          Student's Submitted Solution {r.programming_language ? `(${r.programming_language})` : ''}
                        </h4>
                      </div>
                      <pre className="text-xs font-mono overflow-x-auto max-h-60 leading-relaxed">
                        {r.submitted_code || r.submitted_text || 'No code provided.'}
                      </pre>
                      {r.compiler_output && (
                        <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] text-slate-400">
                          <span className="font-bold text-slate-300">Compiler Output: </span>
                          <span className="font-mono">{r.compiler_output}</span>
                        </div>
                      )}
                    </div>

                    {/* Previous Feedback (if any) */}
                    {r.teacher_feedback && (
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300">
                        <strong>Previous Evaluation Feedback:</strong> &ldquo;{r.teacher_feedback}&rdquo;
                      </div>
                    )}

                    {/* Student Reason for Revaluation Appeal */}
                    <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-xs text-amber-950 dark:text-amber-200">
                      <strong className="block text-amber-800 dark:text-amber-400 font-bold mb-1">
                        Student's Revaluation Appeal Reason:
                      </strong>
                      <p className="leading-relaxed">&ldquo;{r.reason}&rdquo;</p>
                    </div>

                    {/* Action Controls: Update Mark or Reject */}
                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-300">
                          Revised Mark:
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 85"
                          value={revalScore[r.id] ?? ''}
                          onChange={(e) => setRevalScore({ ...revalScore, [r.id]: e.target.value })}
                          className="w-28 p-2 rounded-xl border text-sm font-bold bg-white dark:bg-slate-800 text-center"
                        />
                      </div>

                      <input
                        type="text"
                        placeholder="Instructor remarks / feedback to student..."
                        value={revalNotes[r.id] || ''}
                        onChange={(e) => setRevalNotes({ ...revalNotes, [r.id]: e.target.value })}
                        className="flex-1 min-w-[200px] p-2 rounded-xl border text-xs bg-white dark:bg-slate-800"
                      />

                      <button
                        onClick={() => handleResolveRevaluation(r.id)}
                        className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-md transition flex items-center gap-1.5"
                      >
                        <Check className="w-4 h-4" /> Update Mark & Accept
                      </button>

                      <button
                        onClick={() => handleRejectRevaluation(r.id)}
                        className="px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs cursor-pointer transition flex items-center gap-1.5"
                      >
                        <X className="w-4 h-4" /> Maintain Mark (Reject)
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>

      {/* CREATE NEW CLASS MODAL */}
      {showCourseModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl p-8 border shadow-2xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <h3 className="text-xl font-black mb-1">Create New Class</h3>
            <p className="text-xs text-slate-500 mb-6">Configure course details, custom join code, and allowed compilers.</p>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Course Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. C Programming"
                  className="w-full p-2.5 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief overview of course concepts..."
                  className="w-full p-2.5 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Instructor Custom Join Code</label>
                <input
                  type="text"
                  required
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="e.g. 26DSKD0"
                  className="w-full p-2.5 rounded-xl border text-sm font-mono uppercase font-bold bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-2">Allowed Compilers for Coding Tasks</label>
                <div className="grid grid-cols-4 gap-2">
                  {['python', 'c', 'cpp', 'java'].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => handleCompilerToggle(lang)}
                      className={`py-2 rounded-xl text-xs font-bold uppercase transition cursor-pointer border ${
                        allowedCompilers.includes(lang)
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCourseModal(false)}
                  className="flex-1 py-3 rounded-xl border font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCourse}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm cursor-pointer shadow-md"
                >
                  {creatingCourse ? 'Launching...' : 'Launch Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
