import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate, useLocation } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';
import SharedFileDownload from './components/SharedFileDownload';

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

function AppRoutes() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('sessionToken', token);
      setIsAuthenticated(true);
      window.history.replaceState({}, document.title, "/");
    } else {
      const storedToken = localStorage.getItem('sessionToken');
      if (storedToken) {
        setIsAuthenticated(true);
      }
    }
    setLoading(false);
  }, [location.search]);

  const handleLogin = (chatId) => {
    setChatId(chatId);
    setIsAuthenticated(true);
    localStorage.setItem('chatId', chatId);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Home chatId={chatId} /> : <Navigate to="/login" />} />
      <Route path="/login" element={<Login onLogin={handleLogin} />} />
      <Route path="/download/:token" element={<SharedFileDownload />} />
    </Routes>
  );
}

export default App;
