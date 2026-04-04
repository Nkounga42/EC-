import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { Auth } from './components/Auth';
import { Home } from './pages/Home';
import { Profile } from './pages/Profile';
import { AnonymousInbox } from './pages/AnonymousInbox';
import { NGLPage } from './pages/NGLPage';
import { Chat } from './pages/Chat';
import { Admin } from './pages/Admin';
import { BlogDetail } from './pages/BlogDetail';
import { CreateBlog } from './pages/CreateBlog';
import { Toaster } from 'sonner';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return null;
  if (!user) return <Navigate to="/auth" />;
  
  return <>{children}</>;
}

function AppContent() {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/profile/:username" element={<Profile />} />
          <Route path="/ngl/:username" element={<NGLPage />} />
          <Route path="/blog/:postId" element={<BlogDetail />} />
          <Route path="/create-blog" element={<PrivateRoute><CreateBlog /></PrivateRoute>} />
          
          {/* Private Routes */}
          <Route path="/inbox" element={
            <PrivateRoute>
              <AnonymousInbox />
            </PrivateRoute>
          } />
          <Route path="/chat/:roomId?" element={
            <PrivateRoute>
              <Chat />
            </PrivateRoute>
          } />
          <Route path="/admin" element={
            <PrivateRoute>
              <Admin />
            </PrivateRoute>
          } />
        </Routes>
      </main>
      <Toaster position="top-center" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
