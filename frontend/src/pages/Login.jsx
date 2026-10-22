import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { 
  GraduationCap, BookOpen, Lock, Mail, ArrowRight, Sparkles, Eye, EyeOff,
  KeyRound, X, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';

export default function Login() {
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { login, API_BASE } = useAuth();
  const navigate = useNavigate();

  // Forgot Password modal state
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotRole, setForgotRole] = useState('student');
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotIdentifier, setForgotIdentifier] = useState(''); // regno or employee_id
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [showForgotNewPassword, setShowForgotNewPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await login(email, password, role);
      if (role === 'student') {
        if (!data.form_submission) {
          navigate('/onboarding');
        } else {
          navigate('/dashboard');
        }
      } else {
        navigate('/teacher/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please verify your email and password.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (forgotNewPassword.length < 4) {
      setForgotError('New password must be at least 4 characters long.');
      return;
    }

    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match. Please re-enter identical passwords.');
      return;
    }

    setForgotSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/reset-password`, {
        role: forgotRole,
        email: forgotEmail.trim(),
        identifier: forgotIdentifier.trim(),
        new_password: forgotNewPassword
      });

      setForgotSuccess(res.data.message || 'Password reset successfully!');
      // Pre-fill login email & role
      setEmail(forgotEmail.trim());
      setRole(forgotRole);

      setTimeout(() => {
        setShowForgotModal(false);
        setForgotEmail('');
        setForgotIdentifier('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
        setForgotSuccess('');
        setForgotError('');
      }, 1600);
    } catch (err) {
      setForgotError(err.response?.data?.detail || 'Failed to reset password. Please check your details.');
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50 text-slate-900 p-4 font-sans">
      <div className="w-full max-w-md bg-white border border-slate-200/90 rounded-3xl p-8 shadow-xl relative z-10">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white mb-4 shadow-lg shadow-blue-500/25">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
            Learn Loop
          </h1>
          <p className="text-xs text-blue-600 mt-1 uppercase tracking-widest font-bold">
            Adaptive Gamified Learning Platform
          </p>
        </div>

        {/* Role Switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl mb-6 border border-slate-200">
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              role === 'student'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            Student Login
          </button>
          <button
            type="button"
            onClick={() => setRole('teacher')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
              role === 'teacher'
                ? 'bg-white text-indigo-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            Faculty Login
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 mb-6 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 text-center font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5 ml-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === 'student' ? 'student@tce.edu' : 'teacher@tce.edu'}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5 ml-1">
              <label className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <button
                type="button"
                onClick={() => {
                  setForgotRole(role);
                  setForgotEmail(email);
                  setForgotError('');
                  setForgotSuccess('');
                  setShowForgotModal(true);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition cursor-pointer hover:underline"
              >
                Forgot Password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2.5 pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:from-blue-700 hover:to-indigo-700 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {submitting ? 'Authenticating...' : (role === 'student' ? 'Sign In as Student' : 'Sign In as Faculty')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-500">
          New to Learn Loop?{' '}
          <Link
            to="/register"
            className="text-blue-600 hover:text-blue-700 font-bold transition underline"
          >
            Create an Account
          </Link>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORGOT PASSWORD MODAL (ACADEMIC IDENTITY VERIFICATION)                    */}
      {/* ========================================================================= */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl p-7 shadow-2xl relative">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 shadow-xs">
                  <KeyRound className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">Reset Password</h3>
                  <p className="text-xs text-slate-500">Academic identity verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Role Switcher in Modal */}
            <div className="flex bg-slate-100 p-1 rounded-xl mb-4 border border-slate-200">
              <button
                type="button"
                onClick={() => { setForgotRole('student'); setForgotError(''); }}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  forgotRole === 'student' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                Student
              </button>
              <button
                type="button"
                onClick={() => { setForgotRole('teacher'); setForgotError(''); }}
                className={`flex-1 py-1.5 rounded-lg font-bold text-xs transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  forgotRole === 'teacher' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Faculty
              </button>
            </div>

            {forgotError && (
              <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{forgotError}</span>
              </div>
            )}

            {forgotSuccess && (
              <div className="p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{forgotSuccess}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">
                  Registered Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder={forgotRole === 'student' ? 'student@tce.edu' : 'teacher@tce.edu'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-10 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">
                  {forgotRole === 'student' ? 'College Register Number (Reg No)' : 'Employee ID'}
                </label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={forgotIdentifier}
                    onChange={(e) => setForgotIdentifier(e.target.value)}
                    placeholder={forgotRole === 'student' ? 'e.g. 21IT001' : 'e.g. EMP102'}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-10 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1 ml-1">
                  {forgotRole === 'student' 
                    ? 'Must match the Register Number entered during registration' 
                    : 'Must match the Employee ID entered during registration'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showForgotNewPassword ? 'text' : 'password'}
                    required
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder="Enter at least 4 characters"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-10 pr-9 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotNewPassword(!showForgotNewPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showForgotNewPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 ml-1">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type={showForgotConfirmPassword ? 'text' : 'password'}
                    required
                    value={forgotConfirmPassword}
                    onChange={(e) => setForgotConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl py-2 pl-10 pr-9 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotConfirmPassword(!showForgotConfirmPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showForgotConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotSubmitting}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {forgotSubmitting ? 'Verifying...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
