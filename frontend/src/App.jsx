import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { VisionaryFeedbackProvider } from './context/VisionaryFeedbackContext';
import Login from './pages/Login';
import Register from './pages/Register';
import OnboardingSurvey from './pages/OnboardingSurvey';
import StudentDashboard from './pages/StudentDashboard';
import CourseView from './pages/CourseView';
import QuizView from './pages/QuizView';
import TaskView from './pages/TaskView';
import LeaderboardView from './pages/LeaderboardView';
import CollectiblesView from './pages/CollectiblesView';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherCourseDetail from './pages/TeacherCourseDetail';
import CollaborativeHub from './pages/CollaborativeHub';
import CollaborativeGameZone from './pages/CollaborativeGameZone';

function ProtectedRoute({ children, role }) {
  const { user, token, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 text-xs">
        Loading Learn Loop session...
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role && user && user.role !== role) {
    return <Navigate to={user.role === 'teacher' ? '/teacher/dashboard' : '/dashboard'} replace />;
  }

  // Strictly enforce: Student CANNOT access dashboard or any course pages until PT_LS survey is completed!
  if (user && user.role === 'student' && !user.form_submission) {
    if (window.location.pathname !== '/onboarding') {
      return <Navigate to="/onboarding" replace />;
    }
  }

  // Once completed, student should never be asked to do the survey again
  if (user && user.role === 'student' && user.form_submission && window.location.pathname === '/onboarding') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <VisionaryFeedbackProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
            
            <Route
              path="/onboarding"
              element={
                <ProtectedRoute role="student">
                  <OnboardingSurvey />
                </ProtectedRoute>
              }
            />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute role="student">
                  <StudentDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/course/:courseId"
              element={
                <ProtectedRoute role="student">
                  <CourseView />
                </ProtectedRoute>
              }
            />

            <Route
              path="/quiz/:moduleId"
              element={
                <ProtectedRoute role="student">
                  <QuizView />
                </ProtectedRoute>
              }
            />

            <Route
              path="/task/:moduleId"
              element={
                <ProtectedRoute role="student">
                  <TaskView />
                </ProtectedRoute>
              }
            />

            <Route
              path="/leaderboard/:courseId"
              element={
                <ProtectedRoute role="student">
                  <LeaderboardView />
                </ProtectedRoute>
              }
            />

            <Route
              path="/collectibles"
              element={
                <ProtectedRoute role="student">
                  <CollectiblesView />
                </ProtectedRoute>
              }
            />

            <Route
              path="/collaborative"
              element={
                <ProtectedRoute role="student">
                  <CollaborativeHub />
                </ProtectedRoute>
              }
            />

            <Route
              path="/collaborative/game-zone/:teamId"
              element={
                <ProtectedRoute role="student">
                  <CollaborativeGameZone />
                </ProtectedRoute>
              }
            />

            <Route
              path="/teacher/dashboard"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherDashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/teacher/course/:courseId"
              element={
                <ProtectedRoute role="teacher">
                  <TeacherCourseDetail />
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
        </VisionaryFeedbackProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
