import React, { useState, useEffect } from 'react';
import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
  IconButton, TextField, Typography, Tooltip, Checkbox, Button, TableSortLabel,
  Menu, MenuItem, Modal, Box
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import CancelIcon from '@mui/icons-material/Cancel';
import ShareIcon from '@mui/icons-material/Share';
import FileCopyIcon from '@mui/icons-material/FileCopy';
import FolderIcon from '@mui/icons-material/Folder';
import { useLocation } from 'react-router-dom';

function FileList({ files, folders, refreshFilesAndFolders, onFolderClick, searchQuery }) {
  const [downloadingFileId, setDownloadingFileId] = useState(null);
  const [editingFileId, setEditingFileId] = useState(null);
  const [newFileName, setNewFileName] = useState('');
  const [deletingFileId, setDeletingFileId] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);

  const [editingFolderId, setEditingFolderId] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [deletingFolderId, setDeletingFolderId] = useState(null);

  const [sortOption, setSortOption] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [errorMessage, setErrorMessage] = useState(null);

  const [shareLink, setShareLink] = useState(null);
  const [sharedFileName, setSharedFileName] = useState('');
  const [expirationTime, setExpirationTime] = useState(null);
  const [copied, setCopied] = useState(false);
  const location = useLocation();

  const [contextMenu, setContextMenu] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  const combinedItems = [...folders.map(folder => ({ ...folder, type: 'folder' })), ...files.map(file => ({ ...file, type: 'file' }))];

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

  const filteredItems = combinedItems.filter(item =>
    item.type === 'folder' ? item.folder_name.toLowerCase().includes(searchQuery.toLowerCase()) :
    item.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedItems = filteredItems.sort((a, b) => {
    let valueA = a.type === 'folder' ? a.folder_name : a.file_name;
    let valueB = b.type === 'folder' ? b.folder_name : b.file_name;

    if (sortOption === 'file_size') {
      valueA = a.file_size || 0;
      valueB = b.file_size || 0;
    }

    if (sortDirection === 'asc') {
      return valueA > valueB ? 1 : -1;
    } else {
      return valueA < valueB ? 1 : -1;
    }
  }).sort((a, b) => a.type === 'folder' && b.type !== 'folder' ? -1 : b.type === 'folder' && a.type !== 'folder' ? 1 : 0);

  const downloadFile = (fileId, fileName) => {
    const sessionToken = localStorage.getItem('sessionToken');
    setDownloadingFileId(fileId);
    setErrorMessage(null);

    fetch(`http://localhost:3000/api/files/download/${fileId}`, {
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

  const handleRenameClick = (item) => {
    if (item.type === 'folder') {
      setEditingFolderId(item.folder_id);
      setNewFolderName(item.folder_name);
    } else {
      setEditingFileId(item.file_id);
      setNewFileName(item.file_name);
    }
  };

  const handleRenameSubmit = (item) => {
    const sessionToken = localStorage.getItem('sessionToken');
    const url = item.type === 'folder' ? `http://localhost:3000/api/folders/${item.folder_id}` : `http://localhost:3000/api/files/rename/${item.file_id}`;
    const body = item.type === 'folder' ? { folderName: newFolderName } : { newFileName };

    fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': sessionToken,
      },
      body: JSON.stringify(body),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to rename');
        }
        return response.json();
      })
      .then(data => {
        if (data.success) {
          refreshFilesAndFolders();
          setEditingFileId(null);
          setEditingFolderId(null);
          setNewFileName('');
          setNewFolderName('');
        } else {
          alert('Rename failed: ' + data.error);
        }
      })
      .catch(error => {
        alert('Rename failed');
        console.error('Error renaming:', error);
      });
  };

  const handleDeleteClick = (item) => {
    const sessionToken = localStorage.getItem('sessionToken');
    const confirmDelete = window.confirm(`Are you sure you want to delete the ${item.type} "${item.type === 'folder' ? item.folder_name : item.file_name}"?`);

    if (!confirmDelete) return;

    const url = item.type === 'folder' ? `http://localhost:3000/api/folders/${item.folder_id}` : `http://localhost:3000/api/files/delete/${item.file_id}`;

    fetch(url, {
      method: 'DELETE',
      headers: {
        'Authorization': sessionToken,
      }
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Failed to delete');
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
        alert('Delete failed');
        console.error('Error deleting:', error);
      });
  };

  const handleBulkDelete = () => {
    const sessionToken = localStorage.getItem('sessionToken');
    const confirmDelete = window.confirm('Are you sure you want to delete the selected items?');

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

  const handleBulkDownload = () => {
    const sessionToken = localStorage.getItem('sessionToken');
    const fileIds = selectedFiles;

    fetch('http://localhost:3000/api/files/download/zip', {
        method: 'POST',
        headers: {
            'Authorization': sessionToken,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ fileIds }),
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to download files');
        }
        return response.blob();
    })
    .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', 'files.zip');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    })
    .catch(error => {
        console.error('Error downloading files:', error);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setShareLink(null);
      setSharedFileName('');
      setExpirationTime(null);
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, [shareLink]);

  useEffect(() => {
    return () => {
      setShareLink(null);
      setSharedFileName('');
      setExpirationTime(null);
    };
  }, [location]);

  return (
    <div>
      {/* Container for Buttons */}
      <div style={{ position: 'relative', height: '60px' }}>
        {selectedFiles.length > 1 && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            zIndex: 1000, 
            backgroundColor: '#fff', 
            padding: '10px 0', 
            display: 'flex', 
            justifyContent: 'flex-start', 
            gap: '10px', 
            borderBottom: '1px solid #ccc' 
          }}>
            <Button
              variant="contained"
              color="secondary"
              onClick={handleBulkDelete}
            >
              Delete Selected Files
            </Button>
            <Button
                variant="contained"
                color="primary"
                onClick={handleBulkDownload}
            >
                Download Selected Files
            </Button>
          </div>
        )}
      </div>
      <TableContainer component={Paper}>
      {errorMessage && <Typography color="error">{errorMessage}</Typography>}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  indeterminate={selectedFiles.length > 0 && selectedFiles.length < combinedItems.filter(item => item.type === 'file').length}
                  checked={selectedFiles.length === combinedItems.filter(item => item.type === 'file').length}
                  onChange={(e) => setSelectedFiles(e.target.checked ? combinedItems.filter(item => item.type === 'file').map(item => item.file_id) : [])}
                />
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortOption === 'name'}
                  direction={sortDirection}
                  onClick={() => handleSortRequest('name')}
                >
                  Name
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
            {sortedItems.length > 0 ? (
              sortedItems.map((item) => (
                <TableRow key={item.type === 'folder' ? item.folder_id : item.file_id} selected={selectedFiles.includes(item.file_id)} onContextMenu={(event) => handleContextMenu(event, item)}
                  style={{ cursor: 'context-menu' }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={item.type === 'file' && selectedFiles.includes(item.file_id)}
                      onChange={() => handleSelectFile(item.file_id)}
                      disabled={item.type === 'folder'}
                    />
                  </TableCell>
                  <TableCell>
                    {item.type === 'folder' ? (
                      <>
                        <IconButton onClick={() => onFolderClick(item.folder_id)}>
                          <FolderIcon />
                        </IconButton>
                        {editingFolderId === item.folder_id ? (
                          <TextField
                            value={newFolderName}
                            onChange={(e) => setNewFolderName(e.target.value)}
                            fullWidth
                          />
                        ) : (
                          item.folder_name
                        )}
                      </>
                    ) : (
                      editingFileId === item.file_id ? (
                        <TextField
                          value={newFileName}
                          onChange={(e) => setNewFileName(e.target.value)}
                          fullWidth
                        />
                      ) : (
                        item.file_name
                      )
                    )}
                  </TableCell>
                  <TableCell>{new Date(item.last_modified_date).toLocaleString()}</TableCell>
                  <TableCell>{item.type === 'folder' ? '-' : formatFileSize(item.file_size)}</TableCell>
                  <TableCell>
                    {item.type === 'folder' ? (
                      <>
                        {editingFolderId === item.folder_id ? (
                          <>
                            <Tooltip title="Save">
                              <IconButton onClick={() => handleRenameSubmit(item)}>
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
                              <IconButton onClick={() => handleRenameClick(item)}>
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                onClick={() => handleDeleteClick(item)}
                                disabled={deletingFolderId === item.folder_id}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {editingFileId === item.file_id ? (
                          <>
                            <Tooltip title="Save">
                              <IconButton onClick={() => handleRenameSubmit(item)}>
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
                                onClick={() => downloadFile(item.file_id, item.file_name)}
                                disabled={downloadingFileId === item.file_id || selectedFiles.length > 1}
                              >
                                <DownloadIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Rename">
                              <IconButton onClick={() => handleRenameClick(item)}>
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete">
                              <IconButton
                                onClick={() => handleDeleteClick(item)}
                                disabled={deletingFileId === item.file_id || selectedFiles.length > 1}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Share">
                              <IconButton onClick={() => generateShareLink(item.file_id)}>
                                <ShareIcon />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5}>
                  <Typography align="center">No items found.</Typography>
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
            maxHeight: '80vh',
            overflowY: 'auto',
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
                      <TableCell><span dangerouslySetInnerHTML={{ __html: log.details }}/></TableCell>
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
