import React, { useState } from 'react';
import { Container, TextField, Button, Typography, Box, Link, Grid, AppBar, Toolbar } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import LogoutButton from './LogoutButton';
import emailjs from 'emailjs-com';

function Contact() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();

    const templateParams = {
      from_name: name,
      from_email: email,
      message: message,
    };

    emailjs
      .send(process.env.REACT_APP_SERVICE_ID, process.env.REACT_APP_TEMPLATE_ID, templateParams, process.env.REACT_APP_USER_ID)
      .then(
        (response) => {
          console.log('Email successfully sent!', response.status, response.text);
          alert('Message sent successfully!');
        },
        (error) => {
          console.error('Failed to send email:', error);
          alert('Failed to send message. Please try again later.');
        }
      );

    // Clear the form
    setName('');
    setEmail('');
    setMessage('');
  };

  return (
    <Container>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component={RouterLink} to="/" style={{ color: 'inherit', textDecoration: 'none' }}>
            Home
          </Typography>
          <LogoutButton />
        </Toolbar>
      </AppBar>

      <Box mt={4}>
        <Typography variant="h4" gutterBottom>
          Contact Me
        </Typography>

        <Grid container spacing={2} mb={4}>
          <Grid item xs={12}>
            <Typography variant="h6">Email:</Typography>
            <Link href="mailto:jainyash2108@gmail.com" target="_blank">
              jainyash2108@gmail.com
            </Link>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6">LinkedIn:</Typography>
            <Link href="https://www.linkedin.com/in/jainyash0007/" target="_blank">
                Connect with Me
            </Link>
          </Grid>
          <Grid item xs={12}>
            <Typography variant="h6">GitHub:</Typography>
            <Link href="https://github.com/jainyash0007" target="_blank">
              Follow Me
            </Link>
          </Grid>
        </Grid>

        {/* Contact Form */}
        <form onSubmit={handleSubmit}>
          <TextField
            label="Name"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            label="Email"
            fullWidth
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            margin="normal"
            required
          />
          <TextField
            label="Message"
            fullWidth
            multiline
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            margin="normal"
            required
          />
          <Button type="submit" variant="contained" color="primary" mt={2}>
            Send Message
          </Button>
        </form>
      </Box>
    </Container>
  );
}

export default Contact;
