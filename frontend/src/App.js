import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [chatId, setChatId] = useState(null);
  const [loading, setLoading] = useState(true);  // Add a loading state

  useEffect(() => {
    const token = localStorage.getItem('sessionToken');
    if (token) {
      setIsAuthenticated(true);
      setLoading(false);  // Loading complete
    } else {
      setLoading(false);  // Loading complete even if user isn't authenticated
    }
  }, []);

  const handleLogin = (chatId) => {
    setChatId(chatId);
    setIsAuthenticated(true);
    localStorage.setItem('chatId', chatId);  // Store chatId in localStorage
  };

  // Show loading screen until authentication check is complete
  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Router>
      <div>
        <Routes>
          <Route path="/" element={isAuthenticated ? <Home chatId={chatId} /> : <Navigate to="/login" />} />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
