import React, { useState } from 'react';
import { 
  X, Sparkles, Zap, Shield, Clock, HelpCircle, 
  Coins, Key, Heart, Users, Shuffle, Award, CheckCircle2, ChevronRight, Info
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

export default function GameElementsTourModal({ isOpen, onClose }) {
  const { isLight } = useTheme();
  const { activeTheme } = useAuth();
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'common', 'lifelines', 'bonus'

  if (!isOpen) return null;

  const elements = [
    {
      id: 'coins',
      category: 'common',
      title: '1. Coins',
      icon: activeTheme?.icons?.coins,
      initially: '0 Coins',
      earningRate: 'Total marks earned × 10 (e.g. 80 marks = 800 coins added weekly)',
      purpose: 'Currency used to purchase lifelines, keys, extra time, and query peers.',
      cost: 'Earned through academic excellence & quiz accuracy'
    },
    {
      id: 'keys',
      category: 'common',
      title: '2. Concept Keys',
      icon: activeTheme?.icons?.keys,
      initially: '1 Free Key',
      earningRate: 'Purchased from Coins Vault',
      purpose: 'Unlock new advanced learning concepts and bonus syllabus topics.',
      cost: '400 Coins per key'
    },
    {
      id: 'hearts',
      category: 'common',
      title: '3. Lives (Hearts)',
      icon: activeTheme?.icons?.hearts,
      initially: '5 Free Lives (Full)',
      earningRate: 'Regeneration: +1 life per 30 minutes after losing lives',
      purpose: 'Protects your academic integrity and unlocks challenging problem tiers.',
      cost: 'Deductions: Changing to lower difficulty: -1 life | Failing easy level: -2 lives'
    },
    {
      id: 'hints',
      category: 'lifelines',
      title: '4. Hints',
      icon: activeTheme?.icons?.hints,
      initially: '2 Free Hints',
      earningRate: 'Purchase with coins anytime',
      purpose: 'View contextual quiz answer hints when facing challenging questions.',
      cost: '10 Coins per hint'
    },
    {
      id: 'ask_expert',
      category: 'lifelines',
      title: '5. Ask the Expert',
      icon: activeTheme?.icons?.ask_expert,
      initially: '1 Free Use',
      earningRate: 'Instructor verified lifeline',
      purpose: 'Clear doubts and compiler errors with direct guidance from course instructors.',
      cost: '1 Life per use'
    },
    {
      id: 'extra_time',
      category: 'lifelines',
      title: '6. Extra Time',
      icon: activeTheme?.icons?.extra_time,
      initially: '1 Free Use',
      earningRate: 'Available during countdowns',
      purpose: 'Adds valuable bonus seconds to complete your submission.',
      cost: 'Quiz: +1 minute (50 Coins) | Assignment: +10 minutes (150 Coins)'
    },
    {
      id: 'peer_mentoring',
      category: 'lifelines',
      title: '7. Peer Mentoring',
      icon: activeTheme?.icons?.peer_mentoring,
      initially: '2 Free Uses',
      earningRate: 'Collaborative learner network',
      purpose: 'Get direct help and hints from peer students in your classroom.',
      cost: 'Cost: 20 Coins per use (Helper peer receives 30 Coins reward!)'
    },
    {
      id: 'swap',
      category: 'lifelines',
      title: '8. Swap the Question',
      icon: activeTheme?.icons?.swap,
      initially: '2 Free Uses (1 Quiz, 1 Assignment)',
      earningRate: 'Calibrated difficulty match',
      purpose: 'Exchange your current question with a fresh alternative of equal difficulty.',
      cost: '1 Life per use (for both Quiz and Assignment)'
    },
    {
      id: 'double_dip',
      category: 'lifelines',
      title: '9. Double Dip',
      icon: activeTheme?.icons?.double_dip,
      initially: '1 Free Use',
      earningRate: 'Two chances for success',
      purpose: 'Select two possible answers for the same question to double your chances.',
      cost: '100 Coins (for both Quiz and Assignment)'
    },
    {
      id: 'fifty_fifty',
      category: 'lifelines',
      title: '10. 50:50 (Fifty-Fifty)',
      icon: activeTheme?.icons?.fifty_fifty,
      initially: '2 Free Uses',
      earningRate: 'Precision elimination',
      purpose: 'Instantly removes two incorrect options from multiple-choice questions.',
      cost: '100 Coins per use (Quiz only)'
    }
  ];

  const filtered = activeTab === 'all' 
    ? elements 
    : activeTab === 'common' 
    ? elements.filter(e => e.category === 'common')
    : activeTab === 'lifelines'
    ? elements.filter(e => e.category === 'lifelines')
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className={`w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border shadow-2xl overflow-hidden transition-all ${
        isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'
      }`}>
        
        {/* Modal Header */}
        <div className={`p-5 sm:p-6 border-b flex items-center justify-between ${
          isLight ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-slate-200' : 'bg-gradient-to-r from-slate-900 to-indigo-950/40 border-slate-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Zap className="w-6 h-6 animate-bounce" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                <span>Learn Loop Game Elements & Lifelines Tour</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950">Official Rules</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Understand your game inventory, lifelines, starting benefits, and upgrade costs.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-2 rounded-xl border transition cursor-pointer ${
              isLight ? 'bg-white hover:bg-slate-100 border-slate-200 text-slate-500' : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Navigation Tabs */}
        <div className={`px-6 py-2.5 border-b flex items-center gap-2 overflow-x-auto text-xs font-bold ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/60 border-slate-800'
        }`}>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              activeTab === 'all' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : isLight ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            All 10 Elements
          </button>
          <button
            onClick={() => setActiveTab('common')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              activeTab === 'common' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : isLight ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            Common Inventory (Coins, Keys, Lives)
          </button>
          <button
            onClick={() => setActiveTab('lifelines')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              activeTab === 'lifelines' 
                ? 'bg-blue-600 text-white shadow-xs' 
                : isLight ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-800'
            }`}
          >
            Quiz & Task Lifelines (7 Power-Ups)
          </button>
          <button
            onClick={() => setActiveTab('bonus')}
            className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
              activeTab === 'bonus' 
                ? 'bg-purple-600 text-white shadow-xs' 
                : isLight ? 'text-purple-700 hover:bg-purple-100' : 'text-purple-300 hover:bg-purple-950/40'
            }`}
          >
            ⭐ High Achiever Bonus
          </button>
        </div>

        {/* Elements Scrollable Grid */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          
          {/* HIGH ACHIEVER BONUS BANNER */}
          {(activeTab === 'all' || activeTab === 'bonus') && (
            <div className={`p-5 rounded-2xl border bg-gradient-to-r from-purple-900/30 via-indigo-900/20 to-purple-900/30 border-purple-500/40 shadow-lg ${
              isLight ? 'text-purple-950' : 'text-purple-100'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <span className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
                  ★
                </span>
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider text-purple-600 dark:text-purple-300">
                    High Achiever Bonus (Special Superpower)
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Exclusive perk for consistent top-tier performers
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs mt-3">
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-white/80 border-purple-200' : 'bg-slate-900/80 border-purple-900'}`}>
                  <strong className="block text-purple-600 dark:text-purple-400 font-bold mb-0.5">Trigger Condition</strong>
                  <p>Maintaining High difficulty level for more than 3 consecutive weeks.</p>
                </div>
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-white/80 border-purple-200' : 'bg-slate-900/80 border-purple-900'}`}>
                  <strong className="block text-emerald-600 dark:text-emerald-400 font-bold mb-0.5">Reward Power</strong>
                  <p>Unlimited access to all game elements freely for 20 to 30 seconds.</p>
                </div>
                <div className={`p-3 rounded-xl border ${isLight ? 'bg-white/80 border-purple-200' : 'bg-slate-900/80 border-purple-900'}`}>
                  <strong className="block text-amber-600 dark:text-amber-400 font-bold mb-0.5">Timer Mechanics</strong>
                  <p>Includes countdown timer during activation; returns to normal coin/life costs afterwards.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'bonus' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all hover:scale-[1.01] shadow-xs ${
                    isLight 
                      ? 'bg-slate-50/70 border-slate-200/90 hover:bg-white hover:border-blue-300' 
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-start gap-3.5 mb-2.5">
                    <div className="w-14 h-14 rounded-2xl bg-white dark:bg-slate-950 p-2 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0 shadow-inner">
                      {item.icon ? (
                        <img src={item.icon} alt={item.title} className="w-10 h-10 object-contain drop-shadow" />
                      ) : (
                        <Zap className="w-7 h-7 text-amber-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-black text-sm">{item.title}</h4>
                        <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                          {item.initially}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-blue-600 dark:text-cyan-400 mt-0.5">
                        {item.earningRate}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs pt-2 border-t border-slate-200/60 dark:border-slate-800/80">
                    <p className={`leading-relaxed ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                      <strong className="text-slate-900 dark:text-white">Purpose: </strong>
                      {item.purpose}
                    </p>
                    <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <span>Cost: {item.cost}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`p-4 sm:p-5 border-t flex flex-wrap items-center justify-between gap-3 ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/70 border-slate-800'
        }`}>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Info className="w-4 h-4 text-blue-500" />
            <span>Lifelines can be activated directly inside Quiz and Task sessions.</span>
          </div>

          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/20 transition cursor-pointer"
          >
            Got it, Let's Learn!
          </button>
        </div>

      </div>
    </div>
  );
}
