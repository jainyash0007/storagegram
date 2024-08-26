import React, { useState } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, TextField, Typography, Tooltip, Checkbox, Button, TableSortLabel, InputAdornment,
  Menu, MenuItem, Modal, Box
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import SearchIcon from '@mui/icons-material/Search';
import ShareIcon from '@mui/icons-material/Share';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import FolderIcon from '@mui/icons-material/Folder';

function FileList({ files, folders, refreshFilesAndFolders, onFolderClick }) {
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [editingFileId, setEditingFileId] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [deletingFolderId, setDeletingFolderId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState('file_name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [errorMessage, setErrorMessage] = useState(null);
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [shareLink, setShareLink] = useState(null);
  const [sharedFileName, setSharedFileName] = useState('');
  const [expirationTime, setExpirationTime] = useState(null);
  const [copied, setCopied] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  const validFiles = Array.isArray(files) ? files : [];

  const formatFileSize = (sizeInBytes) => {
    if (sizeInBytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(sizeInBytes) / Math.log(k));
    return parseFloat((sizeInBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleSortRequest = (column) => {
    const isAsc = sortOption === column && sortDirection === 'asc';
    setSortDirection(isAsc ? 'desc' : 'asc');
    setSortOption(column);
  };

  const filteredFiles = validFiles.filter(file =>
    file.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedFiles = filteredFiles.sort((a, b) => {
    let valueA = a[sortOption];
    let valueB = b[sortOption];

    if (sortOption === 'file_size') {
      valueA = Number(a.file_size);
      valueB = Number(b.file_size);
    }

    if (sortDirection === 'asc') {
      return valueA > valueB ? 1 : -1;
    } else {
      return valueA < valueB ? 1 : -1;
    }
  });

  const downloadFile = (fileId, fileName) => {
    const sessionToken = localStorage.getItem('sessionToken');
    setDownloadingFileId(fileId);
    setErrorMessage(null);

    fetch(`http://localhost:3000/api/download/${fileId}`, {
      headers: {
        'Authorization': sessionToken,
      }
    })
      .then(response => {
        setDownloadingFileId(null);
        if (!response.ok) {
          throw new Error('Failed to download file');
        }
        return response.blob();
      })
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch(error => {
        setErrorMessage('Failed to download file. Please try again.');
        console.error('Error downloading file:', error);
      });
  };

  const handleRenameClick = (fileId, currentFileName) => {
    setEditingFileId(fileId);
    setNewFileName(currentFileName);
  };

  const handleRenameFolderClick = (folderId, currentFolderName) => {
    setEditingFolderId(folderId);
    setNewFolderName(currentFolderName);
  };

  const handleRenameSubmit = (fileId) => {
    const sessionToken = localStorage.getItem('sessionToken');

    fetch(`http://localhost:3000/api/files/rename/${fileId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionToken,
      },
      body: JSON.stringify({ newFileName }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to rename file');
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          refreshFilesAndFolders();
          setEditingFileId(null);
          setNewFileName('');
        } else {
          alert('Rename failed: ' + data.error);
        }
      })
      .catch(error => {
        alert('Rename failed');
        console.error('Error renaming file:', error);
      });
  };

  const handleRenameFolderSubmit = (folderId) => {
    const sessionToken = localStorage.getItem('sessionToken');
    fetch(`http://localhost:3000/api/folders/${folderId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionToken,
      },
      body: JSON.stringify({ folderName: newFolderName }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to rename folder');
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          refreshFilesAndFolders();
          setEditingFolderId(null);
          setNewFolderName('');
        } else {
          alert('Rename failed: ' + data.error);
        }
      })
      .catch(error => {
        alert('Rename failed');
        console.error('Error renaming folder:', error);
      });
  };

  const handleDeleteClick = (fileId, fileName) => {
    const sessionToken = localStorage.getItem('sessionToken');
    const confirmDelete = window.confirm(`Are you sure you want to delete the file "${fileName}"?`);

    if (!confirmDelete) return;

    setDeletingFileId(fileId);
    setErrorMessage(null);

    fetch(`http://localhost:3000/api/files/delete/${fileId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': sessionToken,
      }
    })
      .then(response => {
        setDeletingFileId(null);
        if (!response.ok) {
          throw new Error('Failed to delete file');
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          refreshFilesAndFolders();
        } else {
          alert('Delete failed: ' + data.error);
        }
      })
      .catch(error => {
        setDeletingFileId(null);
        alert('Delete failed');
        console.error('Error deleting file:', error);
      });
  };

  const handleDeleteFolderClick = (folderId, folderName) => {
    const sessionToken = localStorage.getItem('sessionToken');
    const confirmDelete = window.confirm(`Are you sure you want to delete the folder "${folderName}"?`);

    if (!confirmDelete) return;

    setDeletingFolderId(folderId);

    fetch(`http://localhost:3000/api/folders/${folderId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': sessionToken,
      }
    })
      .then(response => {
        setDeletingFolderId(null);
        if (!response.ok) {
          throw new Error('Failed to delete folder');
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          refreshFilesAndFolders();
        } else {
          alert('Delete failed: ' + data.error);
        }
      })
      .catch(error => {
        setDeletingFolderId(null);
        alert('Delete failed');
        console.error('Error deleting folder:', error);
      });
  };

  const handleBulkDelete = () => {
    const sessionToken = localStorage.getItem('sessionToken');
    const confirmDelete = window.confirm('Are you sure you want to delete the selected files?');

    if (!confirmDelete) return;

    const promises = selectedFiles.map(fileId =>
      fetch(`http://localhost:3000/api/files/delete/${fileId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': sessionToken,
        }
      })
    );

    Promise.all(promises)
      .then(() => {
        refreshFilesAndFolders();
        setSelectedFiles([]);  // Clear selected files
      })
      .catch(error => {
        alert('Bulk delete failed');
        console.error('Error deleting files:', error);
      });
  };

  const handleSelectFile = (fileId) => {
    setSelectedFiles(prev =>
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  const generateShareLink = (fileId) => {
    fetch(`http://localhost:3000/api/files/share/${fileId}`, {
      method: 'POST',
      headers: {
        'Authorization': localStorage.getItem('sessionToken'),
      }
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        setShareLink(data.shareableLink);
        setExpirationTime(new Date(data.expirationDate).toLocaleString());
        setSharedFileName(data.fileName);
        setCopied(false); // Reset copy state
      } else {
        alert('Failed to generate share link');
      }
    })
    .catch(error => {
      console.error('Error generating share link:', error);
    });
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
  };

  const handleContextMenu = (event, file) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX - 2, mouseY: event.clientY - 4 });
    setSelectedFile(file);
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleFileActivity = () => {
    fetch(`http://localhost:3000/api/files/${selectedFile.file_id}/activity`, {
      headers: {
        'Authorization': localStorage.getItem('sessionToken'),
      }
    })
      .then(response => response.json())
      .then(data => {
        setActivityLogs(data);
        setActivityModalOpen(true);
        handleCloseContextMenu();
      })
      .catch(error => console.error('Error fetching activity logs:', error));
  };

  return (
    <div>
      <Typography variant="h5" gutterBottom>Your Files and Folders</Typography>
      {/* Render Folders */}
      <Typography variant="h6">Folders</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Folder Name</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {folders.length > 0 ? (
              folders.map((folder) => (
                <TableRow key={folder.folder_id}>
                  <TableCell>
                    {editingFolderId === folder.folder_id ? (
                      <TextField
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        fullWidth
                      />
                    ) : (
                      <>
                        <IconButton onClick={() => onFolderClick(folder.folder_id)}>
                          <FolderIcon />
                        </IconButton>
                        {folder.folder_name}
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    {editingFolderId === folder.folder_id ? (
                      <>
                        <Tooltip title="Save">
                          <IconButton onClick={() => handleRenameFolderSubmit(folder.folder_id)}>
                            <SaveIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <IconButton onClick={() => setEditingFolderId(null)}>
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        <Tooltip title="Rename">
                          <IconButton onClick={() => handleRenameFolderClick(folder.folder_id, folder.folder_name)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            onClick={() => handleDeleteFolderClick(folder.folder_id, folder.folder_name)}
                            disabled={deletingFolderId === folder.folder_id}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={2}>
                  <Typography align="center">No folders found.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <TextField
          label="Search Files"
          variant="outlined"
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          margin="normal"
        />
        {selectedFiles.length > 1 && (
          <Button
            variant="contained"
            color="secondary"
            onClick={handleBulkDelete}
            style={{ marginLeft: '16px' }}  // Aligns the button next to the search input
          >
            Delete Selected Files
          </Button>
        )}
      </div>

      {errorMessage && <Typography color="error">{errorMessage}</Typography>}
      <Typography variant="h6" style={{ marginTop: '20px' }}>Files</Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedFiles.length > 0 && selectedFiles.length < validFiles.length}
                  checked={selectedFiles.length === validFiles.length}
                  onChange={(e) => setSelectedFiles(e.target.checked ? validFiles.map(file => file.file_id) : [])}
                />
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortOption === 'file_name'}
                  direction={sortDirection}
                  onClick={() => handleSortRequest('file_name')}
                >
                  File Name
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortOption === 'last_modified_date'}
                  direction={sortDirection}
                  onClick={() => handleSortRequest('last_modified_date')}
                >
                  Last Modified
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortOption === 'file_size'}
                  direction={sortDirection}
                  onClick={() => handleSortRequest('file_size')}
                >
                  Size
                </TableSortLabel>
              </TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedFiles.length > 0 ? (
              sortedFiles.map((file) => (
                <TableRow key={file.file_id} selected={selectedFiles.includes(file.file_id)} onContextMenu={(event) => handleContextMenu(event, file)}
                  style={{ cursor: 'context-menu' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedFiles.includes(file.file_id)}
                      onChange={() => handleSelectFile(file.file_id)}
                    />
                  </TableCell>
                  <TableCell>
                    {editingFileId === file.file_id ? (
                      <TextField
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        fullWidth
                      />
                    ) : (
                      file.file_name
                    )}
                  </TableCell>
                  <TableCell>{new Date(file.last_modified_date).toLocaleString()}</TableCell>
                  <TableCell>{formatFileSize(file.file_size)}</TableCell>
                  <TableCell>
                    {editingFileId === file.file_id ? (
                      <>
                        <Tooltip title="Save">
                          <IconButton onClick={() => handleRenameSubmit(file.file_id)}>
                            <SaveIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <IconButton onClick={() => setEditingFileId(null)}>
                            <CancelIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        <Tooltip title="Download">
                          <IconButton
                            onClick={() => downloadFile(file.file_id, file.file_name)}
                            disabled={downloadingFileId === file.file_id}
                          >
                            <DownloadIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Rename">
                          <IconButton onClick={() => handleRenameClick(file.file_id, file.file_name)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            onClick={() => handleDeleteClick(file.file_id, file.file_name)}
                            disabled={deletingFileId === file.file_id || selectedFiles.length > 1}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Share">
                          <IconButton onClick={() => generateShareLink(file.file_id)}>
                            <ShareIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography align="center">No files found.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleFileActivity}>File Activity</MenuItem>
      </Menu>

      {/* Activity Log Modal */}
      <Modal
        open={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
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
            borderRadius: 2,
          }}
        >
          <Typography variant="h6">Activity Logs for {selectedFile?.file_name}</Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableBody>
                {activityLogs.length > 0 ? (
                  activityLogs.map(log => (
                    <TableRow key={log.activity_id}>
                      <TableCell>{log.activity_type}</TableCell>
                      <TableCell>{new Date(log.activity_timestamp).toLocaleString()}</TableCell>
                      <TableCell>{log.details}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3}>No activity logs found.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      </Modal>
      {/* Show shareable link if available */}
      {shareLink && (
        <div style={{ marginTop: '20px' }}>
          <Typography variant="body1">Shareable Link for <strong>{sharedFileName}</strong> (Expires in 30 minutes):</Typography>
          <TextField
            value={shareLink}
            fullWidth
            InputProps={{
              endAdornment: (
                <IconButton onClick={copyToClipboard}>
                  <FileCopyIcon />
                  {copied && <Typography variant="body2" color="primary">Copied</Typography>}
                </IconButton>
              ),
            }}
          />
          <Typography variant="body2" color="textSecondary">
            Expires at: {expirationTime}
          </Typography>
        </div>
      )}
    </div>
  );
}

export default FileList;
