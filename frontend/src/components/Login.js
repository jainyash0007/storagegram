import React, { useEffect } from 'react';
import { Button, Container, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

function Login({ onLogin }) {
  const navigate = useNavigate();

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?4';
    script.async = true;
    script.setAttribute('data-telegram-login', process.env.REACT_APP_TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', 'http://localhost:3000/api/auth/telegram');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'handleTelegramAuth(user)');
    document.getElementById('telegram-login').appendChild(script);

    window.handleTelegramAuth = (user) => {
      // console.log('Authenticated user:', user);

      fetch('http://localhost:3000/api/auth/telegram', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user })
      })
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            localStorage.setItem('sessionToken', data.token);
            onLogin();
            navigate('/');
          } else {
            console.error('Authentication failed:', data.error);
          }
        });
    };
  }, [onLogin, navigate]);

  const handleDiscordLogin = () => {
    onLogin();
    navigate('/');
  };

  return (
    <Container>
      <Typography variant="h4" gutterBottom>Login to Storagegram</Typography>
      <div id="telegram-login"></div>
      <Button
        variant="contained"
        color="primary"
        onClick={handleDiscordLogin}
        style={{ marginTop: '20px' }}
      >
        Login with Discord
      </Button>
    </Container>
  );
}

export default Login;
