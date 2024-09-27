const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

let botLoggedIn = false;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});
// Login the bot only if it has not logged in yet
if (!botLoggedIn) {
  client.login(process.env.DISCORD_BOT_TOKEN).then(() => {
    console.log(`Logged in as ${client.user.tag}`);
    botLoggedIn = true; // Set flag to true after successful login
  }).catch((error) => {
    console.error('Error logging in Discord bot:', error);
  });
}

// Function to send a file in a DM to a user
const sendFileToUser = async (userId, file, options = {}) => {
  try {
    const user = await client.users.fetch(userId);
    if (!user) throw new Error('User not found');

    // Validate that the file has proper data and a name
    if (!file || !file.data || !file.name) {
      throw new Error('Invalid file data');
    }

    // Send the file as a DM to the user
    return user.send({
      files: [
        {
          attachment: file.data, // The data buffer (file content)
          name: file.name,       // Correct filename for the file
        },
      ],
      ...options, // Additional message options (e.g., content)
    });
  } catch (error) {
    console.error('Error sending file:', error);
    throw error;
  }
};

// Send different types of files (reuse the sendFileToUser function)
const sendPhoto = (userId, file, options = {}) => sendFileToUser(userId, file, options);
const sendVideo = (userId, file, options = {}) => sendFileToUser(userId, file, options);
const sendDocument = (userId, file, options = {}) => sendFileToUser(userId, file, options);

// Function to delete a message in a DM channel
const deleteMessage = async (userId, messageId) => {
  try {
    const user = await client.users.fetch(userId);
    if (!user) throw new Error('User not found');

    const dmChannel = await user.createDM();
    const message = await dmChannel.messages.fetch(messageId);
    if (!message) throw new Error('Message not found');

    await message.delete();
    console.log(`Message with ID ${messageId} deleted for user ${userId}`);
  } catch (error) {
    console.error('Error deleting message:', error);
    throw error;
  }
};

// Function to download a document from a DM
const downloadDocument = async (userId, messageId) => {
  try {
    const user = await client.users.fetch(userId);
    if (!user) throw new Error('User not found');

    const dmChannel = await user.createDM();
    const message = await dmChannel.messages.fetch(messageId);
    if (!message || !message.attachments.size) {
      throw new Error('Message or attachment not found');
    }

    const attachment = message.attachments.first();
    return { downloadUrl: attachment.url, fileName: attachment.name };
  } catch (error) {
    console.error('Error downloading file from Discord:', error);
    throw error;
  }
};

module.exports = {
  sendPhoto,
  sendVideo,
  sendDocument,
  deleteMessage,
  downloadDocument,
};
