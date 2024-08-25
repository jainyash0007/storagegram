import React, { useState } from 'react';
import { Button, Input, LinearProgress, Box } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';

function UploadButton({ refreshFiles }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0); // Track upload progress
  const [uploading, setUploading] = useState(false); // Track if the upload is in progress

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
    setUploadProgress(0); // Reset progress when a new file is selected
  };

  const handleUploadClick = () => {
    if (!selectedFile) {
      alert("Please select a file!");
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    const sessionToken = localStorage.getItem('sessionToken');

    if (!sessionToken) {
      alert("You are not authenticated. Please log in.");
      return;
    }

    setUploading(true);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'http://localhost:3000/api/upload', true);

    xhr.setRequestHeader('Authorization', sessionToken);

    // Track the upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const progress = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(progress); // Update progress percentage
      }
    };

    xhr.onload = function () {
      setUploading(false);
      if (xhr.status === 200) {
        const response = JSON.parse(xhr.responseText);
        if (response.success) {
          // alert(response.message);
          refreshFiles();
          setSelectedFile(null); // Reset selected file after upload
          setUploadProgress(0); // Reset progress after upload
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

    xhr.send(formData); // Send the form data containing the file
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Input type="file" onChange={handleFileChange} />
      <Button
        variant="contained"
        color="primary"
        startIcon={<CloudUploadIcon />}
        onClick={handleUploadClick}
        disabled={!selectedFile || uploading} // Disable button when uploading or no file selected
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
