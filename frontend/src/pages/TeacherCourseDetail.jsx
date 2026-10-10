import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme, ThemeToggle } from '../context/ThemeContext';
import { 
  ArrowLeft, Plus, BookOpen, HelpCircle, Code, FileText, 
  CheckCircle2, Sparkles, Layers, Award, Copy, Check, ExternalLink,
  ChevronDown, ChevronUp, AlertCircle, Trash2, FileSpreadsheet, Download, UploadCloud
} from 'lucide-react';

const isValidGoogleDocsUrl = (url) => {
  if (!url || !url.trim()) return true;
  const trimmed = url.trim();
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    return host === 'docs.google.com' || host.endsWith('.docs.google.com') ||
           host === 'drive.google.com' || host.endsWith('.drive.google.com');
  } catch {
    return false;
  }
};

export default function TeacherCourseDetail() {
  const { courseId } = useParams();
  const { API_BASE } = useAuth();
  const { isLight } = useTheme();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Modals state
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [excelFile, setExcelFile] = useState(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [excelMsg, setExcelMsg] = useState('');
  const [excelError, setExcelError] = useState('');

  const [showTaskExcelModal, setShowTaskExcelModal] = useState(false);
  const [taskExcelFile, setTaskExcelFile] = useState(null);
  const [uploadingTaskExcel, setUploadingTaskExcel] = useState(false);
  const [taskExcelMsg, setTaskExcelMsg] = useState('');
  const [taskExcelError, setTaskExcelError] = useState('');

  const [activeModuleId, setActiveModuleId] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});

  // Module form state
  const [modNo, setModNo] = useState(1);
  const [conceptName, setConceptName] = useState('');
  const [complexityCmc, setComplexityCmc] = useState(1);
  const [w1, setW1] = useState(0.5);
  const [w2, setW2] = useState(0.5);
  const [passScore, setPassScore] = useState(5.0);

  // Material form state
  const [matLevel, setMatLevel] = useState('average');
  const [matTitle, setMatTitle] = useState('');
  const [matContent, setMatContent] = useState('');
  const [matPdf, setMatPdf] = useState('');
  const [matIsBonus, setMatIsBonus] = useState(false);

  // Quiz question form state
  const [qText, setQText] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOpt, setCorrectOpt] = useState('A');
  const [qDifficulty, setQDifficulty] = useState('average');
  const [bloomsLevel, setBloomsLevel] = useState('Remembering');
  const [targetPtLs, setTargetPtLs] = useState('Universal');
  const [hintText, setHintText] = useState('');

  // Task form state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState('programming');
  const [taskStatement, setTaskStatement] = useState('');
  const [taskComplexity, setTaskComplexity] = useState('intermediate');
  const [taskBlooms, setTaskBlooms] = useState('Applying');
  const [taskTargetPtLs, setTaskTargetPtLs] = useState('Universal');
  const [taskPdf, setTaskPdf] = useState('');
  const [taskMaxMarks, setTaskMaxMarks] = useState(100);
  const [taskIsBonus, setTaskIsBonus] = useState(false);

  useEffect(() => {
    fetchCourseDetails();
  }, [courseId]);

  const fetchCourseDetails = async () => {
    try {
      setLoading(true);
      // 1. Fetch course details directly
      try {
        const cRes = await axios.get(`${API_BASE}/courses/${courseId}`);
        if (cRes.data) {
          setCourse(cRes.data);
        }
      } catch (cErr) {
        console.warn('Direct course fetch fallback, trying list:', cErr);
        const myRes = await axios.get(`${API_BASE}/courses/my`);
        const found = myRes.data.find((c) => c.id === courseId);
        if (found) setCourse(found);
      }

      // 2. Fetch modules for this course
      const mRes = await axios.get(`${API_BASE}/courses/${courseId}/modules`);
      const modList = mRes.data || [];
      setModules(modList);
      // Auto expand all modules
      const exp = {};
      modList.forEach((m) => { exp[m.id] = true; });
      setExpandedModules(exp);
      setModNo(modList.length + 1);
    } catch (err) {
      console.error('Error fetching course data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteModule = async (moduleId, modName, e) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete module "${modName}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/courses/modules/${moduleId}`);
      fetchCourseDetails();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete module');
    }
  };

  const copyJoinCode = () => {
    if (course?.join_code) {
      navigator.clipboard.writeText(course.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCreateModule = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/courses/${courseId}/modules`, {
        course_id: courseId,
        module_no: parseInt(modNo),
        concept_name: conceptName,
        complexity_cmc: parseInt(complexityCmc),
        w1_quiz_weight: parseFloat(w1),
        w2_task_weight: parseFloat(w2),
        passing_threshold_p: parseFloat(passScore)
      });
      setShowModuleModal(false);
      setConceptName('');
      fetchCourseDetails();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to create module');
    }
  };

  const handleAddMaterial = async (e) => {
    e.preventDefault();
    if (matPdf && !isValidGoogleDocsUrl(matPdf)) {
      alert('Only Google Docs or Google Drive links (https://docs.google.com/... or https://drive.google.com/...) are allowed. Local file paths and other links are not permitted.');
      return;
    }
    const cleanPdf = matPdf?.trim() 
      ? (/^https?:\/\//i.test(matPdf.trim()) ? matPdf.trim() : `https://${matPdf.trim()}`)
      : null;
    try {
      await axios.post(`${API_BASE}/courses/modules/${activeModuleId}/materials`, {
        module_id: activeModuleId,
        learning_level: matLevel,
        title: matTitle,
        content_html: matContent,
        pdf_url: cleanPdf,
        is_locked_bonus: matIsBonus
      });
      setShowMaterialModal(false);
      setMatTitle('');
      setMatContent('');
      setMatPdf('');
      setMatIsBonus(false);
      fetchCourseDetails();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add study material');
    }
  };

  const handleAddQuiz = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/quizzes/questions`, {
        module_id: activeModuleId,
        cognitive_level: qDifficulty,
        blooms_level: bloomsLevel,
        target_pt_ls: targetPtLs,
        question_text: qText,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_option: correctOpt,
        hint_text: hintText || null
      });
      setShowQuizModal(false);
      setQText('');
      setOptA('');
      setOptB('');
      setOptC('');
      setOptD('');
      setHintText('');
      fetchCourseDetails();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add quiz question');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await axios.get(`${API_BASE}/quizzes/template/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'learn_loop_quiz_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download Excel template.');
    }
  };

  const handleBulkUploadExcel = async (e) => {
    e.preventDefault();
    if (!excelFile) {
      setExcelError('Please choose an Excel (.xlsx) or CSV file first.');
      return;
    }
    setUploadingExcel(true);
    setExcelError('');
    setExcelMsg('');

    try {
      const formData = new FormData();
      formData.append('module_id', activeModuleId);
      formData.append('file', excelFile);

      const res = await axios.post(`${API_BASE}/quizzes/bulk-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setExcelMsg(res.data.message || 'Questions uploaded successfully!');
      setTimeout(() => {
        setShowExcelModal(false);
        setExcelFile(null);
        setExcelMsg('');
        fetchCourseDetails();
      }, 1500);
    } catch (err) {
      setExcelError(err.response?.data?.detail || 'Failed to import Excel file. Check format and try again.');
    } finally {
      setUploadingExcel(false);
    }
  };

  const handleDownloadTaskTemplate = async () => {
    try {
      const res = await axios.get(`${API_BASE}/tasks/template/download`, {
        responseType: 'blob'
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'learn_loop_task_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to download Task Excel template.');
    }
  };

  const handleBulkUploadTaskExcel = async (e) => {
    e.preventDefault();
    if (!taskExcelFile) {
      setTaskExcelError('Please choose an Excel (.xlsx) or CSV file first.');
      return;
    }
    setUploadingTaskExcel(true);
    setTaskExcelError('');
    setTaskExcelMsg('');

    try {
      const formData = new FormData();
      formData.append('module_id', activeModuleId);
      formData.append('file', taskExcelFile);

      const res = await axios.post(`${API_BASE}/tasks/bulk-upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setTaskExcelMsg(res.data.message || 'Task challenges uploaded successfully!');
      setTimeout(() => {
        setShowTaskExcelModal(false);
        setTaskExcelFile(null);
        setTaskExcelMsg('');
        fetchCourseDetails();
      }, 1500);
    } catch (err) {
      setTaskExcelError(err.response?.data?.detail || 'Failed to import Task challenges. Check format and try again.');
    } finally {
      setUploadingTaskExcel(false);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (taskPdf && !isValidGoogleDocsUrl(taskPdf)) {
      alert('Only Google Docs or Google Drive links (https://docs.google.com/... or https://drive.google.com/...) are allowed. Local file paths and other links are not permitted.');
      return;
    }
    const cleanPdf = taskPdf?.trim()
      ? (/^https?:\/\//i.test(taskPdf.trim()) ? taskPdf.trim() : `https://${taskPdf.trim()}`)
      : null;
    try {
      await axios.post(`${API_BASE}/tasks/challenges`, {
        module_id: activeModuleId,
        complexity_qlc: taskComplexity,
        target_pt_ls: taskTargetPtLs,
        blooms_level: taskBlooms,
        task_type: taskType,
        title: taskTitle,
        problem_statement: taskStatement,
        pdf_attachment: cleanPdf,
        max_marks: parseInt(taskMaxMarks),
        is_locked_bonus: taskIsBonus
      });
      setShowTaskModal(false);
      setTaskTitle('');
      setTaskStatement('');
      setTaskPdf('');
      setTaskIsBonus(false);
      fetchCourseDetails();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add task challenge');
    }
  };

  const toggleExpand = (id) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isLight ? 'bg-slate-50 text-slate-600' : 'bg-slate-950 text-slate-300'}`}>
        Loading Course Classroom...
      </div>
    );
  }

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
      <header className={`sticky top-0 z-40 backdrop-blur-md px-6 py-4 border-b shadow-xs ${
        isLight ? 'bg-white/80 border-white/50' : 'bg-slate-900/90 border-slate-800'
      }`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/teacher/dashboard"
              className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center gap-2 text-sm font-bold ${
                isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700' : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              }`}
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Classes</span>
            </Link>

            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight">{course?.title || 'Course Details'}</h1>
              <p className="text-xs text-slate-500 font-medium">Classroom Management & Curriculum Designer</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Join Code Display */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-2xl border font-mono ${
              isLight ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-blue-950/60 border-blue-800 text-blue-300'
            }`}>
              <span className="text-xs font-sans uppercase font-bold text-slate-500">Join Code:</span>
              <span className="text-base font-black tracking-widest">{course?.join_code}</span>
              <button 
                onClick={copyJoinCode}
                className="ml-1 p-1 hover:opacity-75 transition cursor-pointer"
                title="Copy join code"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        
        {/* Course Banner */}
        <div className={`p-6 md:p-8 rounded-3xl border shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6 backdrop-blur-md ${
          isLight ? 'bg-white/75 border-white/60' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
              <BookOpen className="w-3.5 h-3.5" />
              Classroom Active
            </div>
            <h2 className="text-2xl font-black">{course?.title}</h2>
            <p className="text-sm text-slate-500 max-w-2xl">{course?.description || 'No description provided.'}</p>
            
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="text-xs font-semibold text-slate-500">Compilers Enabled:</span>
              {(course?.allowed_compilers || ['python', 'c', 'cpp', 'java']).map((cmp) => (
                <span key={cmp} className="px-2.5 py-0.5 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-mono font-bold uppercase">
                  {cmp}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={() => setShowModuleModal(true)}
            className="px-6 py-3.5 rounded-2xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2 transition cursor-pointer shrink-0"
          >
            <Plus className="w-5 h-5" />
            <span>+ Create Topic / Module</span>
          </button>
        </div>

        {/* Modules List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Course Modules & Topics ({modules.length})
            </h3>
          </div>

          {modules.length === 0 ? (
            <div className={`p-12 text-center rounded-3xl border shadow-lg backdrop-blur-md ${
              isLight ? 'bg-white/75 border-white/60' : 'bg-slate-900/80 border-slate-800'
            }`}>
              <Layers className="w-12 h-12 mx-auto text-slate-400 mb-3" />
              <h4 className="text-lg font-bold">No Modules Created Yet</h4>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-6">
                Start structuring your course by creating your first module, setting its weights (W1, W2), pass score, and uploading adaptive materials.
              </p>
              <button
                onClick={() => setShowModuleModal(true)}
                className="px-6 py-3 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white transition cursor-pointer inline-flex items-center gap-2 shadow-md"
              >
                <Plus className="w-4 h-4" /> Create First Module
              </button>
            </div>
          ) : (
            modules.map((m) => (
              <div 
                key={m.id}
                className={`rounded-3xl border transition shadow-xs overflow-hidden ${
                  isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                }`}
              >
                {/* Module Bar */}
                <div 
                  className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer ${
                    isLight ? 'bg-slate-50/80 hover:bg-slate-100/80' : 'bg-slate-800/50 hover:bg-slate-800'
                  }`}
                  onClick={() => toggleExpand(m.id)}
                >
                  <div className="flex items-center gap-4">
                    <span className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-blue-500/20">
                      M{m.module_no}
                    </span>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 dark:text-white">{m.concept_name}</h4>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-medium mt-1">
                        <span>Complexity: <strong className="text-blue-600">{m.complexity_cmc === 1 ? 'Basic (Low)' : m.complexity_cmc === 2 ? 'Intermediate (Med)' : 'Advanced (High)'}</strong></span>
                        <span>•</span>
                        <span>Quiz Weight (W1): <strong className="text-indigo-600">{m.w1_quiz_weight}</strong></span>
                        <span>•</span>
                        <span>Task Weight (W2): <strong className="text-purple-600">{m.w2_task_weight}</strong></span>
                        <span>•</span>
                        <span>Pass Score (p): <strong className="text-emerald-600">{m.passing_threshold_p}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => handleDeleteModule(m.id, m.concept_name, e)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                      title="Delete this module"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <span className="text-xs font-bold text-slate-400">
                      {expandedModules[m.id] ? 'Hide Content' : 'View Content'}
                    </span>
                    {expandedModules[m.id] ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {/* Module Expanded Content */}
                {expandedModules[m.id] && (
                  <div className="p-6 md:p-8 space-y-8 border-t border-slate-200 dark:border-slate-800">
                    
                    {/* 3 Action Pillars */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      
                      {/* Pillar 1: Study Materials */}
                      <div className={`p-6 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold text-sm flex items-center gap-2">
                            <BookOpen className="w-4 h-4 text-blue-600" />
                            3-Tier Study Materials
                          </h5>
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                            {m.materials_count || 0} Total
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                          Categorized content for Slow, Medium, and Fast learners + Mystery Box materials.
                        </p>
                        
                        {/* Breakdown Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-950/40 text-blue-300 border-blue-800'
                          }`}>
                            Basic: {m.materials_breakdown?.slow || 0}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            isLight ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-indigo-950/40 text-indigo-300 border-indigo-800'
                          }`}>
                            Med: {m.materials_breakdown?.average || 0}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            isLight ? 'bg-cyan-50 text-cyan-700 border-cyan-200' : 'bg-cyan-950/40 text-cyan-300 border-cyan-800'
                          }`}>
                            Hard: {m.materials_breakdown?.fast || 0}
                          </span>
                          {(m.materials_breakdown?.mystery || 0) > 0 && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                              isLight ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-950/40 text-purple-300 border-purple-800'
                            }`}>
                              🎁 Mystery: {m.materials_breakdown.mystery}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => { setActiveModuleId(m.id); setShowMaterialModal(true); }}
                          className="w-full py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                        >
                          <Plus className="w-4 h-4" /> Add Study Material
                        </button>
                      </div>

                      {/* Pillar 2: Adaptive Quiz */}
                      <div className={`p-6 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold text-sm flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-indigo-600" />
                            Adaptive Quiz Questions
                          </h5>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            (m.quizzes_breakdown?.total || 0) > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {m.quizzes_breakdown?.total || 0} Questions
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                          Questions by difficulty tier (Easy, Medium, Hard) and Bloom's taxonomy.
                        </p>

                        {/* Breakdown Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            isLight ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-emerald-950/40 text-emerald-300 border-emerald-800'
                          }`}>
                            Easy: {m.quizzes_breakdown?.easy || 0}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-950/40 text-amber-300 border-amber-800'
                          }`}>
                            Med: {m.quizzes_breakdown?.medium || 0}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            isLight ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-rose-950/40 text-rose-300 border-rose-800'
                          }`}>
                            Hard: {m.quizzes_breakdown?.hard || 0}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => { setActiveModuleId(m.id); setShowQuizModal(true); }}
                            className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Plus className="w-4 h-4" /> Add Question
                          </button>
                          <button
                            onClick={() => { setActiveModuleId(m.id); setShowExcelModal(true); }}
                            className="px-3.5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            title="Upload Quiz using Excel Template (.xlsx / .csv)"
                          >
                            <FileSpreadsheet className="w-4 h-4" /> Excel Upload
                          </button>
                        </div>
                      </div>

                      {/* Pillar 3: Coding & Descriptive Task */}
                      <div className={`p-6 rounded-2xl border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950/60 border-slate-800'}`}>
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-bold text-sm flex items-center gap-2">
                            <Code className="w-4 h-4 text-purple-600" />
                            Task Challenges
                          </h5>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            (m.tasks_breakdown?.total || 0) > 0 ? 'bg-purple-100 text-purple-800' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {m.tasks_breakdown?.total || 0} Tasks
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                          Challenges categorized by complexity (Basic/Med/Hard) and Bloom's level.
                        </p>

                        {/* Breakdown Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            isLight ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-blue-950/40 text-blue-300 border-blue-800'
                          }`}>
                            Basic: {m.tasks_breakdown?.basic || 0}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            isLight ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-purple-950/40 text-purple-300 border-purple-800'
                          }`}>
                            Med: {m.tasks_breakdown?.intermediate || 0}
                          </span>
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            isLight ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-rose-950/40 text-rose-300 border-rose-800'
                          }`}>
                            Hard: {m.tasks_breakdown?.advanced || 0}
                          </span>
                          {(m.tasks_breakdown?.mystery || 0) > 0 && (
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                              isLight ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-amber-950/40 text-amber-300 border-amber-800'
                            }`}>
                              🎁 Mystery: {m.tasks_breakdown.mystery}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => { setActiveModuleId(m.id); setShowTaskModal(true); }}
                            className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-purple-600 hover:bg-purple-700 text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <Plus className="w-4 h-4" /> Add Task
                          </button>
                          <button
                            onClick={() => { setActiveModuleId(m.id); setShowTaskExcelModal(true); }}
                            className="px-3.5 py-2.5 rounded-xl font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                            title="Upload Task Challenges using Excel Template (.xlsx / .csv)"
                          >
                            <FileSpreadsheet className="w-4 h-4" /> Excel Upload
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Future Scope AI Generator Box */}
                    <div className={`p-4 rounded-2xl border border-dashed flex items-center gap-3 text-xs ${
                      isLight ? 'bg-amber-50/60 border-amber-200 text-amber-900' : 'bg-amber-950/20 border-amber-800/60 text-amber-300'
                    }`}>
                      <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
                      <div>
                        <strong>Future Automated Content & Evaluation Ready:</strong> Service hooks (`ai_question_generator.py`, `ai_content_generator.py`, `ai_answer_evaluator.py`) are pre-allocated for your colleague's SLM algorithm integration.
                      </div>
                    </div>

                  </div>
                )}
              </div>
            ))
          )}
        </div>

      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: CREATE TOPIC / MODULE                                           */}
      {/* ========================================================================= */}
      {showModuleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl p-8 border shadow-2xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <h3 className="text-xl font-black mb-1">Create Course Topic / Module</h3>
            <p className="text-xs text-slate-500 mb-6">Configure module title, complexity, and PhD performance weights.</p>

            <form onSubmit={handleCreateModule} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Module No</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={modNo}
                    onChange={(e) => setModNo(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1">Complexity (CMC)</label>
                  <select
                    value={complexityCmc}
                    onChange={(e) => setComplexityCmc(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                  >
                    <option value={1}>1: Basic (Low Complexity)</option>
                    <option value={2}>2: Intermediate (Medium Complexity)</option>
                    <option value={3}>3: Advanced (High Complexity)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Concept / Topic Name</label>
                <input
                  type="text"
                  required
                  value={conceptName}
                  onChange={(e) => setConceptName(e.target.value)}
                  placeholder="e.g. Dynamic Programming & Memoization"
                  className="w-full p-2.5 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                />
              </div>

              {/* Research Weights W1, W2, Pass Score p */}
              <div className="grid grid-cols-3 gap-3 p-4 rounded-2xl bg-blue-50 dark:bg-slate-800/60 border border-blue-200 dark:border-slate-700">
                <div>
                  <label className="block text-[11px] font-bold text-blue-900 dark:text-blue-300 mb-1">Quiz Weight (W1)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    required
                    value={w1}
                    onChange={(e) => setW1(e.target.value)}
                    className="w-full p-2 rounded-lg border text-sm font-bold bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-indigo-900 dark:text-indigo-300 mb-1">Task Weight (W2)</label>
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    max="1"
                    required
                    value={w2}
                    onChange={(e) => setW2(e.target.value)}
                    className="w-full p-2 rounded-lg border text-sm font-bold bg-white dark:bg-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-300 mb-1">Pass Score (p)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    required
                    value={passScore}
                    onChange={(e) => setPassScore(e.target.value)}
                    className="w-full p-2 rounded-lg border text-sm font-bold bg-white dark:bg-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModuleModal(false)}
                  className="flex-1 py-3 rounded-xl border font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer shadow-md"
                >
                  Create Module
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADD STUDY MATERIAL                                              */}
      {/* ========================================================================= */}
      {showMaterialModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl p-8 border shadow-2xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <h3 className="text-xl font-black mb-1">Add 3-Tier Study Material</h3>
            <p className="text-xs text-slate-500 mb-6">Uploaded material will be served dynamically according to learner cognitive tier.</p>

            <form onSubmit={handleAddMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">Target Cognitive Tier</label>
                <select
                  value={matLevel}
                  onChange={(e) => setMatLevel(e.target.value)}
                  className="w-full p-2.5 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                >
                  <option value="slow">Basic Tier (for Stepper / Slow Learners)</option>
                  <option value="average">Intermediate Tier (for Jogger / Medium Learners)</option>
                  <option value="fast">Advanced Tier (for Glider / Fast Learners)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Material Title</label>
                <input
                  type="text"
                  required
                  value={matTitle}
                  onChange={(e) => setMatTitle(e.target.value)}
                  placeholder="e.g. Fundamental Concepts & Intuitive Walkthrough"
                  className="w-full p-2.5 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Content Body (Notes, Text or HTML)</label>
                <textarea
                  rows={4}
                  required
                  value={matContent}
                  onChange={(e) => setMatContent(e.target.value)}
                  placeholder="Enter lesson summary, code examples, or explanations..."
                  className="w-full p-2.5 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  Google Docs Link (Optional)
                  <span className="block text-[11px] font-normal text-slate-500">Only Google Docs or Google Drive links allowed (no file uploads)</span>
                </label>
                <input
                  type="url"
                  value={matPdf}
                  onChange={(e) => setMatPdf(e.target.value)}
                  placeholder="https://docs.google.com/document/d/... or https://drive.google.com/..."
                  className={`w-full p-2.5 rounded-xl border text-sm ${
                    matPdf && !isValidGoogleDocsUrl(matPdf) 
                      ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20' 
                      : 'bg-slate-50 dark:bg-slate-800'
                  }`}
                />
                {matPdf && !isValidGoogleDocsUrl(matPdf) && (
                  <p className="text-red-500 text-[11px] mt-1 font-medium">
                    ⚠️ Must be a valid Google Docs or Google Drive link (e.g. https://docs.google.com/document/d/...)
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                <input
                  type="checkbox"
                  id="matIsBonus"
                  checked={matIsBonus}
                  onChange={(e) => setMatIsBonus(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="matIsBonus" className="text-xs font-semibold text-purple-900 dark:text-purple-300 cursor-pointer">
                  Lock as Mentor Mystery Box Material (Bonus unlockable content)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowMaterialModal(false)}
                  className="flex-1 py-3 rounded-xl border font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm cursor-pointer shadow-md"
                >
                  Save Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: ADD QUIZ QUESTION                                               */}
      {/* ========================================================================= */}
      {showQuizModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-xl rounded-3xl p-8 border shadow-2xl my-8 ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <h3 className="text-xl font-black mb-1">Add Quiz Question</h3>
            <p className="text-xs text-slate-500 mb-6">Define Bloom's level, difficulty level, and optional Visionary feedback explanation.</p>

            <form onSubmit={handleAddQuiz} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Difficulty Level</label>
                  <select
                    value={qDifficulty}
                    onChange={(e) => setQDifficulty(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="slow">Easy (Q_easy)</option>
                    <option value="average">Medium (Q_med)</option>
                    <option value="fast">Hard (Q_hard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Bloom's Taxonomy Level</label>
                  <select
                    value={bloomsLevel}
                    onChange={(e) => setBloomsLevel(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Remembering">Remembering</option>
                    <option value="Understanding">Understanding</option>
                    <option value="Applying">Applying</option>
                    <option value="Analyzing">Analyzing</option>
                    <option value="Evaluating">Evaluating</option>
                    <option value="Creating">Creating</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Question Statement</label>
                <textarea
                  rows={3}
                  required
                  value={qText}
                  onChange={(e) => setQText(e.target.value)}
                  placeholder="e.g. Which of the following operations takes O(1) time in an array?"
                  className="w-full p-2.5 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Option A</label>
                  <input
                    type="text"
                    required
                    value={optA}
                    onChange={(e) => setOptA(e.target.value)}
                    className="w-full p-2 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Option B</label>
                  <input
                    type="text"
                    required
                    value={optB}
                    onChange={(e) => setOptB(e.target.value)}
                    className="w-full p-2 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Option C</label>
                  <input
                    type="text"
                    required
                    value={optC}
                    onChange={(e) => setOptC(e.target.value)}
                    className="w-full p-2 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">Option D</label>
                  <input
                    type="text"
                    required
                    value={optD}
                    onChange={(e) => setOptD(e.target.value)}
                    className="w-full p-2 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Correct Answer</label>
                  <select
                    value={correctOpt}
                    onChange={(e) => setCorrectOpt(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-bold bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-slate-800 dark:text-emerald-400"
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Target PT-LS Archetype</label>
                  <select
                    value={targetPtLs}
                    onChange={(e) => setTargetPtLs(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Universal">Universal (All Archetypes)</option>
                    <option value="Visionaries">Visionaries</option>
                    <option value="Mentors">Mentors</option>
                    <option value="Conquerors">Conquerors</option>
                    <option value="Pioneers">Pioneers</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Hint Text (Shown when student uses Hint lifeline)</label>
                <input
                  type="text"
                  value={hintText}
                  onChange={(e) => setHintText(e.target.value)}
                  placeholder="e.g. Think about index access..."
                  className="w-full p-2 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                />
              </div>


              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowQuizModal(false)}
                  className="flex-1 py-3 rounded-xl border font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm cursor-pointer shadow-md"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: ADD TASK CHALLENGE (PROGRAMMING & DESCRIPTIVE)                   */}
      {/* ========================================================================= */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className={`w-full max-w-xl rounded-3xl p-8 border shadow-2xl my-8 ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <h3 className="text-xl font-black mb-1">Add Task Challenge</h3>
            <p className="text-xs text-slate-500 mb-6">Assign coding challenges with sandbox compilers or descriptive open-ended questions.</p>

            <form onSubmit={handleAddTask} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Task Type</label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="programming">Programming (Multi-Compiler Workbench)</option>
                    <option value="descriptive">Descriptive (Textbox Essay / Analysis)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Task Complexity (QLC)</label>
                  <select
                    value={taskComplexity}
                    onChange={(e) => setTaskComplexity(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="basic">Basic (QLC: Basic Challenge)</option>
                    <option value="intermediate">Intermediate (QLC: Standard)</option>
                    <option value="advanced">Advanced (QLC: High Challenge)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">Bloom's Taxonomy Level</label>
                  <select
                    value={taskBlooms}
                    onChange={(e) => setTaskBlooms(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Remembering">Remembering</option>
                    <option value="Understanding">Understanding</option>
                    <option value="Applying">Applying</option>
                    <option value="Analyzing">Analyzing</option>
                    <option value="Evaluating">Evaluating</option>
                    <option value="Creating">Creating</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Target PT-LS Archetype</label>
                  <select
                    value={taskTargetPtLs}
                    onChange={(e) => setTaskTargetPtLs(e.target.value)}
                    className="w-full p-2.5 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                  >
                    <option value="Universal">Universal (All Archetypes)</option>
                    <option value="Visionaries">Visionaries</option>
                    <option value="Mentors">Mentors</option>
                    <option value="Conquerors">Conquerors</option>
                    <option value="Pioneers">Pioneers</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  placeholder="e.g. Implement Reverse Linked List in C"
                  className="w-full p-2.5 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Problem Statement / Questions</label>
                <textarea
                  rows={4}
                  required
                  value={taskStatement}
                  onChange={(e) => setTaskStatement(e.target.value)}
                  placeholder="Copy and paste the challenge requirements, input/output specifications, and constraints..."
                  className="w-full p-2.5 rounded-xl border text-sm bg-slate-50 dark:bg-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Google Docs Link (Optional)
                    <span className="block text-[11px] font-normal text-slate-500">Only Google Docs or Google Drive links allowed (no file uploads)</span>
                  </label>
                  <input
                    type="url"
                    value={taskPdf}
                    onChange={(e) => setTaskPdf(e.target.value)}
                    placeholder="https://docs.google.com/document/d/..."
                    className={`w-full p-2 rounded-xl border text-sm ${
                      taskPdf && !isValidGoogleDocsUrl(taskPdf) 
                        ? 'border-red-500 bg-red-50/30 dark:bg-red-950/20' 
                        : 'bg-slate-50 dark:bg-slate-800'
                    }`}
                  />
                  {taskPdf && !isValidGoogleDocsUrl(taskPdf) && (
                    <p className="text-red-500 text-[11px] mt-1 font-medium">
                      ⚠️ Must be a valid Google Docs or Google Drive link
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1">Max Marks</label>
                  <input
                    type="number"
                    min="10"
                    max="100"
                    value={taskMaxMarks}
                    onChange={(e) => setTaskMaxMarks(e.target.value)}
                    className="w-full p-2 rounded-xl border text-sm font-bold bg-slate-50 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800">
                <input
                  type="checkbox"
                  id="taskIsBonus"
                  checked={taskIsBonus}
                  onChange={(e) => setTaskIsBonus(e.target.checked)}
                  className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="taskIsBonus" className="text-xs font-semibold text-purple-900 dark:text-purple-300 cursor-pointer">
                  Lock as Mentor Mystery Box Task (Bonus unlockable challenge)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="flex-1 py-3 rounded-xl border font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm cursor-pointer shadow-md"
                >
                  Save Task Challenge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: BULK UPLOAD QUIZ (EXCEL / CSV)                                  */}
      {/* ========================================================================= */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl p-8 border shadow-2xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black">Bulk Upload Quiz Questions</h3>
                <p className="text-xs text-slate-500">Quickly upload multiple MCQs via Excel or CSV</p>
              </div>
            </div>

            {/* Step 1: Download Template */}
            <div className={`p-4 rounded-2xl border my-4 ${isLight ? 'bg-emerald-50/50 border-emerald-200' : 'bg-emerald-950/20 border-emerald-800/60'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Step 1: Download Template</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Pre-formatted .xlsx with columns for Question, Options A-D, Answer, Level & Feedback.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer transition"
                >
                  <Download className="w-3.5 h-3.5" /> Template
                </button>
              </div>
            </div>

            {/* Step 2: Upload Filled File */}
            <form onSubmit={handleBulkUploadExcel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Step 2: Choose Filled Excel or CSV File
                </label>
                <div className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                  isLight ? 'border-slate-300 hover:border-emerald-500 bg-slate-50' : 'border-slate-700 hover:border-emerald-500 bg-slate-950/40'
                }`}>
                  <input
                    type="file"
                    id="excelFileInput"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => {
                      setExcelFile(e.target.files[0] || null);
                      setExcelError('');
                      setExcelMsg('');
                    }}
                    className="hidden"
                  />
                  <label htmlFor="excelFileInput" className="cursor-pointer block">
                    <UploadCloud className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
                    {excelFile ? (
                      <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {excelFile.name} ({(excelFile.size / 1024).toFixed(1)} KB)
                      </p>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Click to select .xlsx or .csv file
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Supports Excel (.xlsx) and CSV formats
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {excelError && (
                <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{excelError}</span>
                </div>
              )}

              {excelMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{excelMsg}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowExcelModal(false);
                    setExcelFile(null);
                    setExcelError('');
                    setExcelMsg('');
                  }}
                  className="flex-1 py-3 rounded-xl border font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingExcel || !excelFile}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm cursor-pointer shadow-md flex items-center justify-center gap-2 transition"
                >
                  {uploadingExcel ? 'Importing Questions...' : 'Import to Quiz'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: BULK UPLOAD TASK CHALLENGES (EXCEL / CSV)                       */}
      {/* ========================================================================= */}
      {showTaskExcelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className={`w-full max-w-lg rounded-3xl p-8 border shadow-2xl ${
            isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
          }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-black">Bulk Upload Task Challenges</h3>
                <p className="text-xs text-slate-500">Upload multiple coding and descriptive challenges via Excel or CSV</p>
              </div>
            </div>

            {/* Step 1: Download Template */}
            <div className={`p-4 rounded-2xl border my-4 ${isLight ? 'bg-purple-50/50 border-purple-200' : 'bg-purple-950/20 border-purple-800/60'}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs font-bold text-purple-800 dark:text-purple-300">Step 1: Download Template</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Pre-formatted .xlsx with columns for Title, Complexity (Basic/Med/Hard), Type, Bloom's Level, Statement, Code & Tests.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTaskTemplate}
                  className="px-3 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer transition"
                >
                  <Download className="w-3.5 h-3.5" /> Template
                </button>
              </div>
            </div>

            {/* Step 2: Upload Filled File */}
            <form onSubmit={handleBulkUploadTaskExcel} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Step 2: Choose Filled Excel or CSV File
                </label>
                <div className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                  isLight ? 'border-slate-300 hover:border-purple-500 bg-slate-50' : 'border-slate-700 hover:border-purple-500 bg-slate-950/40'
                }`}>
                  <input
                    type="file"
                    id="taskExcelFileInput"
                    accept=".xlsx, .xls, .csv"
                    onChange={(e) => {
                      setTaskExcelFile(e.target.files[0] || null);
                      setTaskExcelError('');
                      setTaskExcelMsg('');
                    }}
                    className="hidden"
                  />
                  <label htmlFor="taskExcelFileInput" className="cursor-pointer block">
                    <UploadCloud className="w-8 h-8 mx-auto text-purple-600 mb-2" />
                    {taskExcelFile ? (
                      <p className="text-xs font-bold text-purple-600 dark:text-purple-400">
                        {taskExcelFile.name} ({(taskExcelFile.size / 1024).toFixed(1)} KB)
                      </p>
                    ) : (
                      <>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Click to select .xlsx or .csv file
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Supports Excel (.xlsx) and CSV formats
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {taskExcelError && (
                <div className="p-3 rounded-xl bg-red-100 border border-red-300 text-red-700 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{taskExcelError}</span>
                </div>
              )}

              {taskExcelMsg && (
                <div className="p-3 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{taskExcelMsg}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTaskExcelModal(false);
                    setTaskExcelFile(null);
                    setTaskExcelError('');
                    setTaskExcelMsg('');
                  }}
                  className="flex-1 py-3 rounded-xl border font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingTaskExcel || !taskExcelFile}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold text-sm cursor-pointer shadow-md flex items-center justify-center gap-2 transition"
                >
                  {uploadingTaskExcel ? 'Importing Challenges...' : 'Import to Tasks'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

