const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.DISCORD_BOT_TOKEN);

const waitForBotReady = new Promise((resolve, reject) => {
  client.once('ready', resolve);
  client.once('error', reject);
});

// Function to send a file in a DM to a user
const sendFileToUser = async (userId, file, options = {}) => {
  try {
    await waitForBotReady; // Ensure the bot is ready before proceeding

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
const sendPhoto = async (userId, file, options = {}) => {
  return sendFileToUser(userId, file, options);
};

const sendVideo = async (userId, file, options = {}) => {
  return sendFileToUser(userId, file, options);
};

const sendDocument = async (userId, file, options = {}) => {
  return sendFileToUser(userId, file, options);
};

// Function to delete a message in a DM channel
const deleteMessage = async (userId, messageId) => {
  try {
    await waitForBotReady; // Ensure the bot is ready before proceeding

    const user = await client.users.fetch(userId);
    if (!user) throw new Error('User not found');

    // Fetch the DM channel with the user
    const dmChannel = await user.createDM();

    // Fetch the specific message in the DM channel
    const message = await dmChannel.messages.fetch(messageId);
    if (!message) throw new Error('Message not found');

    // Delete the message
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
    await waitForBotReady; // Ensure the bot is ready before proceeding

    const user = await client.users.fetch(userId);
    if (!user) throw new Error('User not found');

    // Fetch the DM channel with the user
    const dmChannel = await user.createDM();

    // Fetch the specific message in the DM channel
    const message = await dmChannel.messages.fetch(messageId);
    if (!message || !message.attachments.size) {
      throw new Error('Message or attachment not found');
    }

    // Get the first attachment in the message
    const attachment = message.attachments.first();

    // Return the download URL and file name
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