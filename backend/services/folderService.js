const { pool } = require('../db');

const createFolder = async (req) => {
  const sessionToken = req.headers.authorization;
  const { folderName, parentFolderId } = req.body;

  const { userId } = await validateSession(sessionToken);

  const result = await pool.query(
    'INSERT INTO folders (folder_name, parent_folder_id, user_id) VALUES ($1, $2, $3) RETURNING *',
    [folderName, parentFolderId || null, userId]
  );

  return { success: true, folder: result.rows[0] };
};

const renameFolder = async (req) => {
  const sessionToken = req.headers.authorization;
  const { folderName } = req.body;
  const { folderId } = req.params;

  const { userId } = await validateSession(sessionToken);

  const result = await pool.query(
    'UPDATE folders SET folder_name = $1, last_modified_date = NOW() WHERE folder_id = $2 AND user_id = $3 RETURNING *',
    [folderName, folderId, userId]
  );

  return { success: true, folder: result.rows[0] };
};

const deleteFolder = async (req) => {
  const sessionToken = req.headers.authorization;
  const { folderId } = req.params;

  const { userId } = await validateSession(sessionToken);

  // Delete all subfolders and files within the folder
  await deleteSubfoldersAndFiles(folderId, userId);

  // Delete the folder itself
  const result = await pool.query('DELETE FROM folders WHERE folder_id = $1 AND user_id = $2 RETURNING *', [folderId, userId]);

  return { success: true, folder: result.rows[0] };
};

const deleteSubfoldersAndFiles = async (folderId, userId) => {
  const subfoldersResult = await pool.query('SELECT folder_id FROM folders WHERE parent_folder_id = $1 AND user_id = $2', [folderId, userId]);

  for (const subfolder of subfoldersResult.rows) {
    await deleteSubfoldersAndFiles(subfolder.folder_id, userId); // Recursively delete subfolders
  }

  await pool.query('DELETE FROM files WHERE folder_id = $1 AND chat_id = $2', [folderId, userId]); // Delete files in the folder
  await pool.query('DELETE FROM folders WHERE folder_id = $1 AND user_id = $2', [folderId, userId]); // Delete the folder
};

const listFoldersAndFiles = async (req) => {
  const sessionToken = req.headers.authorization;
  const { folderId } = req.params;

  const { userId } = await validateSession(sessionToken);

  const folderQuery = `
      SELECT * FROM folders 
      WHERE user_id = $1 
      ${folderId ? 'AND parent_folder_id = $2' : 'AND parent_folder_id IS NULL'}
    `;

    const fileQuery = `
    SELECT * FROM files 
    WHERE chat_id = $1 
    ${folderId ? 'AND folder_id = $2' : 'AND folder_id IS NULL'}
  `;

  const foldersResult = await pool.query(folderQuery, folderId ? [userId, folderId] : [userId]);
  const filesResult = await pool.query(fileQuery, folderId ? [userId, folderId] : [userId]);

  return {
    folders: foldersResult.rows.length ? foldersResult.rows : [],
    files: filesResult.rows.length ? filesResult.rows : [],
  };
};

const getFolderPath = async (req) => {
  const sessionToken = req.headers.authorization;
  const { folderId } = req.params;

  const { userId } = await validateSession(sessionToken);

  const getFolderPathRecursive = async (folderId, path = []) => {
    if (!folderId) {
      return path.reverse();
    }

    const result = await pool.query('SELECT folder_id, folder_name, parent_folder_id FROM folders WHERE folder_id = $1 AND user_id = $2', [folderId, userId]);

    const folder = result.rows[0];
    path.push({ folderId: folder.folder_id, folderName: folder.folder_name });

    return getFolderPathRecursive(folder.parent_folder_id, path);
  };

  const folderPath = await getFolderPathRecursive(folderId);

  return { path: folderPath };
};

const validateSession = async (sessionToken) => {
  const sessionResult = await pool.query(
    'SELECT user_id, expires_at FROM sessions WHERE token = $1',
    [sessionToken]
  );

  if (sessionResult.rows.length === 0) {
    throw new Error('Unauthorized: Invalid session token');
  }

  const { user_id: userId, expires_at: expiresAt } = sessionResult.rows[0];

  if (new Date() > new Date(expiresAt)) {
    throw new Error('Unauthorized: Session expired');
  }

  return { userId, expiresAt };
};


module.exports = {
  createFolder,
  renameFolder,
  deleteFolder,
  listFoldersAndFiles,
  getFolderPath,
};
