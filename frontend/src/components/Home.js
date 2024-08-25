import React, { useState, useEffect, useCallback } from 'react';
import UploadButton from './UploadButton';
import FileList from './FileList';
import FolderOperations from './FolderOperations';
import LogoutButton from './LogoutButton';
import { AppBar, Toolbar, Typography, Container, Box, Breadcrumbs, Link } from '@mui/material';

function Home() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const sessionToken = localStorage.getItem('sessionToken');

  const refreshFilesAndFolders = useCallback(() => {
    if (sessionToken) {
      fetch(`http://localhost:3000/api/folders/${currentFolderId || ''}`, {
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
        .then(data => {
          setFiles(data.files);
          setFolders(data.folders);
        })
        .catch(error => console.error('Error fetching files and folders:', error));
        if (currentFolderId) {
          fetch(`http://localhost:3000/api/folders/path/${currentFolderId}`, {
            headers: {
              'Authorization': sessionToken
            },
          })
          .then(response => {
            if (!response.ok) {
              throw new Error('Failed to fetch folder path');
            }
            return response.json();
          })
          .then(data => setFolderPath(data.path))
          .catch(error => console.error('Error fetching folder path:', error));
        } else {
          setFolderPath([]); // Reset to root if no folder is selected
        }
    }
  }, [sessionToken, currentFolderId]);

  useEffect(() => {
    refreshFilesAndFolders();
  }, [refreshFilesAndFolders]);

  const handleFolderClick = (folderId) => {
    setCurrentFolderId(folderId); // Navigate to the clicked folder
  };

  const handleBreadcrumbClick = (folderId) => {
    setCurrentFolderId(folderId); // Navigate using breadcrumb
  };

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
          
          {/* Breadcrumbs for folder navigation */}
          <Breadcrumbs aria-label="breadcrumb">
            <Link
              color="inherit"
              onClick={() => handleBreadcrumbClick(null)}
              style={{ cursor: 'pointer' }}
            >
              Root
            </Link>
            {folderPath.map((folder, index) => (
              <Link
                key={folder.folderId}
                color={index === folderPath.length - 1 ? 'textPrimary' : 'inherit'}
                onClick={() => handleBreadcrumbClick(folder.folderId)}
                style={{ cursor: 'pointer' }}
              >
                {folder.folderName}
              </Link>
            ))}
          </Breadcrumbs>

          {/* Folder Operations (Create, Rename, Delete) */}
          <FolderOperations refreshFilesAndFolders={refreshFilesAndFolders} currentFolderId={currentFolderId} />

          <UploadButton refreshFilesAndFolders={refreshFilesAndFolders} currentFolderId={currentFolderId} />
          <FileList
            files={files}
            folders={folders}
            refreshFilesAndFolders={refreshFilesAndFolders}
            onFolderClick={handleFolderClick}
          />
        </Box>
      </Container>
    </div>
  );
}

export default Home;
