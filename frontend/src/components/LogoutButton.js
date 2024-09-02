import React from 'react';
import { Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function LogoutButton() {
  const navigate = useNavigate();

  const handleLogout = () => {
    const token = localStorage.getItem('sessionToken');

    if (token) {
      fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token,
        }
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          localStorage.removeItem('sessionToken');
          localStorage.removeItem('platform');
          navigate('/login');
        } else {
          alert('Failed to log out');
        }
      })
      .catch(error => {
        console.error('Logout failed:', error);
      });
    }
  };

  return (
    <Button color="inherit" onClick={handleLogout}>
      Logout
    </Button>
  );
}

export default LogoutButton;
