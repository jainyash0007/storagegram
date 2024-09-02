import React, { useState, useEffect, useCallback } from 'react';
import UploadButton from './UploadButton';
import FileList from './FileList';
import FolderOperations from './FolderOperations';
import LogoutButton from './LogoutButton';
import { AppBar, Toolbar, Typography, Container, Box, Breadcrumbs, Link, IconButton, Menu, TextField, InputAdornment } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink } from 'react-router-dom';

function Home() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
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

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  return (
    <div>
      {/* AppBar with Search Bar and Logout Button */}
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component={RouterLink} to="/" sx={{ flexGrow: 1, marginLeft: 1, textDecoration: 'none', color: 'inherit' }}>
            Storagegram
          </Typography>
          <TextField
            placeholder="Search Files"
            variant="outlined"
            value={searchQuery}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
            sx={{ marginRight: 115, bgcolor: 'white', borderRadius: 1, width: 500}} // Styling for better integration
          />
          <LogoutButton /> {/* Positioned on the right side of the toolbar */}
        </Toolbar>
      </AppBar>

      {/* Content Section */}
      <Container>
        <Box mt={4}>
          {/* "New" Button */}
          <IconButton
            edge="start"
            color="inherit"
            aria-label="new"
            onClick={handleMenuClick}
          >
            <AddIcon />New
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <FolderOperations refreshFilesAndFolders={refreshFilesAndFolders} currentFolderId={currentFolderId} handleMenuClose={handleMenuClose} />
            <UploadButton refreshFilesAndFolders={refreshFilesAndFolders} currentFolderId={currentFolderId} handleMenuClose={handleMenuClose} />
          </Menu>
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

          <FileList
            files={files}
            folders={folders}
            refreshFilesAndFolders={refreshFilesAndFolders}
            onFolderClick={handleFolderClick}
            searchQuery={searchQuery}
          />
        </Box>
      </Container>
    </div>
  );
}

export default Home;
