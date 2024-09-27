const { db } = require('../db');

const createFolder = async (req) => {
  try {
    const sessionToken = req.headers.authorization;
    const { folderName, parentFolderId } = req.body;

    const { userId } = await validateSession(sessionToken);

    // Get the current folder_id from the counter
    const counterRef = db.collection('counters').doc('folder_counter');
    const counterDoc = await counterRef.get();

    if (!counterDoc.exists) {
      throw new Error('Folder counter not initialized');
    }

    let currentFolderId = counterDoc.data().current_folder_id;
    const newFolderId = currentFolderId + 1;

    // Save the folder metadata, using the newFolderId as the document ID
    await db.collection('folders').doc(String(newFolderId)).set({
      folder_id: newFolderId,  // Store the incremented folder ID
      folder_name: folderName,
      parent_folder_id: parentFolderId || null,
      user_id: userId,
      created_at: new Date(),
      last_modified_date: new Date(),
    });

    // Update the folder counter
    await counterRef.update({ current_folder_id: newFolderId });

    console.log(`Folder created with id: ${newFolderId}`);

    return { success: true, folder: { folder_id: newFolderId, folder_name: folderName, parent_folder_id: parentFolderId, user_id: userId } };
  } catch (error) {
    console.error('Error creating folder:', error);
    throw new Error('Failed to create folder');
  }
};

const renameFolder = async (req) => {
  const sessionToken = req.headers.authorization;
  const { folderName } = req.body;
  const { folderId } = req.params;

  const { userId } = await validateSession(sessionToken);

  const folderRef = db.collection('folders').doc(folderId);
  const folder = await folderRef.get();

  if (!folder.exists || folder.data().user_id !== userId) {
    throw new Error('Folder not found or access denied');
  }

  await folderRef.update({
    folder_name: folderName,
    last_modified_date: new Date(),
  });

  return { success: true, folder: { ...folder.data(), folder_name: folderName } };
};

const deleteFolder = async (req) => {
  const sessionToken = req.headers.authorization;
  const { folderId } = req.params;
  const batch = db.batch();

  const { userId } = await validateSession(sessionToken);

  const folderSnapshot = await db.collection('folders').where('folder_id', '==', Number(folderId)).where('user_id', '==', userId).get();

  if (folderSnapshot.empty) {
    throw new Error('Folder not found or access denied');
  }
  
  const folder = folderSnapshot.docs[0];

  await deleteSubfoldersAndFiles(folderId, userId);
  
  batch.delete(folder.ref);

  await batch.commit();

  return { success: true, folder: folder.data() };
};

const deleteSubfoldersAndFiles = async (folderId, userId) => {
  const subfoldersSnapshot = await db.collection('folders').where('parent_folder_id', '==', folderId).where('user_id', '==', userId).get();

  for (const subfolder of subfoldersSnapshot.docs) {
    await deleteSubfoldersAndFiles(subfolder.id, userId); // Recursively delete subfolders
  }

  const filesSnapshot = await db.collection('files').where('folder_id', '==', folderId).where('chat_id', '==', userId).get();
  for (const file of filesSnapshot.docs) {
    await file.ref.delete(); // Delete files in the folder
  }

  await db.collection('folders').doc(String(folderId)).delete(); // Delete the folder
};

const listFoldersAndFiles = async (req, folderId = null) => {
  const sessionToken = req.headers.authorization;

  const { userId } = await validateSession(sessionToken);

  let foldersQuery = db.collection('folders').where('user_id', '==', userId);
  let filesQuery = db.collection('files').where('chat_id', '==', userId);

  if (folderId) {
    foldersQuery = foldersQuery.where('parent_folder_id', '==', folderId);
    filesQuery = filesQuery.where('folder_id', '==', folderId);
  } else {
    foldersQuery = foldersQuery.where('parent_folder_id', '==', null);
    filesQuery = filesQuery.where('folder_id', '==', null);
  }
  const [foldersSnapshot, filesSnapshot] = await Promise.all([foldersQuery.get(), filesQuery.get()]);

  const folders = foldersSnapshot.docs.map(doc => { 
    const data = doc.data();
    if (data.last_modified_date) {
      if (data.last_modified_date.toDate) {
        // Firestore Timestamp
        data.last_modified_date = data.last_modified_date.toDate().toISOString();
      } else {
        const parsedDate = new Date(data.last_modified_date);
        if (!isNaN(parsedDate)) {
          data.last_modified_date = parsedDate.toISOString();
        } else {
          data.last_modified_date = null;
        }
      }
    } else {
      data.last_modified_date = null;
    }

    if (data.created_at) {
      if (data.created_at.toDate) {
        data.created_at = data.created_at.toDate().toISOString();
      } else {
        const parsedDate = new Date(data.created_at);
        if (!isNaN(parsedDate)) {
          data.created_at = parsedDate.toISOString();
        } else {
          data.created_at = null;
        }
      }
    } else {
      data.created_at = null;
    }
    return { id: doc.id, ...data }; 
  });
  const files = filesSnapshot.docs.map(doc => { 
    const data = doc.data();
    if (data.last_modified_date) {
      if (data.last_modified_date.toDate) {
        data.last_modified_date = data.last_modified_date.toDate().toISOString();
      } else {
        const parsedDate = new Date(data.last_modified_date);
        if (!isNaN(parsedDate)) {
          data.last_modified_date = parsedDate.toISOString();
        } else {
          data.last_modified_date = null;
        }
      }
    } else {
      data.last_modified_date = null;
    }

    if (data.upload_date) {
      if (data.upload_date.toDate) {
        data.upload_date = data.upload_date.toDate().toISOString();
      } else {
        const parsedDate = new Date(data.upload_date);
        if (!isNaN(parsedDate)) {
          data.upload_date = parsedDate.toISOString();
        } else {
          data.upload_date = null;
        }
      }
    } else {
      data.upload_date = null;
    }
    return { id: doc.id, ...data }; 
  });

  return { folders, files };
};

const getFolderPath = async (req) => {
  const sessionToken = req.headers.authorization;
  const { folderId } = req.params;

  const { userId } = await validateSession(sessionToken);

  const getFolderPathRecursive = async (folderId, path = []) => {
    if (!folderId) {
      return path.reverse();
    }

    const folderRef = db.collection('folders').doc(folderId);
    const folder = await folderRef.get();

    if (!folder.exists || folder.data().user_id !== userId) {
      throw new Error('Folder not found or access denied');
    }

    path.push({ folderId: folder.id, folderName: folder.data().folder_name });

    const parentFolderId = folder.data().parent_folder_id;

    if (parentFolderId === null || parentFolderId === undefined) {
      return path.reverse();
    }

    return getFolderPathRecursive(String(parentFolderId), path);
  };

  const folderPath = await getFolderPathRecursive(folderId);

  return { path: folderPath };
};

const validateSession = async (sessionToken) => {
  const sessionSnapshot = await db.collection('sessions').where('token', '==', sessionToken).get();
  if (sessionSnapshot.empty) {
    throw new Error('Unauthorized: Invalid session token');
  }

  const { user_id: userId, expires_at: expiresAt } = sessionSnapshot.docs[0].data();
  if (new Date() > new Date(expiresAt)) {
    throw new Error('Unauthorized: Session expired');
  }

  return { userId: String(userId), expiresAt };
};

module.exports = {
  createFolder,
  renameFolder,
  deleteFolder,
  listFoldersAndFiles,
  getFolderPath,
};
