import React, { useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';

function SharedFileDownload() {
  const apiShareUrl = process.env.REACT_APP_API_SHARE_URL;
  const { token } = useParams();
  const location = useLocation();

  const queryParams = new URLSearchParams(location.search);
  const fileName = queryParams.get('fileName') || 'downloaded_file';

  const downloadSharedFile = (sharedLinkToken) => {
    fetch(`${apiShareUrl}/share/token/${sharedLinkToken}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to download file');
        }
        return response.text();
      })
      .then((base64String) => {
        const byteCharacters = atob(base64String);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/octet-stream' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      })
      .catch((error) => {
        console.error('Error downloading shared file:', error);
      });
  };

  useEffect(() => {
    if (token) {
      downloadSharedFile(token);
    }
  }, [token]);

  return (
    <div>
      <h1>Downloading File...</h1>
    </div>
  );
}

export default SharedFileDownload;
