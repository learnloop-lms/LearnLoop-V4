import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { Sparkles, CheckCircle2, ArrowRight, Shield, Award, Compass, Zap } from 'lucide-react';

const PT_QUESTIONS = [
  { id: 1, text: 'Thirst to crack more challenges' },
  { id: 2, text: 'Improve myself by self-competing' },
  { id: 3, text: 'Giving more importance to achieving goals' },
  { id: 4, text: 'Exploring hidden treasures' },
  { id: 5, text: "Finding what's behind a locked door" },
  { id: 6, text: 'Uncovering game lore' },
  { id: 7, text: 'Cooperating with strangers' },
  { id: 8, text: 'Playing in a group' },
  { id: 9, text: 'Share your success with others' },
  { id: 10, text: 'Taking on a strong opponent when playing one to one match' },
  { id: 11, text: 'Dominating in competitive matches' },
  { id: 12, text: 'Defeating rivals in challenges' }
];

const LS_QUESTIONS = [
  {
    id: 1,
    text: 'I understand something better after I',
    opt1: 'try it out.',
    opt2: 'think it through.'
  },
  {
    id: 2,
    text: 'In classes I have taken',
    opt1: 'I have usually gotten to know many of the students.',
    opt2: 'I have rarely gotten to know many of the students.'
  },
  {
    id: 3,
    text: 'When I start a homework problem, I am more likely to',
    opt1: 'start working on the solution immediately.',
    opt2: 'try to fully understand the problem first.'
  },
  {
    id: 4,
    text: 'When I am learning a new subject, I prefer to',
    opt1: 'stay focused on that subject, learning as much about it as I can.',
    opt2: 'try to make connections between that subject and related subjects.'
  },
  {
    id: 5,
    text: 'When solving problems in a group, I would be more likely to',
    opt1: 'think of the steps in the solutions process.',
    opt2: 'think of possible consequences or applications of the solution in a wide range of areas.'
  },
  {
    id: 6,
    text: 'When writing a paper, I am more likely to',
    opt1: 'work on (think about or write) the beginning of the paper and progress forward.',
    opt2: 'work on (think about or write) different parts of the paper and then order them.'
  },
  {
    id: 7,
    text: 'I find it easier',
    opt1: 'to learn facts.',
    opt2: 'to learn concepts.'
  },
  {
    id: 8,
    text: 'If I were a teacher, I would rather teach a course',
    opt1: 'that deals with facts and real life situations.',
    opt2: 'that deals with ideas and theories.'
  },
  {
    id: 9,
    text: 'I prefer courses that emphasize',
    opt1: 'concrete material (facts, data).',
    opt2: 'abstract material (concepts, theories).'
  },
  {
    id: 10,
    text: 'For entertainment, I would rather',
    opt1: 'watch television.',
    opt2: 'read a book.'
  },
  {
    id: 11,
    text: 'When I get directions to a new place, I prefer',
    opt1: 'a map.',
    opt2: 'written directions.'
  },
  {
    id: 12,
    text: 'I prefer to get new information in',
    opt1: 'pictures, diagrams, graphs, or maps.',
    opt2: 'written directions or verbal information.'
  }
];

