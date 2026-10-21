import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  Gamepad2, Users, Shield, Zap, Clock, CheckCircle2, XCircle,
  Plus, AlertCircle, ArrowRight, Play, UserCheck, RefreshCw, Send,
  Sparkles, Coffee, BookOpen, Crown, ChevronRight, HelpCircle
} from 'lucide-react';

export default function CollaborativeHub() {
  const { user, API_BASE } = useAuth();
  const { isLight } = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [challenges, setChallenges] = useState([]);
  const [isLocked, setIsLocked] = useState(false);
  const [currentTeamId, setCurrentTeamId] = useState(null);
  const [myRole, setMyRole] = useState('Visionary');
  
  // 2-Column Split: Direct Invites vs Lobby
  const [directInvites, setDirectInvites] = useState([]);
  const [lobbyInvites, setLobbyInvites] = useState([]);
  const [activeTabInvites, setActiveTabInvites] = useState('all'); // 'all', 'direct', 'lobby'

  // Guide / Tour Modal State
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Formation Modal State
  const [formingTeamId, setFormingTeamId] = useState(null);
  const [formationData, setFormationData] = useState(null);
  const [loadingFormation, setLoadingFormation] = useState(false);

  // Candidate Picker inside Modal
  const [openSlotRole, setOpenSlotRole] = useState(null);
  const [eligibleCandidates, setEligibleCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidateActionMsg, setCandidateActionMsg] = useState('');

  useEffect(() => {
    fetchHubData();
    const interval = setInterval(fetchHubData, 6000); // Polling for live status
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (formingTeamId) {
      fetchFormationStatus(formingTeamId);
      const interval = setInterval(() => fetchFormationStatus(formingTeamId), 4000);
      return () => clearInterval(interval);
    }
  }, [formingTeamId]);

  const fetchHubData = async () => {
    try {
      const [resChall, resInv] = await Promise.all([
        axios.get(`${API_BASE}/collab/student/challenges`),
        axios.get(`${API_BASE}/collab/student/my-invites`)
      ]);
      setChallenges(resChall.data.challenges || []);
      setIsLocked(resChall.data.is_locked || false);
      setCurrentTeamId(resChall.data.current_team_id || null);
      setMyRole(resChall.data.my_role || 'Visionary');

      const invData = resInv.data || {};
      setDirectInvites(invData.direct_invites || []);
      setLobbyInvites(invData.lobby_invites || []);
    } catch (err) {
      console.error('Error fetching collab hub data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchFormationStatus = async (teamId) => {
    try {
      const res = await axios.get(`${API_BASE}/collab/student/teams/${teamId}/formation-status`);
      setFormationData(res.data);
    } catch (err) {
      console.error('Failed to fetch formation status:', err);
    }
  };

  const handleInitiate = async (challengeId) => {
    try {
      setCandidateActionMsg('');
      const res = await axios.post(`${API_BASE}/collab/student/challenges/${challengeId}/initiate`);
      const teamId = res.data.team_id;
      setFormingTeamId(teamId);
      fetchFormationStatus(teamId);
      fetchHubData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to initiate challenge.');
    }
  };

  const openCandidatePicker = async (teamId, role) => {
    setOpenSlotRole(role);
    setLoadingCandidates(true);
    setEligibleCandidates([]);
    try {
      const res = await axios.get(`${API_BASE}/collab/student/teams/${teamId}/eligible-candidates?needed_role=${role}`);
      setEligibleCandidates(res.data || []);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to fetch eligible teammates.');
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleSendInvite = async (candidateId, isLobby = false) => {
    if (!formingTeamId) return;
    try {
      await axios.post(`${API_BASE}/collab/student/teams/${formingTeamId}/invite`, {
        module_index: 1,
        needed_role: openSlotRole,
        invitee_id: isLobby ? null : candidateId,
        is_lobby: isLobby
      });
      setCandidateActionMsg(isLobby ? 'Slot posted to course lobby!' : 'Invite sent successfully!');
      fetchFormationStatus(formingTeamId);
      fetchHubData();
      setTimeout(() => {
        setOpenSlotRole(null);
        setCandidateActionMsg('');
      }, 1200);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to send invite.');
    }
  };

  const handleCancelInvite = async (inviteId) => {
    try {
      await axios.post(`${API_BASE}/collab/student/invites/${inviteId}/cancel`);
      if (formingTeamId) fetchFormationStatus(formingTeamId);
      fetchHubData();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to cancel invite.');
    }
  };

  const handleRespondInvite = async (inviteId, action) => {
    try {
      const res = await axios.post(`${API_BASE}/collab/student/invites/${inviteId}/respond`, {
        action
      });
      if (action === 'accept') {
        const teamId = res.data.team_id;
        if (res.data.team_status === 'ACTIVE') {
          navigate(`/collaborative/game-zone/${teamId}`);
        } else {
          setFormingTeamId(teamId);
          fetchFormationStatus(teamId);
          fetchHubData();
        }
      } else {
        fetchHubData();
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to respond to invite.');
    }
  };

  const getRoleBadge = (role) => {
    const r = (role || '').toLowerCase();
    if (r.includes('visionary')) return { bg: 'bg-purple-500/10 text-purple-600 border-purple-500/20', icon: '🟣', label: 'Visionary (Planner)' };
    if (r.includes('pioneer')) return { bg: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: '🔵', label: 'Pioneer (Coder)' };
    if (r.includes('mentor')) return { bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: '🟢', label: 'Mentor (Reviewer)' };
    if (r.includes('conqueror')) return { bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20', icon: '🟠', label: 'Conqueror (Tester)' };
    return { bg: 'bg-slate-500/10 text-slate-600 border-slate-500/20', icon: '⚪', label: role };
  };

  const myBadge = getRoleBadge(myRole);
  const totalInvites = directInvites.length + lobbyInvites.length;

  return (
    <div className={`min-h-screen ${isLight ? 'bg-slate-50 text-slate-900' : 'bg-slate-950 text-slate-100'}`}>
      {/* Header */}
      <header className={`px-6 py-4 border-b sticky top-0 z-20 backdrop-blur-md ${isLight ? 'bg-white/80 border-slate-200' : 'bg-slate-900/80 border-slate-800'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="p-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition">
              ← Back to Dashboard
            </Link>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
                <Gamepad2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-black text-lg">Collaborative Activity Hub</h1>
                <p className="text-xs text-slate-500">4-Member Squad Challenges • Real-time Game Zone</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Guide Button */}
            <button
              onClick={() => setShowGuideModal(true)}
              className="px-3 py-1.5 rounded-xl border border-indigo-500/30 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <HelpCircle className="w-4 h-4" />
              <span>Roles & Rules Guide</span>
            </button>

            <div className={`px-3 py-1.5 rounded-full border text-xs font-bold flex items-center gap-2 ${myBadge.bg}`}>
              <span>{myBadge.icon}</span>
              <span>Your Archetype: {myBadge.label}</span>
            </div>

            {isLocked && currentTeamId && (
              <button
                onClick={() => navigate(`/collaborative/game-zone/${currentTeamId}`)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center gap-2 animate-pulse cursor-pointer"
              >
                <Play className="w-4 h-4 fill-white" />
                Resume Active Game Zone
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Lock / Active Alert */}
        {isLocked && (
          <div className={`p-4 rounded-2xl border flex items-center justify-between ${
            isLight ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-amber-950/40 border-amber-800 text-amber-200'
          }`}>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold">Squad Locked in Ongoing Challenge</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Your team is actively competing in the Game Zone. Complete the challenge to unlock future participation.
                </p>
              </div>
            </div>
            {currentTeamId && (
              <button
                onClick={() => navigate(`/collaborative/game-zone/${currentTeamId}`)}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer"
              >
                Enter Active Game Zone →
              </button>
            )}
          </div>
        )}

        {/* 2-COLUMN SECTION: DIRECT INVITATIONS vs COURSE LOBBY */}
        {totalInvites > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                <h2 className="font-extrabold text-base">Incoming Squad Requests ({totalInvites})</h2>
              </div>

              {/* View Toggle */}
              <div className="flex items-center gap-2 text-xs font-bold">
                <button
                  onClick={() => setActiveTabInvites('all')}
                  className={`px-3 py-1 rounded-xl transition cursor-pointer ${
                    activeTabInvites === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  All ({totalInvites})
                </button>
                <button
                  onClick={() => setActiveTabInvites('direct')}
                  className={`px-3 py-1 rounded-xl transition cursor-pointer ${
                    activeTabInvites === 'direct' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Direct Invites ({directInvites.length})
                </button>
                <button
                  onClick={() => setActiveTabInvites('lobby')}
                  className={`px-3 py-1 rounded-xl transition cursor-pointer ${
                    activeTabInvites === 'lobby' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  Course Lobby ({lobbyInvites.length})
                </button>
              </div>
            </div>

            {/* 2-Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Column 1: Direct Invites */}
              {(activeTabInvites === 'all' || activeTabInvites === 'direct') && (
                <div className={`p-5 rounded-3xl border space-y-4 ${
                  isLight ? 'bg-purple-50/40 border-purple-200' : 'bg-purple-950/20 border-purple-900/60'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-purple-200 dark:border-purple-800">
                    <span className="font-extrabold text-xs uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-purple-500" /> Direct Invitations ({directInvites.length})
                    </span>
                    <span className="text-[10px] text-purple-500">Sent specifically to you</span>
                  </div>

                  {directInvites.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No direct invitations at the moment.</p>
                  ) : (
                    <div className="space-y-3">
                      {directInvites.map((inv) => {
                        const b = getRoleBadge(inv.needed_role);
                        return (
                          <div
                            key={inv.invite_id}
                            className={`p-4 rounded-2xl border transition shadow-sm ${
                              isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${b.bg}`}>
                                Role: {inv.needed_role}
                              </span>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> Expires soon
                              </span>
                            </div>

                            <h4 className="font-bold text-xs mb-1 truncate">{inv.challenge_title}</h4>
                            <p className="text-[11px] text-slate-500 mb-3">
                              Invited by squad leader: <span className="font-bold text-slate-700 dark:text-slate-300">{inv.inviter_name}</span>
                            </p>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleRespondInvite(inv.invite_id, 'accept')}
                                disabled={inv.is_locked}
                                className={`flex-1 py-1.5 rounded-xl text-xs font-bold text-white transition flex items-center justify-center gap-1 cursor-pointer ${
                                  inv.is_locked
                                    ? 'bg-slate-400 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-sm'
                                }`}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" /> Accept & Join
                              </button>
                              <button
                                onClick={() => handleRespondInvite(inv.invite_id, 'decline')}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold border hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 cursor-pointer"
                              >
                                Decline
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Column 2: Course Lobby */}
              {(activeTabInvites === 'all' || activeTabInvites === 'lobby') && (
                <div className={`p-5 rounded-3xl border space-y-4 ${
                  isLight ? 'bg-blue-50/40 border-blue-200' : 'bg-blue-950/20 border-blue-900/60'
                }`}>
                  <div className="flex items-center justify-between pb-2 border-b border-blue-200 dark:border-blue-800">
                    <span className="font-extrabold text-xs uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <Gamepad2 className="w-4 h-4 text-blue-500" /> Course Squad Lobby ({lobbyInvites.length})
                    </span>
                    <span className="text-[10px] text-blue-500">Open to matching eligible role</span>
                  </div>

                  {lobbyInvites.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6">No open lobby slots for your archetype right now.</p>
                  ) : (
                    <div className="space-y-3">
                      {lobbyInvites.map((inv) => {
                        const b = getRoleBadge(inv.needed_role);
                        return (
                          <div
                            key={inv.invite_id}
                            className={`p-4 rounded-2xl border transition shadow-sm ${
                              isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${b.bg}`}>
                                Needed: {inv.needed_role}
                              </span>
                              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
                                Open Lobby
                              </span>
                            </div>

                            <h4 className="font-bold text-xs mb-1 truncate">{inv.challenge_title}</h4>
                            <p className="text-[11px] text-slate-500 mb-3">
                              Squad leader: <span className="font-bold text-slate-700 dark:text-slate-300">{inv.inviter_name}</span>
                            </p>

                            <button
                              onClick={() => handleRespondInvite(inv.invite_id, 'accept')}
                              disabled={inv.is_locked}
                              className={`w-full py-1.5 rounded-xl text-xs font-bold text-white transition flex items-center justify-center gap-1 cursor-pointer ${
                                inv.is_locked
                                  ? 'bg-slate-400 cursor-not-allowed'
                                  : 'bg-blue-600 hover:bg-blue-700 shadow-sm'
                              }`}
                            >
                              <Play className="w-3.5 h-3.5 fill-white" /> Claim Slot & Join Squad
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Challenges List with Live Squad Formation Status */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-base">Teacher Uploaded Collaborative Challenges</h2>
              <p className="text-xs text-slate-500">
                Initiate a squad or track your team invitations under each problem.
              </p>
            </div>
            <button
              onClick={fetchHubData}
              className="p-2 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading collaborative challenges...</div>
          ) : challenges.length === 0 ? (
            <div className={`p-12 text-center rounded-3xl border ${isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'}`}>
              <Gamepad2 className="w-12 h-12 text-slate-400 mx-auto mb-3 opacity-50" />
              <h3 className="font-bold text-sm">No Collaborative Challenges Available</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                Your teachers have not uploaded any group activities for your enrolled courses yet. Check back soon!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {challenges.map((ch) => {
                const squad = ch.my_squad;
                const isMySquadActive = squad && squad.status === 'ACTIVE';
                const isMySquadForming = squad && squad.status === 'FORMING';

                return (
                  <div
                    key={ch.id}
                    className={`p-6 rounded-3xl border transition flex flex-col justify-between ${
                      isMySquadActive
                        ? isLight ? 'bg-emerald-50/50 border-emerald-300' : 'bg-emerald-950/20 border-emerald-800'
                        : isLight ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                          {ch.course_title}
                        </span>
                        <span className="text-xs text-slate-400 flex items-center gap-1 font-bold">
                          <Users className="w-3.5 h-3.5" /> {ch.group_size} Members
                        </span>
                      </div>

                      <h3 className="font-extrabold text-base mb-2">{ch.title}</h3>

                      <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-indigo-500" /> {ch.base_time_minutes} mins base
                        </span>
                        <span className="flex items-center gap-1">
                          <Coffee className="w-3.5 h-3.5 text-amber-500" /> {ch.break_pool_minutes}m break pool
                        </span>
                      </div>

                      {/* Real-time Squad Status Under Each Problem */}
                      {squad && (
                        <div className={`p-3 rounded-2xl border mb-4 space-y-2 text-xs ${
                          isMySquadActive
                            ? 'bg-emerald-100/60 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                            : 'bg-slate-100/80 border-slate-200 text-slate-800 dark:bg-slate-800/60 dark:border-slate-700 dark:text-slate-200'
                        }`}>
                          <div className="flex items-center justify-between font-bold">
                            <span>Squad Status:</span>
                            <span className={isMySquadActive ? 'text-emerald-600 font-extrabold' : 'text-amber-500'}>
                              {isMySquadActive ? '✓ All 4 Ready (Active)' : `${squad.accepted_count}/4 Accepted`}
                            </span>
                          </div>

                          {/* Mini slot pills */}
                          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                            {squad.slots.map((slot) => (
                              <div
                                key={slot.role}
                                className={`px-2 py-1 rounded-lg border truncate font-bold ${
                                  slot.status === 'accepted'
                                    ? 'bg-emerald-500/10 border-emerald-400 text-emerald-600'
                                    : slot.status === 'invited'
                                    ? 'bg-amber-500/10 border-amber-400 text-amber-600'
                                    : slot.status === 'lobby'
                                    ? 'bg-blue-500/10 border-blue-400 text-blue-600'
                                    : 'bg-slate-200/60 border-slate-300 text-slate-500 dark:bg-slate-800 dark:border-slate-700'
                                }`}
                              >
                                {slot.label}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                      {isMySquadActive ? (
                        <button
                          onClick={() => navigate(`/collaborative/game-zone/${squad.team_id}`)}
                          className="w-full py-3 rounded-2xl text-xs font-black text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 cursor-pointer animate-pulse"
                        >
                          <Play className="w-4 h-4 fill-white" />
                          All 4 Accepted! Enter Game Zone →
                        </button>
                      ) : isMySquadForming ? (
                        <button
                          onClick={() => {
                            setFormingTeamId(squad.team_id);
                            fetchFormationStatus(squad.team_id);
                          }}
                          className="w-full py-3 rounded-2xl text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800 hover:bg-indigo-100 transition flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <Users className="w-4 h-4" />
                          Manage Squad Invites ({squad.accepted_count}/4)
                        </button>
                      ) : (
                        <button
                          onClick={() => handleInitiate(ch.id)}
                          disabled={isLocked}
                          className={`w-full py-3 rounded-2xl text-xs font-bold text-white transition flex items-center justify-center gap-2 cursor-pointer ${
                            isLocked
                              ? 'bg-slate-400 cursor-not-allowed opacity-60'
                              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md shadow-indigo-600/20'
                          }`}
                        >
                          <Zap className="w-4 h-4 fill-white" />
                          {isLocked ? 'Locked in Other Challenge' : 'Initiate Challenge & Form Team'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* SQUAD FORMATION MODAL (Initiator View) */}
      {formingTeamId && formationData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-2xl rounded-3xl p-6 border shadow-2xl space-y-6 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="font-black text-lg">Sub-team Formation: 4-Member Squad</h3>
                <p className="text-xs text-slate-500">
                  {formationData.challenge_title} • 1 Visionary, 1 Pioneer, 1 Mentor, 1 Conqueror
                </p>
              </div>
              <button
                onClick={() => setFormingTeamId(null)}
                className="p-1.5 rounded-xl border hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Sub-team 4 Slots with Live Status */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {formationData.slots.map((slot) => {
                const badge = getRoleBadge(slot.role);
                const isAccepted = slot.status === 'accepted';
                const isInvited = slot.status === 'invited';
                const isLobby = slot.status === 'lobby';

                return (
                  <div
                    key={slot.role}
                    className={`p-4 rounded-2xl border text-center flex flex-col justify-between ${
                      isAccepted
                        ? isLight ? 'bg-emerald-50/70 border-emerald-300' : 'bg-emerald-950/30 border-emerald-800'
                        : isInvited
                        ? isLight ? 'bg-amber-50/70 border-amber-300' : 'bg-amber-950/30 border-amber-800'
                        : isLobby
                        ? isLight ? 'bg-blue-50/70 border-blue-300' : 'bg-blue-950/30 border-blue-800'
                        : isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-800/40 border-slate-800'
                    }`}
                  >
                    <div>
                      <span className="text-xl block mb-1">{badge.icon}</span>
                      <p className="font-bold text-xs">{slot.role}</p>
                      <p className="text-[10px] text-slate-400 mb-3">
                        {slot.role === 'Visionary' && 'Canvas & Plan'}
                        {slot.role === 'Pioneer' && 'Code Terminal'}
                        {slot.role === 'Mentor' && 'Review & Approve'}
                        {slot.role === 'Conqueror' && 'Test Cases & Bugs'}
                      </p>
                    </div>

                    <div>
                      {isAccepted ? (
                        <div className="py-2 px-2 rounded-xl bg-emerald-500/10 text-emerald-600 text-xs font-bold truncate">
                          ✓ {slot.member_name}
                          {slot.is_leader && <span className="block text-[10px] text-indigo-500 font-extrabold">(Leader)</span>}
                        </div>
                      ) : isInvited ? (
                        <div className="space-y-1">
                          <div className="py-1.5 px-2 rounded-xl bg-amber-500/10 text-amber-600 text-[11px] font-bold truncate">
                            ⏳ {slot.member_name}
                          </div>
                          {formationData.is_leader && (
                            <button
                              onClick={() => handleCancelInvite(slot.invite_id)}
                              className="text-[10px] text-red-500 hover:underline cursor-pointer"
                            >
                              Cancel Invite
                            </button>
                          )}
                        </div>
                      ) : isLobby ? (
                        <div className="space-y-1">
                          <div className="py-1.5 px-2 rounded-xl bg-blue-500/10 text-blue-600 text-[11px] font-bold truncate">
                            🌐 Course Lobby
                          </div>
                          {formationData.is_leader && (
                            <button
                              onClick={() => handleCancelInvite(slot.invite_id)}
                              className="text-[10px] text-red-500 hover:underline cursor-pointer"
                            >
                              Withdraw from Lobby
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => openCandidatePicker(formingTeamId, slot.role)}
                          className="w-full py-2 rounded-xl border border-dashed border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-indigo-600 text-xs font-bold cursor-pointer transition"
                        >
                          + Invite {slot.role}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Candidate Picker inside Modal */}
            {openSlotRole && (
              <div className={`p-4 rounded-2xl border space-y-3 ${
                isLight ? 'bg-indigo-50/60 border-indigo-200' : 'bg-slate-800 border-indigo-900/50'
              }`}>
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400">
                    Invite Teammate: {openSlotRole}
                  </h4>
                  <button
                    onClick={() => setOpenSlotRole(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                {candidateActionMsg && (
                  <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 text-xs font-bold text-center">
                    {candidateActionMsg}
                  </div>
                )}

                {loadingCandidates ? (
                  <p className="text-xs text-slate-400 text-center py-4">Checking course candidates...</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {/* Course Lobby Option */}
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${
                      isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
                    }`}>
                      <div>
                        <p className="text-xs font-bold">Open to Course Lobby</p>
                        <p className="text-[10px] text-slate-400">First eligible {openSlotRole} in the course to accept joins</p>
                      </div>
                      <button
                        onClick={() => handleSendInvite(null, true)}
                        className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                      >
                        Post to Lobby
                      </button>
                    </div>

                    {/* Direct Candidate List */}
                    {eligibleCandidates.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-2">
                        No other individual candidates of this type currently available. You can post to the course lobby above.
                      </p>
                    ) : (
                      eligibleCandidates.map((cand) => (
                        <div
                          key={cand.student_id}
                          className={`p-3 rounded-xl border flex items-center justify-between ${
                            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-700'
                          }`}
                        >
                          <div>
                            <p className="text-xs font-bold">{cand.name}</p>
                            <p className="text-[10px] text-slate-400">
                              {cand.department} • Worked together: {cand.times_worked} time(s)
                            </p>
                          </div>
                          <button
                            onClick={() => handleSendInvite(cand.student_id, false)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer"
                          >
                            Send Invite
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Launch Game Zone button ONLY when all 4 have accepted! */}
            {formationData.can_enter ? (
              <button
                onClick={() => navigate(`/collaborative/game-zone/${formingTeamId}`)}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-sm shadow-xl shadow-emerald-500/20 cursor-pointer animate-pulse"
              >
                All 4 Members Ready! Enter Game Zone →
              </button>
            ) : (
              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-center text-xs text-slate-500">
                Waiting for all 4 squad members to accept invites before Game Zone opens ({formationData.accepted_count}/4 Accepted).
              </div>
            )}
          </div>
        </div>
      )}

      {/* ROLES & COLLABORATION GUIDE MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`w-full max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-6 border shadow-2xl space-y-5 ${
            isLight ? 'bg-white border-slate-200' : 'bg-slate-900 border-slate-800'
          }`}>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-black text-base flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-500" />
                Collaborative Squad Roles & Workflow Guide
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <p className="text-slate-500">
                Every squad is formed with exactly 4 distinct player archetypes. Each teammate has a dedicated role and specialized tool in the Game Zone:
              </p>

              <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1">
                <h4 className="font-extrabold text-purple-600 dark:text-purple-400 text-xs flex items-center gap-1.5">
                  🟣 Visionary — Planner & System Architect
                </h4>
                <p className="text-slate-600 dark:text-slate-300">
                  Builds the visual flowchart canvas (Start/End, Process, Decision with Yes/No, I/O) and writes the pseudocode algorithm. Clicks "Plan Ready" to unlock the coder's terminal.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 space-y-1">
                <h4 className="font-extrabold text-blue-600 dark:text-blue-400 text-xs flex items-center gap-1.5">
                  🔵 Pioneer — Lead Developer & Coder
                </h4>
                <p className="text-slate-600 dark:text-slate-300">
                  Implements the solution in the code editor from the Visionary's plan. Submits code drafts and fixes any bugs reported by the Conqueror.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <h4 className="font-extrabold text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-1.5">
                  🟢 Mentor — Reviewer & Quality Guard
                </h4>
                <p className="text-slate-600 dark:text-slate-300">
                  Reviews the plan and code line-by-line using Google Docs-style inline comments. Requests changes or gives mandatory final approval.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-1">
                <h4 className="font-extrabold text-amber-600 dark:text-amber-400 text-xs flex items-center gap-1.5">
                  🟠 Conqueror — Quality Assurance & Tester
                </h4>
                <p className="text-slate-600 dark:text-slate-300">
                  Prepares edge cases, runs compiler tests, files bug reports with suggested code snippets, and presses "Final Submit" once Mentor approves and all tests pass.
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-[11px] text-slate-500 space-y-1">
                <span className="font-bold text-slate-700 dark:text-slate-300 block">Squad Composition Rule:</span>
                <p>
                  Every squad requires exactly one member of each player type (1 Visionary, 1 Pioneer, 1 Mentor, 1 Conqueror). You can invite classmates directly by name or post slots to the open Course Lobby.
                </p>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer"
            >
              Got it, let's collaborate!
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
