import React, { useState } from 'react';
import { Button, Input, LinearProgress, Box } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

function UploadButton({ refreshFilesAndFolders, currentFolderId }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0); 
  const [uploading, setUploading] = useState(false); 

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setUploadProgress(0); 
  };

  const handleUploadClick = () => {
    if (!selectedFile) {
      alert("Please select a file!");
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);
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
    xhr.open('POST', 'http://localhost:3000/api/upload', true);

    xhr.setRequestHeader('Authorization', sessionToken);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(progress); 
      }
    };

    xhr.onload = function () {
      setUploading(false);
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        if (response.success) {
          refreshFilesAndFolders();
          setSelectedFile(null); 
          setUploadProgress(0); 
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

    xhr.send(formData); 
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Input type="file" onChange={handleFileChange} />
      <Button
        variant="contained"
        color="primary"
        startIcon={<CloudUploadIcon />}
        onClick={handleUploadClick}
        disabled={!selectedFile || uploading}
        sx={{ mt: 2 }}
      >
        {uploading ? 'Uploading...' : 'Upload File via Telegram'}
      </Button>

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
