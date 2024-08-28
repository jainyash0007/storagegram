import React, { useState } from 'react';
import { Button, TextField, Box, Modal, Typography, MenuItem } from '@mui/material';

function FolderOperations({ refreshFilesAndFolders, currentFolderId, handleMenuClose }) {
  const [folderName, setFolderName] = useState('');
  const [open, setOpen] = useState(false);

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
        setOpen(false); // Close modal
        handleMenuClose(); // Close dropdown
      } else {
        alert('Error creating folder: ' + data.error);
      }
    })
    .catch(error => {
      console.error('Error creating folder:', error);
    });
  };

  const handleOpen = () => {
    setFolderName('');
    setOpen(true);
  };
  const handleClose = () => setOpen(false);

  return (
    <>
      <MenuItem onClick={handleOpen}>
        New Folder
      </MenuItem>
      <Modal
        open={open}
        onClose={handleClose}
      >
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 400,
            bgcolor: 'background.paper',
            border: '2px solid #000',
            boxShadow: 24,
            p: 4,
          }}
        >
          <Typography variant="h6" component="h2">
            New Folder
          </Typography>
          <TextField
            fullWidth
            label="Folder Name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            sx={{ mt: 2 }}
          />
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleClose} sx={{ mr: 2 }}>Cancel</Button>
            <Button variant="contained" onClick={handleCreateFolder}>Create</Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}

export default FolderOperations;
