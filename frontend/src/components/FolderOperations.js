import React, { useState } from 'react';
import { Button, TextField, Box } from '@mui/material';

function FolderOperations({ refreshFilesAndFolders, currentFolderId }) {
  const [folderName, setFolderName] = useState('');

  const handleCreateFolder = () => {
    const sessionToken = localStorage.getItem('sessionToken');

    if (!folderName) {
      alert('Please enter a folder name');
      return;
    }

    fetch('http://localhost:3000/api/folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionToken,
      },
      body: JSON.stringify({
        folderName,
        parentFolderId: currentFolderId,
      }),
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        setFolderName(''); // Clear the input
        refreshFilesAndFolders(); // Refresh files and folders
      } else {
        alert('Error creating folder: ' + data.error);
      }
    })
    .catch(error => {
      console.error('Error creating folder:', error);
    });
  };

  return (
    <Box sx={{ mt: 2 }}>
      <TextField
        label="New Folder Name"
        value={folderName}
        onChange={(e) => setFolderName(e.target.value)}
        variant="outlined"
        size="small"
        sx={{ mr: 2 }}
      />
      <Button
        variant="contained"
        color="primary"
        onClick={handleCreateFolder}
      >
        Create Folder
      </Button>
    </Box>
  );
}

export default FolderOperations;
