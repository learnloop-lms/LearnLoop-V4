import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Gamepad2, Users, Crown, Clock, Coffee, Shield, CheckCircle2,
  AlertTriangle, MessageSquare, Play, Send, ChevronRight, Check,
  X, Bug, Award, RefreshCw, Sparkles, FileText, Share2, Layers,
  Terminal, Edit3, ArrowRight, Star, ShieldAlert, ShieldCheck,
  ArrowDown, ArrowUp, GitBranch, CornerDownRight, Maximize2,
  CheckSquare, MessageCircle, AlertCircle, CornerDownLeft
} from 'lucide-react';

export default function CollaborativeGameZone() {
  const { teamId } = useParams();
  const { user, API_BASE } = useAuth();
  const { isLight } = useTheme();
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // Anti-Cheat & Game Zone Arena Lockdown
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [showStrikeWarning, setShowStrikeWarning] = useState(false);

  // Non-blocking Toast & Sync indicator
  const [toastMsg, setToastMsg] = useState(null);
  const [syncStatus, setSyncStatus] = useState('saved'); // 'saved' | 'saving' | 'error'

  // Center: Code & Terminal
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [stdinInput, setStdinInput] = useState('');
  const [compilerOutput, setCompilerOutput] = useState('');
  const [runningCode, setRunningCode] = useState(false);
  const [testResults, setTestResults] = useState([]);

  // Code Editor Refs for Cursor Preservation
  const textareaRef = useRef(null);
  const cursorPositionRef = useRef(null);
  const isTypingCodeRef = useRef(false);

  // Mentor & Conqueror Google Docs-style Comments
  const [commentTarget, setCommentTarget] = useState(null); // { target_type, target_id_or_line, label }
  const [newCommentText, setNewCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [commentFilter, setCommentFilter] = useState('all'); // 'all' | 'unresolved' | 'resolved' | 'conqueror'
  
  // Mentor & Conqueror Brainstorm Replies
  const [activeReplyId, setActiveReplyId] = useState(null);
  const [replyTexts, setReplyTexts] = useState({});

  // Right Side: Flowchart & Algorithm & Reviews
  const [algorithmText, setAlgorithmText] = useState('');
  const [flowchartNodes, setFlowchartNodes] = useState([]);
  const [selectedShape, setSelectedShape] = useState('process');
  const [shapeLabel, setShapeLabel] = useState('');
  const [decisionYesLabel, setDecisionYesLabel] = useState('Continue / Proceed');
  const [decisionNoLabel, setDecisionNoLabel] = useState('Loop back / Alternative');
  const [activeTabRight, setActiveTabRight] = useState('flowchart'); // 'flowchart' | 'algorithm' | 'reviews'

  // Conqueror Bug Report Modal
  const [showBugModal, setShowBugModal] = useState(false);
  const [bugDesc, setBugDesc] = useState('');
  const [bugSuggestedCode, setBugSuggestedCode] = useState('');

  // Chat Drawer
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // Inactivity Monitor & Break
  const [showIdlePrompt, setShowIdlePrompt] = useState(false);
  const lastActionRef = useRef(Date.now());
  const saveTimeoutRef = useRef(null);
  const savePlanTimeoutRef = useRef(null);

  // Post Challenge Peer Review Modal
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviews, setReviews] = useState({});
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [awardedPoints, setAwardedPoints] = useState(0);
  const [optedRoleSwitch, setOptedRoleSwitch] = useState('');

  const showToast = (message, type = 'success') => {
    setToastMsg({ message, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const recordUserAction = () => {
    lastActionRef.current = Date.now();
    if (showIdlePrompt) setShowIdlePrompt(false);
  };

  // Cursor Preservation: Restore cursor position after state updates so it NEVER jumps to the end!
  useLayoutEffect(() => {
    if (
      textareaRef.current &&
      document.activeElement === textareaRef.current &&
      cursorPositionRef.current !== null
    ) {
      textareaRef.current.selectionStart = cursorPositionRef.current;
      textareaRef.current.selectionEnd = cursorPositionRef.current;
    }
  }, [code]);

  // Poll workspace state every 4 seconds for real-time collaboration
  useEffect(() => {
    fetchWorkspace();
    const interval = setInterval(fetchWorkspace, 4000);
    return () => clearInterval(interval);
  }, [teamId]);

  // Fullscreen Lockdown Auto-entry and Cleanup
  useEffect(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    return () => {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    };
  }, []);

  // Anti-Cheat: Tab Switch Restriction (Does NOT disrupt code editor shortcuts!)
  useEffect(() => {
    const isCompleted = data?.team?.status === 'COMPLETED' || data?.team?.status === 'TIMEOUT';
    if (isCompleted) return;

    const handleKeyDown = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input') {
        return;
      }

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

    const handleCopy = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input') return;
      e.preventDefault();
      setShowStrikeWarning(true);
    };
    const handleCut = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input') return;
      e.preventDefault();
      setShowStrikeWarning(true);
    };
    const handlePaste = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input') return;
      e.preventDefault();
      setShowStrikeWarning(true);
    };
    const handleContextMenu = (e) => {
      const tag = (e.target?.tagName || '').toLowerCase();
      if (tag === 'textarea' || tag === 'input') return;
      e.preventDefault();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setStrikes((prev) => prev + 1);
        setShowStrikeWarning(true);
        axios.post(`${API_BASE}/collab/student/teams/${teamId}/focus`, { event: 'away' }).catch(() => {});
      } else {
        axios.post(`${API_BASE}/collab/student/teams/${teamId}/focus`, { event: 'returned' }).catch(() => {});
      }
    };

    const handleFullscreenChange = () => {
      const isFull = Boolean(document.fullscreenElement);
      setIsFullscreen(isFull);
      if (!isFull) {
        setShowStrikeWarning(true);
      }
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
  }, [teamId, data]);

  // Timer countdown local tick
  useEffect(() => {
    const t = setInterval(() => {
      setTimerSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Idle check (5 minutes threshold)
  useEffect(() => {
    const checkIdle = setInterval(() => {
      const now = Date.now();
      if (now - lastActionRef.current > 5 * 60 * 1000 && !data?.me?.is_on_break) {
        setShowIdlePrompt(true);
      }
    }, 15000);
    return () => clearInterval(checkIdle);
  }, [data]);

  const fetchWorkspace = async () => {
    try {
      const res = await axios.get(`${API_BASE}/collab/student/teams/${teamId}/workspace`);
      const ws = res.data;
      setData(ws);
      setTimerSeconds(ws.team.remaining_seconds);
      
      const isPioneerRole = ws.me.role === 'Pioneer';
      const isLeaderRole = ws.me.is_leader;

      // Pioneer maintains local typing state; teammates receive live code updates!
      if (!isPioneerRole && !isLeaderRole) {
        setCode(ws.workspace.code_content || '');
      } else if (code === '' && ws.workspace.code_content) {
        setCode(ws.workspace.code_content);
      }

      // Visionary maintains local planning state; teammates receive live flowchart updates!
      const isVisionaryRole = ws.me.role === 'Visionary';
      if (!isVisionaryRole && !isLeaderRole) {
        setAlgorithmText(ws.workspace.algorithm_text || '');
        if (ws.workspace.flowchart_data?.nodes) {
          setFlowchartNodes(ws.workspace.flowchart_data.nodes);
        }
      } else {
        if (algorithmText === '' && ws.workspace.algorithm_text) {
          setAlgorithmText(ws.workspace.algorithm_text);
        }
        if (flowchartNodes.length === 0 && ws.workspace.flowchart_data?.nodes) {
          setFlowchartNodes(ws.workspace.flowchart_data.nodes);
        }
      }

      setCompilerOutput(ws.workspace.compiler_output || '');

      // Trigger review modal if finished and reviews not yet submitted
      if ((ws.team.status === 'COMPLETED' || ws.team.status === 'TIMEOUT') && !reviewSubmitted) {
        setShowReviewModal(true);
      }
    } catch (err) {
      console.error('Error fetching game zone:', err);
    } finally {
      setLoading(false);
    }
  };

  // Perform Role Action
  const handleAction = async (actionType, details = {}, isSilent = false) => {
    recordUserAction();
    if (isSilent) setSyncStatus('saving');
    try {
      const res = await axios.post(`${API_BASE}/collab/student/teams/${teamId}/action`, {
        action_type: actionType,
        details
      });
      if (isSilent) {
        setSyncStatus('saved');
      } else {
        showToast(res.data.message, 'success');
        fetchWorkspace();
      }
    } catch (err) {
      if (isSilent) {
        setSyncStatus('error');
      } else {
        showToast(err.response?.data?.detail || 'Action failed.', 'error');
      }
    }
  };

  // Google Docs-style Code Editing for Pioneer
  const handleCodeChange = (e) => {
    const newCode = e.target.value;
    cursorPositionRef.current = e.target.selectionStart;
    isTypingCodeRef.current = true;
    setCode(newCode);

    const isPioneer = data?.me?.role === 'Pioneer';
    const isLeader = data?.me?.is_leader;
    if (isPioneer || isLeader) {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        isTypingCodeRef.current = false;
        handleAction('UpdateCode', { code_content: newCode, code_language: language }, true);
      }, 1200);
    }
  };

  const handleCodeKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const val = e.target.value;
      const updated = val.substring(0, start) + '    ' + val.substring(end);
      cursorPositionRef.current = start + 4;
      setCode(updated);

      const isPioneer = data?.me?.role === 'Pioneer';
      const isLeader = data?.me?.is_leader;
      if (isPioneer || isLeader) {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          handleAction('UpdateCode', { code_content: updated, code_language: language }, true);
        }, 1200);
      }
    }
  };

  // Debounced Algorithm Change
  const handleAlgorithmChange = (newAlgo) => {
    setAlgorithmText(newAlgo);
    const isVisionary = data?.me?.role === 'Visionary';
    const isLeader = data?.me?.is_leader;
    if (isVisionary || isLeader) {
      if (savePlanTimeoutRef.current) clearTimeout(savePlanTimeoutRef.current);
      savePlanTimeoutRef.current = setTimeout(() => {
        handleAction('UpdatePlan', { flowchart_data: { nodes: flowchartNodes, edges: [] }, algorithm_text: newAlgo }, true);
      }, 1200);
    }
  };

  // Run Code & Tests
  const handleRunCode = async () => {
    recordUserAction();
    setRunningCode(true);
    try {
      const res = await axios.post(`${API_BASE}/collab/student/teams/${teamId}/run-code`, {
        code,
        language,
        stdin_input: stdinInput
      });
      setCompilerOutput(res.data.output || res.data.error || 'Execution completed with no output.');
      setTestResults(res.data.test_results || []);
      fetchWorkspace();
      showToast('Execution completed!', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Code execution failed.', 'error');
    } finally {
      setRunningCode(false);
    }
  };

  // Selection Comment Triggers
  const handleCodeMouseUp = (e) => {
    const isMentor = data?.me?.role === 'Mentor';
    const isConqueror = data?.me?.role === 'Conqueror';
    const isLeader = data?.me?.is_leader;
    if (!isMentor && !isConqueror && !isLeader) return;

    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return;

    const textBefore = textarea.value.substring(0, start);
    const lineNum = textBefore.split('\n').length;
    const selectedSnippet = textarea.value.substring(start, end);

    const roleTitle = isConqueror ? 'Conqueror Bug Flag' : isMentor ? 'Mentor Review' : 'Leader Note';
    setCommentTarget({
      target_type: 'code_line',
      target_id_or_line: String(lineNum),
      label: `${roleTitle} on Line ${lineNum}: "${selectedSnippet.slice(0, 25)}..."`
    });
  };

  const handleProblemSelection = () => {
    const isConqueror = data?.me?.role === 'Conqueror';
    const isMentor = data?.me?.role === 'Mentor';
    const isLeader = data?.me?.is_leader;
    if (!isConqueror && !isMentor && !isLeader) return;

    const sel = window.getSelection()?.toString();
    if (!sel || !sel.trim()) return;

    const roleTitle = isConqueror ? 'Conqueror Test Strategy & Flow Guidance' : isMentor ? 'Mentor Problem Note' : 'Leader Note';
    setCommentTarget({
      target_type: 'problem_guidance',
      target_id_or_line: 'problem_spec',
      label: `${roleTitle}: "${sel.slice(0, 30)}..."`
    });
  };

  const handleCompilerSelection = () => {
    const isMentor = data?.me?.role === 'Mentor';
    const isConqueror = data?.me?.role === 'Conqueror';
    const isLeader = data?.me?.is_leader;
    if (!isMentor && !isConqueror && !isLeader) return;

    const sel = window.getSelection()?.toString();
    if (!sel || !sel.trim()) return;

    const roleTitle = isConqueror ? 'Conqueror Bug / Execution Flag' : 'Mentor Review';
    setCommentTarget({
      target_type: 'compiler_output',
      target_id_or_line: 'compiler',
      label: `${roleTitle}: "${sel.slice(0, 25)}..."`
    });
  };

  const handleAlgorithmMouseUp = (e) => {
    const isMentor = data?.me?.role === 'Mentor';
    const isConqueror = data?.me?.role === 'Conqueror';
    const isLeader = data?.me?.is_leader;
    if (!isMentor && !isConqueror && !isLeader) return;

    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start === end) return;

    const textBefore = textarea.value.substring(0, start);
    const lineNum = textBefore.split('\n').length;
    const sel = textarea.value.substring(start, end);

    setCommentTarget({
      target_type: 'algorithm_line',
      target_id_or_line: `algo_${lineNum}`,
      label: `Algorithm Step ${lineNum}: "${sel.slice(0, 25)}..."`
    });
  };

  const handleShapeSelectForComment = (node, idx) => {
    const isMentor = data?.me?.role === 'Mentor';
    const isConqueror = data?.me?.role === 'Conqueror';
    const isLeader = data?.me?.is_leader;
    if (!isMentor && !isConqueror && !isLeader) return;

    setCommentTarget({
      target_type: 'flowchart_shape',
      target_id_or_line: node.id,
      label: `Flowchart Step #${idx + 1} (${node.type.toUpperCase()}: "${node.label.slice(0, 20)}")`
    });
  };

  // Add Comment (Google Docs style)
  const handleAddComment = async (customTarget = null, customText = null) => {
    recordUserAction();
    const target = customTarget || commentTarget;
    const text = customText || newCommentText;
    if (!text.trim() || !target) return;
    setPostingComment(true);
    try {
      await axios.post(`${API_BASE}/collab/student/teams/${teamId}/comments`, {
        target_type: target.target_type,
        target_id_or_line: String(target.target_id_or_line),
        comment_text: text.trim(),
        is_leader_note: data?.me?.is_leader || false
      });
      setNewCommentText('');
      setCommentTarget(null);
      showToast('Comment posted to team review feed!', 'success');
      fetchWorkspace();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to post comment.', 'error');
    } finally {
      setPostingComment(false);
    }
  };

  // Mentor & Conqueror Reply / Brainstorm Discussion
  const handleSendReply = async (parentCommentId) => {
    const replyText = (replyTexts[parentCommentId] || '').trim();
    if (!replyText) return;
    recordUserAction();
    setPostingComment(true);
    try {
      await axios.post(`${API_BASE}/collab/student/teams/${teamId}/comments`, {
        target_type: 'reply',
        target_id_or_line: parentCommentId,
        comment_text: replyText,
        is_leader_note: data?.me?.is_leader || false
      });
      setReplyTexts(prev => ({ ...prev, [parentCommentId]: '' }));
      setActiveReplyId(null);
      showToast('Brainstorm discussion reply posted!', 'success');
      fetchWorkspace();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to post reply.', 'error');
    } finally {
      setPostingComment(false);
    }
  };

  // Mark Comment as Resolved / "I Understood"
  const handleResolveComment = async (commentId) => {
    recordUserAction();
    try {
      await axios.post(`${API_BASE}/collab/student/teams/${teamId}/comments/${commentId}/resolve`);
      showToast('Acknowledged / Resolved ✓', 'success');
      fetchWorkspace();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to acknowledge comment.', 'error');
    }
  };

  // Toggle Break Pool
  const handleToggleBreak = async () => {
    recordUserAction();
    const action = data?.me?.is_on_break ? 'end' : 'start';
    try {
      await axios.post(`${API_BASE}/collab/student/teams/${teamId}/break`, { action });
      fetchWorkspace();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Break toggle failed.', 'error');
    }
  };

  // Send Chat
  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    recordUserAction();
    try {
      await axios.post(`${API_BASE}/collab/student/teams/${teamId}/chat`, {
        message: chatInput
      });
      setChatInput('');
      fetchWorkspace();
    } catch (err) {
      console.error(err);
    }
  };

  // Flowchart Canvas Helpers
  const addFlowchartNode = () => {
    recordUserAction();
    if (!shapeLabel.trim()) return;
    const newNode = {
      id: `shape_${Date.now()}`,
      type: selectedShape,
      label: shapeLabel,
      yesLabel: selectedShape === 'decision' ? decisionYesLabel : undefined,
      noLabel: selectedShape === 'decision' ? decisionNoLabel : undefined
    };
    const updated = [...flowchartNodes, newNode];
    setFlowchartNodes(updated);
    setShapeLabel('');
    const isVisionary = data?.me?.role === 'Visionary';
    const isLeader = data?.me?.is_leader;
    if (isVisionary || isLeader) {
      handleAction('UpdatePlan', { flowchart_data: { nodes: updated, edges: [] }, algorithm_text: algorithmText }, true);
    }
  };

  const removeFlowchartNode = (id) => {
    recordUserAction();
    const updated = flowchartNodes.filter((n) => n.id !== id);
    setFlowchartNodes(updated);
    const isVisionary = data?.me?.role === 'Visionary';
    const isLeader = data?.me?.is_leader;
    if (isVisionary || isLeader) {
      handleAction('UpdatePlan', { flowchart_data: { nodes: updated, edges: [] }, algorithm_text: algorithmText }, true);
    }
  };

  const moveNode = (index, direction) => {
    recordUserAction();
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= flowchartNodes.length) return;
    const updated = [...flowchartNodes];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIdx, 0, moved);
    setFlowchartNodes(updated);
    const isVisionary = data?.me?.role === 'Visionary';
    const isLeader = data?.me?.is_leader;
    if (isVisionary || isLeader) {
      handleAction('UpdatePlan', { flowchart_data: { nodes: updated, edges: [] }, algorithm_text: algorithmText }, true);
    }
  };

  // Submit Peer Reviews
  const handleReviewSubmit = async () => {
    const reviewList = Object.entries(reviews).map(([rateeId, val]) => ({
      ratee_id: rateeId,
      role_contribution: val.role_contribution || 5,
      reliability_timeliness: val.reliability_timeliness || 5,
      communication: val.communication || 5,
      quality_of_work: val.quality_of_work || 5,
      written_comment: val.written_comment || 'Great collaborative teammate!'
    }));

    try {
      const res = await axios.post(`${API_BASE}/collab/student/teams/${teamId}/peer-review`, {
        reviews: reviewList
      });
      setAwardedPoints(res.data.points_awarded);
      setReviewSubmitted(true);

      if (optedRoleSwitch) {
        await axios.post(`${API_BASE}/collab/student/teams/${teamId}/role-switch`, {
          new_role: optedRoleSwitch
        });
      }
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to submit reviews.', 'error');
    }
  };

  // Format Timer
  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getRoleColor = (role) => {
    const r = (role || '').toLowerCase();
    if (r.includes('visionary')) return { bg: 'bg-purple-600', text: 'text-purple-400', border: 'border-purple-500/40' };
    if (r.includes('pioneer')) return { bg: 'bg-blue-600', text: 'text-blue-400', border: 'border-blue-500/40' };
    if (r.includes('mentor')) return { bg: 'bg-emerald-600', text: 'text-emerald-400', border: 'border-emerald-500/40' };
    if (r.includes('conqueror')) return { bg: 'bg-amber-600', text: 'text-amber-400', border: 'border-amber-500/40' };
    return { bg: 'bg-slate-600', text: 'text-slate-400', border: 'border-slate-500/40' };
  };

  if (loading || !data) {
    return (
      <div className={`min-h-screen flex items-center justify-center text-sm ${
        isLight ? 'bg-slate-900 text-slate-100' : 'bg-slate-950 text-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <Gamepad2 className="w-6 h-6 animate-spin text-indigo-500" />
          <span>Entering Collaborative Game Zone...</span>
        </div>
      </div>
    );
  }

  const myRole = data.me.role;
  const isLeader = data.me.is_leader;
  const stage = data.team.current_stage;
  const isVisionary = myRole === 'Visionary';
  const isPioneer = myRole === 'Pioneer';
  const isMentor = myRole === 'Mentor';
  const isConqueror = myRole === 'Conqueror';

  // Role Permissions:
  // - Mentor & Conqueror can brainstorm and reply back-and-forth deeply.
  // - Visionary & Pioneer observe and click "I Understood" to implement.
  const canBrainstorm = isMentor || isConqueror || isLeader;
  const isWorker = isPioneer || isVisionary;

  const codeLines = code.split('\n');

  // Comments Filtering & Metrics
  const allComments = data.comments || [];
  // Primary top-level comments (not threaded replies)
  const primaryComments = allComments.filter((c) => c.target_type !== 'reply');
  const unresolvedComments = primaryComments.filter((c) => !c.is_resolved);
  const resolvedComments = primaryComments.filter((c) => c.is_resolved);
  const conquerorComments = primaryComments.filter((c) => c.author_role === 'Conqueror');
  const problemComments = primaryComments.filter((c) => c.target_type === 'problem_guidance');

  const displayedComments =
    commentFilter === 'unresolved'
      ? unresolvedComments
      : commentFilter === 'resolved'
      ? resolvedComments
      : commentFilter === 'conqueror'
      ? conquerorComments
      : primaryComments;

  return (
    <div className={`min-h-screen flex flex-col ${isLight ? 'bg-slate-900 text-slate-100' : 'bg-slate-950 text-slate-100'} font-sans select-none overflow-hidden`}>
      {/* ========================================================
          TOP BAR: ACTIVE PARTICIPANTS, ROLES, LEADER, COUNTDOWN, BREAK, COMMENTS & SYNC
          ======================================================== */}
      <header className="h-16 px-6 border-b border-slate-800 bg-slate-950/95 backdrop-blur-md flex items-center justify-between flex-shrink-0 z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              if (document.fullscreenElement && document.exitFullscreen) {
                document.exitFullscreen().catch(() => {});
              }
              navigate('/collaborative');
            }}
            className="text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
          >
            ← Hub
          </button>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <h1 className="font-black text-sm text-white flex items-center gap-2">
              <Gamepad2 className="w-4 h-4 text-indigo-400" />
              {data.challenge.title}
            </h1>
            <p className="text-[11px] text-slate-400 truncate max-w-xs">{data.challenge.course_title}</p>
          </div>

          {/* Sync Status Badge */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-800 bg-slate-900">
            {syncStatus === 'saving' && (
              <>
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-amber-400" />
                <span className="text-amber-400">Saving...</span>
              </>
            )}
            {syncStatus === 'saved' && (
              <>
                <Check className="w-2.5 h-2.5 text-emerald-400" />
                <span className="text-emerald-400">Synced ✓</span>
              </>
            )}
            {syncStatus === 'error' && (
              <span className="text-red-400">Sync Error</span>
            )}
          </div>
        </div>

        {/* Active Members Bar */}
        <div className="flex items-center gap-2">
          {data.members.map((m) => {
            const roleCol = getRoleColor(m.role);
            const isMe = m.student_id === data.me.student_id;
            return (
              <div
                key={m.student_id}
                className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-xs transition ${
                  isMe ? 'bg-slate-800 border-indigo-500/80' : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="relative">
                  <span className={`w-2 h-2 rounded-full block ${m.is_on_break ? 'bg-amber-400 animate-ping' : m.is_away ? 'bg-red-400' : 'bg-emerald-400'}`} />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-1 font-bold text-[11px] text-white">
                    {m.name} {isMe && '(You)'}
                    {m.is_leader && <Crown className="w-3 h-3 text-amber-400 fill-amber-400" title="Squad Leader" />}
                  </div>
                  <span className={`text-[9px] font-black uppercase tracking-wider block ${roleCol.text}`}>
                    {m.role} {m.is_on_break ? '• ON BREAK' : m.is_away ? '• AWAY' : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Timer, Reviews Pill & Controls */}
        <div className="flex items-center gap-3">
          {/* Team Reviews & Bug Notes Quick Button */}
          <button
            onClick={() => setActiveTabRight('reviews')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              unresolvedComments.length > 0
                ? 'bg-amber-500/20 border-amber-500 text-amber-300 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
            }`}
            title="View team reviews, brainstorm discussions and bug flags"
          >
            <MessageCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Reviews & Discussions</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
              unresolvedComments.length > 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
            }`}>
              {unresolvedComments.length}
            </span>
          </button>

          {/* Stage Badge */}
          <div className="px-2.5 py-1 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-black uppercase">
            Stage: {stage}
          </div>

          {/* Countdown Clock */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-amber-400 font-mono text-sm font-bold shadow-inner">
            <Clock className="w-4 h-4 text-amber-400" />
            <span>{formatTime(timerSeconds)}</span>
          </div>

          {/* Break Pool Button */}
          <button
            onClick={handleToggleBreak}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 cursor-pointer ${
              data.me.is_on_break
                ? 'bg-amber-500/20 border-amber-500 text-amber-400 animate-pulse'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Coffee className="w-3.5 h-3.5" />
            {data.me.is_on_break
              ? 'Resume'
              : `Break (${Math.floor(data.me.break_pool_remaining_seconds / 60)}m)`}
          </button>

          {/* Team Chat Toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
            className="p-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white cursor-pointer relative"
            title="Open Team Live Chat"
          >
            <MessageSquare className="w-4 h-4" />
            {data.messages.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-indigo-500 absolute top-1 right-1" />
            )}
          </button>
        </div>
      </header>

      {/* ========================================================
          3-COLUMN GAME ZONE WORKSPACE:
          LEFT: Problem, Conqueror Test Strategy & Test Cases
          CENTER: Code Terminal, Comments & Compiler
          RIGHT: Flowchart Canvas, Algorithm Plan & Team Reviews Feed
          ======================================================== */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* ==================== LEFT COLUMN: PROBLEM & TEST CASES ==================== */}
        <section className="w-80 border-r border-slate-800 bg-slate-950 flex flex-col overflow-y-auto">
          <div className="p-4 border-b border-slate-800 bg-slate-900/40 flex items-center justify-between">
            <h2 className="font-extrabold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-indigo-400" /> Problem Statement
            </h2>

            {/* Conqueror & Mentor Quick Add Guidance Button */}
            {(isConqueror || isMentor || isLeader) && (
              <button
                onClick={() => setCommentTarget({
                  target_type: 'problem_guidance',
                  target_id_or_line: 'problem_spec',
                  label: isConqueror ? 'Conqueror Test Strategy & Flow Guidance' : 'Problem Analysis Note'
                })}
                className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                title="Add edge cases or test strategy for the team"
              >
                <Shield className="w-3 h-3 text-amber-400" /> + Test Strategy
              </button>
            )}
          </div>

          <div className="p-4 space-y-4 flex-1">
            {/* Problem Statement Text (Selectable by Conqueror & Mentor to add notes) */}
            <div
              onMouseUp={handleProblemSelection}
              className="prose prose-invert prose-sm text-xs leading-relaxed text-slate-300 whitespace-pre-line cursor-text select-text"
              title={(isConqueror || isMentor || isLeader) ? "Highlight any text to give flow or test case guidance to teammates" : undefined}
            >
              {data.challenge.statement}
            </div>

            {/* Conqueror Test Guidance & Edge Cases Section (Visible to Everyone!) */}
            {problemComments.length > 0 && (
              <div className="space-y-2 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-amber-400" />
                    Conqueror Test Strategy & Discussions ({problemComments.length})
                  </span>
                </div>

                <div className="space-y-2.5">
                  {problemComments.map((c) => {
                    const replies = allComments.filter(r => r.target_type === 'reply' && r.target_id_or_line === c.id);
                    return (
                      <div
                        key={c.id}
                        className={`p-3 rounded-xl border text-xs space-y-2 ${
                          c.is_resolved
                            ? 'bg-slate-900/60 border-slate-800 opacity-70'
                            : 'bg-amber-950/40 border-amber-500/40'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-bold text-amber-300">
                            {c.author_name} ({c.author_role}):
                          </span>
                          <span>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-slate-200 leading-relaxed font-sans">{c.comment_text}</p>
                        
                        {/* Threaded Discussion: Mentor & Conqueror Brainstorming */}
                        {replies.length > 0 && (
                          <div className="pl-2.5 border-l-2 border-indigo-500/50 space-y-1.5 pt-1">
                            <span className="text-[9px] uppercase font-black tracking-wider text-indigo-400 block">
                              Brainstorm Discussion ({replies.length})
                            </span>
                            {replies.map(r => (
                              <div key={r.id} className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-[11px]">
                                <div className="flex items-center justify-between text-[9px] text-indigo-300 font-bold mb-0.5">
                                  <span>{r.author_name} ({r.author_role}):</span>
                                  <span>{new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p className="text-slate-200 leading-relaxed">{r.comment_text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action Bar: Brainstorm Reply for Mentor/Conqueror vs "I Understood" for Visionary/Pioneer */}
                        <div className="pt-1.5 flex items-center justify-between border-t border-slate-800/80">
                          {canBrainstorm && (
                            <button
                              onClick={() => setActiveReplyId(activeReplyId === c.id ? null : c.id)}
                              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1 cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3" />
                              {activeReplyId === c.id ? 'Cancel' : 'Reply & Brainstorm'}
                            </button>
                          )}

                          {/* Visionary and Pioneer: "I Understood" Button */}
                          {!c.is_resolved ? (
                            <button
                              onClick={() => handleResolveComment(c.id)}
                              className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg font-bold cursor-pointer ml-auto flex items-center gap-1 shadow"
                              title={isWorker ? "Click to confirm you understood the test guidance" : "Mark as resolved"}
                            >
                              <Check className="w-3 h-3" /> I Understood
                            </button>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-bold ml-auto flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Understood ✓
                            </span>
                          )}
                        </div>

                        {/* Mentor & Conqueror Inline Brainstorm Input */}
                        {canBrainstorm && activeReplyId === c.id && (
                          <div className="pt-2 flex gap-1.5">
                            <input
                              type="text"
                              value={replyTexts[c.id] || ''}
                              onChange={(e) => setReplyTexts({ ...replyTexts, [c.id]: e.target.value })}
                              placeholder={`Brainstorm & reply as ${myRole}...`}
                              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-indigo-500"
                              onKeyDown={(e) => e.key === 'Enter' && handleSendReply(c.id)}
                            />
                            <button
                              onClick={() => handleSendReply(c.id)}
                              disabled={postingComment || !(replyTexts[c.id] || '').trim()}
                              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] cursor-pointer disabled:opacity-40"
                            >
                              Send
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Test Cases Uploaded by Teacher */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Teacher Test Cases ({data.test_cases.length})
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">
                  Passed: {Math.round((data.workspace.tests_passed_ratio || 0) * 100)}%
                </span>
              </div>

              {data.test_cases.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">No teacher test cases required. Free-form problem.</p>
              ) : (
                data.test_cases.map((tc, idx) => (
                  <div key={tc.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1.5 text-xs font-mono">
                    <span className="text-[10px] font-bold text-indigo-400 block">Case #{idx + 1} {tc.is_hidden && '(Hidden)'}</span>
                    <div className="text-slate-400 text-[11px]">
                      <span className="text-slate-500">In:</span>
                      <pre className="mt-0.5 bg-slate-950 p-1.5 rounded text-[11px] whitespace-pre-wrap">
                        {tc.is_hidden ? '***' : tc.input_data || '(none)'}
                      </pre>
                    </div>
                    <div className="text-slate-300 text-[11px]">
                      <span className="text-slate-500">Expected:</span>
                      <pre className="mt-0.5 bg-slate-950 p-1.5 rounded text-[11px] text-emerald-400 whitespace-pre-wrap">
                        {tc.is_hidden ? '***' : tc.expected_output || '(none)'}
                      </pre>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Mentor Approval & Stage Status */}
            <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                Quality & Approval Checklist
              </span>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Visionary Plan:</span>
                <span className={data.workspace.plan_ready ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {data.workspace.plan_ready ? '✓ Ready' : 'In Progress'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Pioneer Draft:</span>
                <span className={data.workspace.draft_submitted ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {data.workspace.draft_submitted ? '✓ Submitted' : 'Coding'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Mentor Review:</span>
                <span className={data.workspace.mentor_approved ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                  {data.workspace.mentor_approved ? '✓ Approved' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== CENTER COLUMN: CODE TERMINAL, COMMENTS & COMPILER ==================== */}
        <section className="flex-1 flex flex-col bg-slate-900 overflow-hidden relative">
          {/* Editor Header Bar */}
          <div className="h-10 px-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-bold text-xs text-slate-300">Pioneer Code Terminal</span>
              <span className="text-[10px] text-slate-500">
                ({isPioneer || isLeader
                  ? 'Lead Coder Mode • Smooth Typing'
                  : isConqueror
                  ? 'Conqueror Bug Hunter Mode • Select Code to Flag Bugs'
                  : isMentor
                  ? 'Mentor Reviewer Mode • Select to Review'
                  : 'Team Observation Mode'})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={!isPioneer && !isLeader}
                className="bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-xs text-slate-300 focus:outline-none"
              >
                <option value="python">Python 3</option>
                <option value="c">C</option>
                <option value="cpp">C++</option>
                <option value="java">Java</option>
              </select>

              {/* Pioneer Draft Submission */}
              {(isPioneer || isLeader) && (
                <button
                  onClick={() => handleAction('SubmitDraft')}
                  className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold cursor-pointer"
                >
                  Submit Draft
                </button>
              )}

              {/* Mentor Approval Buttons */}
              {(isMentor || isLeader) && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleAction('Approve')}
                    className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Check className="w-3 h-3" /> Approve
                  </button>
                  <button
                    onClick={() => handleAction('RequestChanges')}
                    className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Request Changes
                  </button>
                </div>
              )}

              {/* Conqueror Actions */}
              {(isConqueror || isLeader) && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowBugModal(true)}
                    className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer flex items-center gap-1"
                  >
                    <Bug className="w-3 h-3" /> Report Bug
                  </button>
                  <button
                    onClick={() => handleAction('FinalSubmit')}
                    disabled={!data.workspace.mentor_approved || data.workspace.tests_passed_ratio < 1.0}
                    className={`px-3 py-1 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                      data.workspace.mentor_approved && data.workspace.tests_passed_ratio >= 1.0
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white animate-pulse'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Award className="w-3 h-3" /> Final Submit
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Line-Numbered Code Editor with Team Mentor & Conqueror Bug Indicators */}
          <div className="flex-1 flex overflow-auto font-mono text-xs bg-slate-950 relative">
            {/* Line numbers column: Shows live comment badges */}
            <div className="w-14 bg-slate-950/90 border-r border-slate-800 py-3 select-none flex flex-col items-end pr-2 text-slate-600 shrink-0">
              {codeLines.map((_, i) => {
                const lineNum = i + 1;
                const lineComments = primaryComments.filter((c) => c.target_id_or_line === String(lineNum));
                const hasUnresolved = lineComments.some((c) => !c.is_resolved);
                const hasResolved = lineComments.some((c) => c.is_resolved);
                const hasConquerorBug = lineComments.some((c) => c.author_role === 'Conqueror' && !c.is_resolved);

                return (
                  <div key={lineNum} className="h-5 flex items-center justify-end w-full group relative pr-0.5">
                    <span className="text-[10px] text-slate-600 font-mono">{lineNum}</span>
                    
                    {/* Conqueror Bug Icon */}
                    {hasConquerorBug && (
                      <button
                        onClick={() => {
                          setActiveTabRight('reviews');
                          setCommentFilter('conqueror');
                        }}
                        className="ml-1 text-[10px] text-rose-400 hover:text-rose-300 font-black cursor-pointer animate-bounce"
                        title={`Line ${lineNum} has a Conqueror Bug Flag! Click to view.`}
                      >
                        🐛
                      </button>
                    )}

                    {/* Mentor Unresolved Feedback Badge */}
                    {!hasConquerorBug && hasUnresolved && (
                      <button
                        onClick={() => {
                          setActiveTabRight('reviews');
                          setCommentFilter('unresolved');
                        }}
                        className="ml-1 text-[10px] text-amber-400 hover:text-amber-300 font-black cursor-pointer animate-pulse"
                        title={`Line ${lineNum} has unresolved feedback! Click to view.`}
                      >
                        💬
                      </button>
                    )}

                    {/* Resolved Feedback Badge */}
                    {!hasUnresolved && hasResolved && (
                      <button
                        onClick={() => {
                          setActiveTabRight('reviews');
                          setCommentFilter('resolved');
                        }}
                        className="ml-1 text-[10px] text-emerald-400 hover:text-emerald-300 cursor-pointer font-bold"
                        title={`Line ${lineNum} feedback resolved ✓`}
                      >
                        ✓
                      </button>
                    )}

                    {/* Mentor & Conqueror Line Click to Comment/Bug */}
                    {(isMentor || isConqueror || isLeader) && !hasUnresolved && !hasResolved && (
                      <button
                        onClick={() => {
                          setCommentTarget({
                            target_type: 'code_line',
                            target_id_or_line: String(lineNum),
                            label: isConqueror ? `Conqueror Bug Note on Line ${lineNum}` : `Code Line ${lineNum}`
                          });
                        }}
                        className="ml-1 opacity-0 group-hover:opacity-100 text-[11px] text-indigo-400 hover:text-white cursor-pointer font-bold"
                        title={isConqueror ? "Click to flag bug on this line" : "Click to add Mentor comment"}
                      >
                        +
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Code Content Textarea */}
            <div className="flex-1 relative py-3 pl-3">
              <textarea
                ref={textareaRef}
                value={code}
                onChange={handleCodeChange}
                onKeyDown={handleCodeKeyDown}
                onMouseUp={handleCodeMouseUp}
                readOnly={!isPioneer && !isLeader}
                spellCheck={false}
                className="w-full h-full bg-transparent text-slate-200 resize-none focus:outline-none font-mono leading-5 select-text"
                placeholder={isPioneer || isLeader ? 'Type your code here (Tab indents with 4 spaces)...' : isConqueror ? 'Pioneer code terminal. Select any code to flag bugs...' : 'Pioneer is currently coding... Select text to comment.'}
              />

              {/* Floating Google Docs-style Comment Box */}
              {commentTarget && (
                <div
                  className="fixed z-50 w-84 rounded-2xl bg-slate-900 border-2 border-indigo-500 shadow-2xl p-4 space-y-3 text-xs"
                  style={{ top: '100px', right: '400px' }}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-indigo-400 flex items-center gap-1.5 truncate">
                      {isConqueror ? <Bug className="w-4 h-4 text-rose-400 shrink-0" /> : <MessageSquare className="w-4 h-4 text-indigo-400 shrink-0" />}
                      <span className="truncate">{commentTarget.label}</span>
                    </span>
                    <button
                      onClick={() => setCommentTarget(null)}
                      className="text-slate-400 hover:text-white p-1"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Existing comments on this target */}
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {allComments
                      .filter((c) => c.target_id_or_line === String(commentTarget.target_id_or_line))
                      .map((c) => (
                        <div key={c.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-400">{c.author_name} ({c.author_role})</span>
                            <span className="text-[9px] text-slate-500">{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-slate-200 mt-1">{c.comment_text}</p>
                          <div className="mt-1 flex justify-end">
                            {!c.is_resolved ? (
                              <button
                                onClick={() => handleResolveComment(c.id)}
                                className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold"
                              >
                                {isWorker ? "I Understood ✓" : "Mark as Resolved ✓"}
                              </button>
                            ) : (
                              <span className="text-[10px] text-emerald-400 font-bold">Understood ✓</span>
                            )}
                          </div>
                        </div>
                      ))}
                    {allComments.filter((c) => c.target_id_or_line === String(commentTarget.target_id_or_line)).length === 0 && (
                      <p className="text-[11px] text-slate-500 italic">No previous comments on this element.</p>
                    )}
                  </div>

                  {/* Add new comment */}
                  <div className="space-y-2 pt-1 border-t border-slate-800">
                    <textarea
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder={isConqueror ? "Explain the bug, edge case, or expected test result..." : "Type mentor feedback or code suggestion..."}
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setCommentTarget(null)}
                        className="px-3 py-1 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-[11px]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleAddComment()}
                        disabled={postingComment || !newCommentText.trim()}
                        className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer disabled:opacity-50 text-white ${
                          isConqueror ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        {postingComment ? 'Posting...' : isConqueror ? 'Post Bug Note' : 'Post Comment'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Compiler Terminal & Custom Stdin Input */}
          <div className="h-56 border-t border-slate-800 bg-slate-950 flex flex-col flex-shrink-0">
            <div className="h-9 px-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" /> Compiler Terminal & Custom Input
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunCode}
                  disabled={runningCode}
                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Play className="w-3 h-3 fill-white" />
                  {runningCode ? 'Compiling...' : 'Run Code / Test Cases'}
                </button>
              </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
              {/* Input space to type input */}
              <div className="w-1/3 border-r border-slate-800 p-2 flex flex-col">
                <span className="text-[10px] font-bold uppercase text-slate-500 mb-1">Standard Input (stdin):</span>
                <textarea
                  value={stdinInput}
                  onChange={(e) => setStdinInput(e.target.value)}
                  placeholder="Type custom test input here..."
                  className="flex-1 bg-slate-900 border border-slate-800 rounded p-2 text-xs font-mono text-slate-200 resize-none focus:outline-none"
                />
              </div>

              {/* Output space */}
              <div
                className="flex-1 p-2 flex flex-col overflow-y-auto cursor-text"
                onMouseUp={handleCompilerSelection}
              >
                <span className="text-[10px] font-bold uppercase text-slate-500 mb-1">
                  Compiler Output {(isMentor || isConqueror || isLeader) && '(Select text to flag/comment)'}:
                </span>
                <pre className="flex-1 p-2 rounded bg-slate-900 text-xs font-mono text-emerald-300 overflow-auto whitespace-pre-wrap select-text">
                  {compilerOutput || 'Click "Run Code" to compile and view results.'}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* ==================== RIGHT COLUMN: FLOWCHART CANVAS, ALGORITHM & TEAM REVIEWS ==================== */}
        <section className="w-96 border-l border-slate-800 bg-slate-950 flex flex-col overflow-hidden">
          {/* Right Header Navigation Tabs */}
          <div className="h-10 px-2 border-b border-slate-800 bg-slate-900 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveTabRight('flowchart')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  activeTabRight === 'flowchart' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Flowchart
              </button>
              <button
                onClick={() => setActiveTabRight('algorithm')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition cursor-pointer ${
                  activeTabRight === 'algorithm' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Algorithm
              </button>
              <button
                onClick={() => setActiveTabRight('reviews')}
                className={`px-2.5 py-1 rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                  activeTabRight === 'reviews' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Reviews</span>
                {unresolvedComments.length > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-slate-950 animate-pulse">
                    {unresolvedComments.length}
                  </span>
                )}
              </button>
            </div>

            {/* Visionary Declare Plan Ready */}
            {(isVisionary || isLeader) && activeTabRight !== 'reviews' && (
              <button
                onClick={() => handleAction('PlanReady')}
                className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold cursor-pointer"
              >
                Plan Ready ✓
              </button>
            )}
          </div>

          {/* TAB 1: Flowchart Canvas */}
          {activeTabRight === 'flowchart' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Shape Tool Bar */}
              {(isVisionary || isLeader) && (
                <div className="p-3 border-b border-slate-800 bg-slate-900/60 space-y-2 text-xs">
                  <div className="flex gap-2 items-center">
                    <select
                      value={selectedShape}
                      onChange={(e) => setSelectedShape(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded px-2 py-1.5 text-slate-200 text-xs font-bold"
                    >
                      <option value="terminal">Start / End (Oval)</option>
                      <option value="process">Process (Rectangle)</option>
                      <option value="decision">Decision (Diamond + Branches)</option>
                      <option value="io">Input / Output (Parallelogram)</option>
                    </select>

                    <input
                      type="text"
                      value={shapeLabel}
                      onChange={(e) => setShapeLabel(e.target.value)}
                      placeholder={selectedShape === 'decision' ? "Condition (e.g. i < N ?)" : "Step text..."}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none"
                      onKeyDown={(e) => e.key === 'Enter' && addFlowchartNode()}
                    />

                    <button
                      onClick={addFlowchartNode}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer shrink-0"
                    >
                      + Add
                    </button>
                  </div>

                  {selectedShape === 'decision' && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div>
                        <span className="text-[10px] text-emerald-400 font-bold block mb-0.5">Yes Branch Action:</span>
                        <input
                          type="text"
                          value={decisionYesLabel}
                          onChange={(e) => setDecisionYesLabel(e.target.value)}
                          placeholder="e.g. Proceed / Execute body"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                      <div>
                        <span className="text-[10px] text-rose-400 font-bold block mb-0.5">No Branch Action:</span>
                        <input
                          type="text"
                          value={decisionNoLabel}
                          onChange={(e) => setDecisionNoLabel(e.target.value)}
                          placeholder="e.g. Exit loop / Stop"
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Visual Flowchart Canvas */}
              <div className="flex-1 p-4 overflow-auto bg-slate-950 relative space-y-4">
                {flowchartNodes.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center p-4">
                    <Layers className="w-10 h-10 mb-2 opacity-40 text-purple-400" />
                    <p className="text-xs font-bold text-slate-300">Visionary Flowchart Space</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {isVisionary || isLeader
                        ? 'Select shapes above (Start/End Oval, Process Box, Decision Diamond, I/O) to build the program logic.'
                        : 'Visionary will architect the flowchart diagram here.'}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4 pb-12">
                    {flowchartNodes.map((node, i) => {
                      const nodeComments = primaryComments.filter((c) => c.target_id_or_line === node.id);
                      const hasUnresolved = nodeComments.some((c) => !c.is_resolved);

                      return (
                        <div key={node.id} className="w-full flex flex-col items-center relative group">
                          {/* Shape Card with Real Flowchart Geometry */}
                          <div
                            onClick={() => handleShapeSelectForComment(node, i)}
                            className={`relative cursor-pointer transition-transform hover:scale-[1.02] ${
                              hasUnresolved ? 'ring-2 ring-amber-500 rounded-xl' : ''
                            }`}
                            title={(isMentor || isConqueror || isLeader) ? "Click to add comment/feedback" : undefined}
                          >
                            {/* Controls: Move Up, Down, Delete */}
                            {(isVisionary || isLeader) && (
                              <div className="absolute -top-3 -right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition bg-slate-900 border border-slate-800 rounded-lg p-1 shadow-xl">
                                <button
                                  onClick={(e) => { e.stopPropagation(); moveNode(i, -1); }}
                                  disabled={i === 0}
                                  className="p-1 hover:text-white text-slate-400 disabled:opacity-30"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); moveNode(i, 1); }}
                                  disabled={i === flowchartNodes.length - 1}
                                  className="p-1 hover:text-white text-slate-400 disabled:opacity-30"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeFlowchartNode(node.id); }}
                                  className="p-1 hover:text-red-400 text-slate-400"
                                  title="Delete Step"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}

                            {/* TYPE 1: TERMINAL (OVAL / PILL) */}
                            {node.type === 'terminal' && (
                              <div className="w-60 py-3 px-6 rounded-full border-2 border-purple-500 bg-purple-950/70 shadow-lg shadow-purple-950/40 text-center">
                                <span className="text-[10px] uppercase font-black text-purple-300 block">Start / Stop</span>
                                <p className="text-xs font-bold text-white mt-0.5">{node.label}</p>
                              </div>
                            )}

                            {/* TYPE 2: PROCESS (RECTANGLE) */}
                            {node.type === 'process' && (
                              <div className="w-64 py-3.5 px-5 rounded-lg border-2 border-blue-500 bg-blue-950/70 shadow-lg shadow-blue-950/40 text-center">
                                <span className="text-[10px] uppercase font-black text-blue-300 block">Process</span>
                                <p className="text-xs font-bold text-white mt-0.5">{node.label}</p>
                              </div>
                            )}

                            {/* TYPE 3: INPUT / OUTPUT (PARALLELOGRAM) */}
                            {node.type === 'io' && (
                              <div className="w-64 py-3.5 px-6 border-2 border-emerald-500 bg-emerald-950/70 shadow-lg shadow-emerald-950/40 transform -skew-x-12 text-center rounded">
                                <div className="transform skew-x-12">
                                  <span className="text-[10px] uppercase font-black text-emerald-300 block">Input / Output</span>
                                  <p className="text-xs font-bold text-white mt-0.5">{node.label}</p>
                                </div>
                              </div>
                            )}

                            {/* TYPE 4: DECISION (DIAMOND WITH YES/NO BRANCHES) */}
                            {node.type === 'decision' && (
                              <div className="flex flex-col items-center">
                                <div className="w-28 h-28 rotate-45 border-2 border-amber-500 bg-amber-950/80 shadow-xl shadow-amber-950/50 flex items-center justify-center rounded-sm">
                                  <div className="-rotate-45 text-center px-1">
                                    <span className="text-[9px] uppercase font-black text-amber-300 block">Decision</span>
                                    <p className="text-[11px] font-bold text-white leading-tight mt-0.5">{node.label}</p>
                                  </div>
                                </div>

                                {/* Dual Yes/No Branch Connectors */}
                                <div className="w-72 mt-3 grid grid-cols-2 gap-2 text-[10px]">
                                  <div className="p-2 rounded-xl bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 flex items-center gap-1.5 shadow">
                                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <div>
                                      <span className="font-black text-emerald-400 block uppercase">Yes Branch:</span>
                                      <span className="truncate block">{node.yesLabel || 'Continue →'}</span>
                                    </div>
                                  </div>
                                  <div className="p-2 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 flex items-center gap-1.5 shadow">
                                    <X className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                    <div>
                                      <span className="font-black text-rose-400 block uppercase">No Branch:</span>
                                      <span className="truncate block">{node.noLabel || 'Loop / Else ↓'}</span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Visible Comments Directly on this Flowchart Node */}
                            {nodeComments.length > 0 && (
                              <div className="mt-3 w-72 space-y-1.5">
                                {nodeComments.map((c) => (
                                  <div
                                    key={c.id}
                                    className={`p-2.5 rounded-xl text-left border text-[11px] space-y-1.5 ${
                                      c.is_resolved
                                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                                        : 'bg-amber-950/70 border-amber-500/70 text-amber-200 shadow-md'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between text-[10px]">
                                      <span className="font-bold text-amber-400">{c.author_name} ({c.author_role}):</span>
                                      {!c.is_resolved ? (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); handleResolveComment(c.id); }}
                                          className="text-[9px] bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-0.5 rounded font-bold cursor-pointer"
                                        >
                                          {isWorker ? "I Understood ✓" : "Resolve ✓"}
                                        </button>
                                      ) : (
                                        <span className="text-emerald-400 font-bold">Understood ✓</span>
                                      )}
                                    </div>
                                    <p className="text-slate-200 text-xs">{c.comment_text}</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Connecting Flow Arrow */}
                          {i < flowchartNodes.length - 1 && (
                            <div className="flex flex-col items-center my-1 text-slate-500">
                              <div className="w-0.5 h-4 bg-slate-700" />
                              <ArrowDown className="w-4 h-4 text-slate-500 -mt-1" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Algorithm Box */}
          {activeTabRight === 'algorithm' && (
            <div className="flex-1 flex flex-col p-3 space-y-2">
              <span className="text-[11px] font-bold text-slate-400">
                Pseudocode / Step-by-Step Logic {(isMentor || isConqueror || isLeader) && '(Select to comment)'}:
              </span>
              <textarea
                value={algorithmText}
                onChange={(e) => handleAlgorithmChange(e.target.value)}
                onMouseUp={handleAlgorithmMouseUp}
                readOnly={!isVisionary && !isLeader}
                placeholder="Step 1: Read input numbers&#10;Step 2: Validate edge cases&#10;Step 3: Compute answer..."
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs font-mono text-slate-200 resize-none focus:outline-none select-text"
              />
            </div>
          )}

          {/* TAB 3: TEAM REVIEWS, BRAINSTORM DISCUSSIONS & BUG NOTES FEED */}
          {activeTabRight === 'reviews' && (
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
              {/* Reviews Header with Filters */}
              <div className="p-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-white flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
                    Reviews, Guidance & Discussions
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Mentor & Conqueror brainstorm together • Visionary & Pioneer review & understand
                  </p>
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                  <button
                    onClick={() => setCommentFilter('all')}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      commentFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    All ({primaryComments.length})
                  </button>
                  <button
                    onClick={() => setCommentFilter('unresolved')}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      commentFilter === 'unresolved' ? 'bg-amber-500 text-black' : 'text-slate-400'
                    }`}
                  >
                    Open ({unresolvedComments.length})
                  </button>
                  <button
                    onClick={() => setCommentFilter('conqueror')}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      commentFilter === 'conqueror' ? 'bg-rose-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Bugs ({conquerorComments.length})
                  </button>
                  <button
                    onClick={() => setCommentFilter('resolved')}
                    className={`px-2 py-0.5 rounded font-bold transition cursor-pointer ${
                      commentFilter === 'resolved' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    Fixed ({resolvedComments.length})
                  </button>
                </div>
              </div>

              {/* Comments Feed List */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3">
                {displayedComments.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400/50 mb-2" />
                    <p className="text-xs font-bold text-slate-300">All Clear!</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {commentFilter === 'unresolved'
                        ? 'No open items! Great teamwork.'
                        : 'No notes posted yet under this filter.'}
                    </p>
                  </div>
                ) : (
                  displayedComments.map((c) => {
                    const isConq = c.author_role === 'Conqueror';
                    const threadReplies = allComments.filter(r => r.target_type === 'reply' && r.target_id_or_line === c.id);

                    return (
                      <div
                        key={c.id}
                        className={`p-3.5 rounded-2xl border transition shadow-sm space-y-2.5 ${
                          c.is_resolved
                            ? 'bg-slate-900/40 border-slate-800 opacity-75'
                            : isConq
                            ? 'bg-slate-900 border-rose-500/50 shadow-rose-500/5'
                            : 'bg-slate-900 border-amber-500/40 shadow-amber-500/5'
                        }`}
                      >
                        {/* Comment Header: Target & Status */}
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold flex items-center gap-1">
                            {isConq ? (
                              <span className="text-rose-400 flex items-center gap-1">
                                <Bug className="w-3.5 h-3.5" />
                                {c.target_type === 'code_line'
                                  ? `Conqueror Bug Note (Line ${c.target_id_or_line})`
                                  : c.target_type === 'problem_guidance'
                                  ? 'Conqueror Test Strategy & Edge Case'
                                  : c.target_type}
                              </span>
                            ) : (
                              <span className="text-indigo-400 flex items-center gap-1">
                                📌 {c.target_type === 'code_line'
                                  ? `Code Line ${c.target_id_or_line}`
                                  : c.target_type === 'flowchart_shape'
                                  ? 'Flowchart Step'
                                  : c.target_type === 'problem_guidance'
                                  ? 'Problem Strategy'
                                  : c.target_type}
                              </span>
                            )}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            c.is_resolved
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : isConq
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}>
                            {c.is_resolved ? 'Understood ✓' : isConq ? 'Bug Flagged' : 'Pending Correction'}
                          </span>
                        </div>

                        {/* Author Info */}
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span className="font-bold text-slate-300">
                            {c.author_name} ({c.author_role}) {c.is_leader_note && '• Squad Leader Note'}
                          </span>
                          <span>{new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>

                        {/* Feedback Body */}
                        <p className="text-xs text-slate-200 leading-relaxed font-sans bg-slate-950 p-2.5 rounded-xl border border-slate-800/80">
                          {c.comment_text}
                        </p>

                        {/* Threaded Brainstorm Discussion Replies (Mentor & Conqueror) */}
                        {threadReplies.length > 0 && (
                          <div className="pl-3 border-l-2 border-indigo-500/50 space-y-2 pt-1">
                            <span className="text-[10px] uppercase font-black tracking-wider text-indigo-400 block">
                              Brainstorm Discussion ({threadReplies.length})
                            </span>
                            {threadReplies.map((r) => (
                              <div key={r.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-[11px] space-y-1">
                                <div className="flex items-center justify-between text-[10px]">
                                  <span className="font-bold text-indigo-300">
                                    {r.author_name} ({r.author_role}):
                                  </span>
                                  <span className="text-[9px] text-slate-500">
                                    {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-slate-200 leading-relaxed">{r.comment_text}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Action Bar: Brainstorm Reply for Mentor/Conqueror vs "I Understood" for Visionary/Pioneer */}
                        <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                          {/* Mentor & Conqueror: Reply & Brainstorm Button */}
                          {canBrainstorm && (
                            <button
                              onClick={() => setActiveReplyId(activeReplyId === c.id ? null : c.id)}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-bold flex items-center gap-1.5 cursor-pointer py-1"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              {activeReplyId === c.id ? 'Cancel Reply' : 'Reply & Brainstorm'}
                            </button>
                          )}

                          {/* Visionary & Pioneer: "I Understood" Button */}
                          {!c.is_resolved ? (
                            <button
                              onClick={() => handleResolveComment(c.id)}
                              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer flex items-center gap-1.5 shadow ml-auto"
                              title={isWorker ? "Click to acknowledge you understood and addressed this note" : "Mark as resolved"}
                            >
                              <Check className="w-3.5 h-3.5" /> I Understood
                            </button>
                          ) : (
                            <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1 ml-auto">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Understood & Acknowledged ✓
                            </span>
                          )}

                          {/* Quick Jump Buttons */}
                          {c.target_type === 'code_line' && (
                            <button
                              onClick={() => {
                                if (textareaRef.current) {
                                  textareaRef.current.focus();
                                }
                              }}
                              className="text-[10px] text-slate-400 hover:text-white ml-2"
                            >
                              Jump to Line →
                            </button>
                          )}
                          {c.target_type === 'flowchart_shape' && (
                            <button
                              onClick={() => setActiveTabRight('flowchart')}
                              className="text-[10px] text-purple-400 hover:text-white ml-2"
                            >
                              Flowchart →
                            </button>
                          )}
                        </div>

                        {/* Inline Brainstorm Input for Mentor & Conqueror */}
                        {canBrainstorm && activeReplyId === c.id && (
                          <div className="pt-2 space-y-1.5 bg-slate-950 p-2.5 rounded-xl border border-indigo-500/40">
                            <span className="text-[10px] font-bold text-indigo-300 block">
                              Discuss & Brainstorm with {c.author_role}:
                            </span>
                            <textarea
                              value={replyTexts[c.id] || ''}
                              onChange={(e) => setReplyTexts({ ...replyTexts, [c.id]: e.target.value })}
                              placeholder={`Brainstorm solution, edge case or test logic with ${c.author_role}...`}
                              rows={2}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none font-sans"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => setActiveReplyId(null)}
                                className="px-2.5 py-1 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-[10px]"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSendReply(c.id)}
                                disabled={postingComment || !(replyTexts[c.id] || '').trim()}
                                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] cursor-pointer disabled:opacity-40 flex items-center gap-1"
                              >
                                <CornerDownLeft className="w-3 h-3" /> Post Brainstorm Reply
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ========================================================
          CONQUEROR BUG REPORT MODAL
          ======================================================== */}
      {showBugModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-sm text-amber-400 flex items-center gap-2">
                <Bug className="w-4 h-4" /> Conqueror Bug Report & Suggested Fix
              </h3>
              <button onClick={() => setShowBugModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div>
              <label className="font-bold text-slate-400 block mb-1">Bug Description / Failing Case:</label>
              <textarea
                value={bugDesc}
                onChange={(e) => setBugDesc(e.target.value)}
                placeholder="Explain the failing test case or unexpected output..."
                className="w-full h-20 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-400 block mb-1">Suggested Code / Solution Snippet (Optional):</label>
              <textarea
                value={bugSuggestedCode}
                onChange={(e) => setBugSuggestedCode(e.target.value)}
                placeholder="Suggest replacement code or logic fix for Pioneer..."
                className="w-full h-24 bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowBugModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleAction('ReportBug', { description: bugDesc, suggested_code: bugSuggestedCode });
                  setShowBugModal(false);
                  setBugDesc('');
                  setBugSuggestedCode('');
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold cursor-pointer"
              >
                Dispatch Bug Report to Pioneer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          FLOATING TEAM CHAT DRAWER
          ======================================================== */}
      {showChat && (
        <div className="fixed bottom-4 right-4 z-40 w-80 h-96 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
            <span className="font-bold text-xs text-white flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400" /> Sub-team Live Chat
            </span>
            <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white text-xs">✕</button>
          </div>

          <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs">
            {data.messages.length === 0 ? (
              <p className="text-slate-500 text-center py-8 text-[11px]">No messages yet. Chat with teammates!</p>
            ) : (
              data.messages.map((m) => (
                <div key={m.id} className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-0.5">
                    <span className="font-bold text-indigo-400">{m.sender_name} ({m.sender_role})</span>
                  </div>
                  <p className="text-slate-200">{m.message}</p>
                </div>
              ))
            )}
          </div>

          <form onSubmit={handleSendChat} className="p-2 border-t border-slate-800 bg-slate-950 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Type message..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
            />
            <button type="submit" className="p-2 rounded-xl bg-indigo-600 text-white cursor-pointer">
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* ========================================================
          IDLE MONITOR POPUP (Algorithm 6: "Are you still there?")
          ======================================================== */}
      {showIdlePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-amber-500/50 p-6 text-center space-y-4 shadow-2xl">
            <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto animate-bounce" />
            <h3 className="font-extrabold text-base text-white">Are you still there?</h3>
            <p className="text-xs text-slate-400">
              No activity has been detected for 5 minutes. Click below within 1 minute to confirm you are active and avoid replacement.
            </p>
            <button
              onClick={() => {
                recordUserAction();
                setShowIdlePrompt(false);
              }}
              className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs cursor-pointer shadow-lg shadow-amber-500/20"
            >
              I'm Still Here!
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          IN-APP TOAST NOTIFICATION
          ======================================================== */}
      {toastMsg && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-3 duration-200 pointer-events-none">
          <div className={`px-5 py-2.5 rounded-2xl shadow-2xl border text-xs font-black flex items-center gap-2 backdrop-blur-md ${
            toastMsg.type === 'error'
              ? 'bg-red-500/90 border-red-400 text-white shadow-red-500/30'
              : 'bg-emerald-500/95 border-emerald-300 text-white shadow-emerald-500/30'
          }`}>
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span>{toastMsg.message}</span>
          </div>
        </div>
      )}

      {/* ========================================================
          GAME ZONE ANTI-CHEAT LOCKDOWN ALERT MODAL
          ======================================================== */}
      {showStrikeWarning && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl p-6 md:p-8 border border-red-500/50 bg-slate-950 text-white shadow-2xl text-center space-y-4 relative">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-red-400 animate-bounce" />
            </div>

            <h3 className="text-xl font-black text-red-400 tracking-tight">
              Game Zone Lockdown Alert!
            </h3>

            <p className="text-xs text-slate-300 leading-relaxed">
              Focus loss or tab switching detected. While the collaborative challenge is in session, your screen is restricted to prevent switching away or opening new tabs.
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
              Return to Collaborative Arena
            </button>
          </div>
        </div>
      )}

      {/* ========================================================
          POST-CHALLENGE PEER REVIEW & ROLE SWITCH MODAL (Algorithms 9 & 10)
          ======================================================== */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 p-6 space-y-6 shadow-2xl">
            <div className="text-center space-y-1">
              <Award className="w-12 h-12 text-amber-400 mx-auto" />
              <h2 className="font-black text-xl text-white">Challenge Concluded!</h2>
              <p className="text-xs text-slate-400">
                Status: {data.team.passed ? '✓ PASSED' : 'TIMEOUT'} • Complete mandatory peer evaluation to release points.
              </p>
            </div>

            {reviewSubmitted ? (
              <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/40 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h3 className="font-extrabold text-base text-white">Points Released!</h3>
                <p className="text-2xl font-black text-amber-400 font-mono">+{awardedPoints} Coins</p>
                <p className="text-xs text-slate-400">
                  Your points have been credited to your Learn Loop account, and your archetype has been updated.
                </p>
                <button
                  onClick={() => {
                    if (document.fullscreenElement && document.exitFullscreen) {
                      document.exitFullscreen().catch(() => {});
                    }
                    navigate('/collaborative');
                  }}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
                >
                  Return to Collaborative Hub →
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Peer Review Forms */}
                {data.members
                  .filter((m) => m.student_id !== data.me.student_id)
                  .map((teammate) => {
                    const currentRev = reviews[teammate.student_id] || {
                      role_contribution: 5,
                      reliability_timeliness: 5,
                      communication: 5,
                      quality_of_work: 5,
                      written_comment: ''
                    };

                    const updateScore = (field, val) => {
                      setReviews((prev) => ({
                        ...prev,
                        [teammate.student_id]: { ...currentRev, [field]: val }
                      }));
                    };

                    return (
                      <div key={teammate.student_id} className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-xs text-white">Rate: {teammate.name}</span>
                          <span className="text-[10px] font-bold text-indigo-400 uppercase">Role: {teammate.role}</span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          {['role_contribution', 'reliability_timeliness', 'communication', 'quality_of_work'].map((crit) => (
                            <div key={crit} className="p-2 rounded bg-slate-900 border border-slate-800">
                              <span className="text-[10px] text-slate-400 block mb-1">
                                {crit.replace('_', ' ').toUpperCase()}
                              </span>
                              <div className="flex items-center gap-1">
                                {[1, 2, 3, 4, 5].map((s) => (
                                  <button
                                    key={s}
                                    type="button"
                                    onClick={() => updateScore(crit, s)}
                                    className={`w-5 h-5 rounded text-[10px] font-bold cursor-pointer ${
                                      currentRev[crit] >= s ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-400'
                                    }`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>

                        <input
                          type="text"
                          value={currentRev.written_comment}
                          onChange={(e) => updateScore('written_comment', e.target.value)}
                          placeholder="Constructive feedback / peer comment..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                        />
                      </div>
                    );
                  })}

                {/* Algorithm 10: Role Switch Opportunity */}
                <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 space-y-2">
                  <h4 className="font-extrabold text-xs text-indigo-300">
                    Role & Learner Type Evolution (Algorithm 10)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Do you want to switch your role for upcoming challenges? If you switch, your learner archetype changes too.
                  </p>
                  <select
                    value={optedRoleSwitch}
                    onChange={(e) => setOptedRoleSwitch(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="">Keep current role ({myRole})</option>
                    <option value="Visionary">Switch to Visionary (Planner & Architect)</option>
                    <option value="Pioneer">Switch to Pioneer (Lead Coder)</option>
                    <option value="Mentor">Switch to Mentor (Reviewer & Quality Guard)</option>
                    <option value="Conqueror">Switch to Conqueror (Tester & Bug Hunter)</option>
                  </select>
                </div>

                <button
                  onClick={handleReviewSubmit}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm shadow-xl shadow-emerald-500/20 cursor-pointer"
                >
                  Submit Evaluations & Collect Points →
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
