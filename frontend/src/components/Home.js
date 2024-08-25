import React, { useState, useEffect, useCallback } from 'react';
import UploadButton from './UploadButton';
import FileList from './FileList';
import LogoutButton from './LogoutButton';
import { AppBar, Toolbar, Typography, Container, Box } from '@mui/material';

function Home() {
  const [files, setFiles] = useState([]);
  const sessionToken = localStorage.getItem('sessionToken');

  const refreshFiles = useCallback(() => {
    if (sessionToken) {
      fetch('http://localhost:3000/api/files', {
        headers: {
          'Authorization': sessionToken
        },
      })
        .then(response => {
          if (!response.ok) {
            throw new Error('Unauthorized or failed to fetch files');
          }
          return response.json();
        })
        .then(data => setFiles(data))
        .catch(error => console.error('Error fetching files:', error));
    }
  }, [sessionToken]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  return (
    <div>
      {/* AppBar with Logout Button */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Storagegram
          </Typography>
          <LogoutButton /> {/* Positioned on the right side of the toolbar */}
        </Toolbar>
      </AppBar>

      {/* Content Section */}
      <Container>
        <Box mt={4}>
          <Typography variant="h4" gutterBottom>Welcome to Storagegram</Typography>
          <Typography variant="body1" gutterBottom>Manage your files via Telegram or Discord.</Typography>
          <UploadButton refreshFiles={refreshFiles} />
          <FileList files={files} refreshFiles={refreshFiles} />
        </Box>
      </Container>
    </div>
  );
}

export default Home;
