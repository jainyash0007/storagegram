import React, { useEffect } from 'react';
import { Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/Login.css';
import discordLogo from '../assets/discord-logo.svg';
import brandLogo from '../assets/storagegram-logo.svg';

function Login({ onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const apiUrl = process.env.REACT_APP_API_URL;

  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const token = urlParams.get('token');
    const platform = urlParams.get('platform');

    if (token && platform) {
      localStorage.setItem('sessionToken', token);
      localStorage.setItem('platform', platform);
      onLogin();
      navigate('/');
    }

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?4';
    script.async = true;
    script.setAttribute('data-telegram-login', process.env.REACT_APP_TELEGRAM_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-auth-url', `${apiUrl}/auth/telegram`);
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'handleTelegramAuth(user)');
    document.getElementById('telegram-login').appendChild(script);

    window.handleTelegramAuth = (user) => {
      fetch(`${apiUrl}/auth/telegram`, {
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
            localStorage.setItem('platform', 'telegram');
            onLogin();
            navigate('/');
          } else {
            console.error('Authentication failed:', data.error);
          }
        });
    };
  }, [onLogin, navigate, location]);

  const handleDiscordLogin = () => {
    const clientId = process.env.REACT_APP_DISCORD_CLIENT_ID;
    const redirectUri = encodeURIComponent(`${apiUrl}/auth/discord/callback`);
    const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify&state=discord`;
    window.location.href = discordAuthUrl;
  };

  return (
    <div className="login-container">
      <img src={brandLogo} alt="Storagegram Logo" className="brand-logo" />
      <Typography variant="h5" className="top-text">Want unlimited storage? Try Storagegram</Typography>
      <div className="login-form">
        <Typography variant="h4" className="title">Login</Typography>
        <div id="telegram-login"></div>
        <div onClick={handleDiscordLogin} className="button discord-button">
          <img src={discordLogo} alt="Discord Logo" className="discord-logo" />
          <span>Login with Discord</span>
        </div>
      </div>
    </div>
  );
}

export default Login;