export default function OnboardingSurvey() {
  const [section, setSection] = useState('pt'); // 'pt' or 'ls'
  const [ptAnswers, setPtAnswers] = useState(Array(12).fill(3)); // default "Like it" (3)
  const [lsAnswers, setLsAnswers] = useState(Array(12).fill(1)); // default opt1 (1)
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const { fetchProfile, API_BASE } = useAuth();
  const navigate = useNavigate();

  const handlePtSelect = (index, value) => {
    const updated = [...ptAnswers];
    updated[index] = value;
    setPtAnswers(updated);
  };

  const handleLsSelect = (index, value) => {
    const updated = [...lsAnswers];
    updated[index] = value;
    setLsAnswers(updated);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/students/onboarding/survey`, {
        pt_responses: ptAnswers,
        ls_responses: lsAnswers
      });

      setResult(res.data);
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
      await fetchProfile();
    } catch (err) {
      alert(err.response?.data?.detail || 'Survey submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    const archetypes = {
      Visionaries: {
        icon: Sparkles,
        color: 'from-blue-600 to-indigo-600',
        world: 'Cybernetics & Futuristic Stations',
        elements: 'Feedback, Leaderboards, Badges'
      },
      Mentors: {
        icon: Shield,
        color: 'from-amber-600 to-emerald-600',
        world: 'Ancient Grand Academy & Guild Library',
        elements: 'Badges, Progress Bar, Mystery'
      },
      Conquerors: {
        icon: Award,
        color: 'from-red-600 to-amber-600',
        world: 'Crimson Coliseum & Champion Keep',
        elements: 'Badges, Progress Bar, Leaderboard'
      },
      Pioneers: {
        icon: Compass,
        color: 'from-emerald-600 to-teal-600',
        world: 'Uncharted Wilds & Expeditions',
        elements: 'Leaderboard, Mystery, Rewards'
      }
    };

    const details = archetypes[result.pt_ls] || archetypes.Visionaries;
    const IconComp = details.icon;

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-900 p-4 font-sans">
        <div className="w-full max-w-lg bg-white border border-slate-200/90 rounded-3xl p-8 text-center shadow-xl relative overflow-hidden">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white mb-4 shadow-lg shadow-blue-500/25">
            <IconComp className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-xs font-bold tracking-widest uppercase text-blue-600 mb-1">
            ANN Model 1 Classification Complete
          </h2>
          <h1 className="text-3xl font-black text-slate-900 mb-2">
            You are a {result.pt_ls}!
          </h1>
          <p className="text-xs text-slate-600 max-w-md mx-auto mb-6">
            Your personalized learning environment has adapted to the <span className="text-slate-900 font-bold">{details.world}</span> theme.
          </p>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-left space-y-2 mb-6 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Primary Player Type:</span>
              <span className="font-bold text-blue-700">{result.ppt}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Secondary Player Type:</span>
              <span className="font-bold text-indigo-700">{result.spt}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500 font-medium">Learning Style Dimensions:</span>
              <span className="font-bold text-purple-700">
                {result.ld1} • {result.ld2} • {result.ld3} • {result.ld4}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-slate-500 font-medium">Active Gamification Elements:</span>
              <span className="font-bold text-emerald-700">{details.elements}</span>
            </div>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3.5 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            Enter My Personalized Platform
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-900 p-4 md:p-8 font-sans">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-xs font-bold mb-3 shadow-xs">
            <Sparkles className="w-3.5 h-3.5" />
            Learner Profiling Survey (24 Questions)
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-slate-900">
            Personalizing Your Gamified Learning Experience
          </h1>
          <p className="text-xs text-slate-500 mt-2 max-w-xl mx-auto">
            Please answer these questions truthfully based on your natural study and problem-solving preferences.
            Our Artificial Neural Network (ANN) will adapt your themes, visual challenges, and gamification elements.
          </p>
        </div>

        {/* Section Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-8 border border-slate-200">
          <button
            type="button"
            onClick={() => setSection('pt')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
              section === 'pt' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-4 h-4" />
            Part 1: Problem Solving & Interests (12 Questions)
          </button>
          <button
            type="button"
            onClick={() => setSection('ls')}
            className={`flex-1 py-2.5 rounded-xl font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer ${
              section === 'ls' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Compass className="w-4 h-4" />
            Part 2: Learning & Study Preferences (12 Questions)
          </button>
        </div>

        {/* Part 1 Questions */}
        {section === 'pt' && (
          <div className="space-y-4">
            {PT_QUESTIONS.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-blue-300 transition"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xs font-bold text-blue-600 mt-0.5">Q{idx + 1}.</span>
                  <p className="flex-1 text-sm font-semibold text-slate-800">{q.text}</p>
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Hate it', val: 1 },
                    { label: 'Dislike it', val: 2 },
                    { label: 'Like it', val: 3 },
                    { label: 'Love it', val: 4 }
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => handlePtSelect(idx, opt.val)}
                      className={`py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                        ptAnswers[idx] === opt.val
                          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSection('ls')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/25 flex items-center gap-2 hover:opacity-95 cursor-pointer"
              >
                Continue to Part 2
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Part 2 Questions */}
        {section === 'ls' && (
          <div className="space-y-4">
            {LS_QUESTIONS.map((q, idx) => (
              <div
                key={q.id}
                className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-indigo-300 transition"
              >
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-xs font-bold text-indigo-600 mt-0.5">Q{idx + 13}.</span>
                  <p className="flex-1 text-sm font-semibold text-slate-800">{q.text}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {[
                    { label: q.opt1, val: 1 },
                    { label: q.opt2, val: 2 }
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => handleLsSelect(idx, opt.val)}
                      className={`py-3 px-4 rounded-xl text-xs text-left transition flex items-center justify-between cursor-pointer ${
                        lsAnswers[idx] === opt.val
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold shadow-md shadow-indigo-500/20 border border-indigo-400/40'
                          : 'bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      <span>{opt.label}</span>
                      {lsAnswers[idx] === opt.val && <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setSection('pt')}
                className="px-6 py-3 rounded-xl bg-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-300 cursor-pointer"
              >
                Back to Part 1
              </button>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="px-8 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/25 flex items-center gap-2 hover:opacity-95 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Classifying with ANN Model 1...' : 'Submit Profiling Survey'}
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
