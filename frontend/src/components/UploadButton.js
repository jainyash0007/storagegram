import React, { useState, useRef } from 'react';
import { LinearProgress, Box, MenuItem } from '@mui/material';
import debounce from 'lodash/debounce';

function UploadButton({ refreshFilesAndFolders, currentFolderId, handleMenuClose }) {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const apiUrl = process.env.REACT_APP_API_URL;

  const handleFileChange = debounce((event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      uploadFile(selectedFile);
    }
  }, 300); // Debounce with a 300ms delay

  const uploadFile = (selectedFile) => {
    const formData = new FormData();
    formData.append('file', selectedFile);
    const platform = localStorage.getItem('platform');
  
    if (!platform) {
      alert("Platform not found. Please log in again.");
      return;
    }
    formData.append('platform', platform);
    if (currentFolderId) {
      formData.append('folderId', currentFolderId);
    }
  
    const sessionToken = localStorage.getItem('sessionToken');
  
    if (!sessionToken) {
      alert("You are not authenticated. Please log in.");
      return;
    }
  
    setUploading(true);
  
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${apiUrl}/files/upload`, true);
  
    // Set authorization header
    xhr.setRequestHeader('Authorization', sessionToken);
  
    // Log headers after the request completes
    xhr.onload = function () {
      setUploading(false);
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        if (response.success) {
          refreshFilesAndFolders();
          setUploadProgress(0);
          handleMenuClose();
        } else {
          alert('File upload failed: ' + response.error);
        }
      } else {
        alert('File upload failed');
      }
    };
  
    xhr.onerror = function () {
      setUploading(false);
      alert('File upload failed');
    };
  
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(progress);
      }
    };
    xhr.send(formData);
  };

  return (
    <Box sx={{ mt: 2 }}>
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <MenuItem onClick={() => fileInputRef.current.click()}>
        File Upload
      </MenuItem>

      {uploading && (
        <Box sx={{ width: '100%', mt: 2 }}>
          <LinearProgress variant="determinate" value={uploadProgress} />
          <p>{uploadProgress}%</p>
        </Box>
      )}
    </Box>
  );
}

export default UploadButton;
