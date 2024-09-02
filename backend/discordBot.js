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

// Function to send a file in a DM to a user
const sendFileToUser = async (userId, file, options = {}) => {
  try {
    const user = await client.users.fetch(userId);
    if (!user) throw new Error('User not found');

    return user.send({
      files: [
        {
          attachment: file.data, // Using the data buffer directly
          name: file.name, // Correct filename
        },
      ],
      ...options,
    });
  } catch (error) {
    console.error('Error sending file:', error);
    throw error;
  }
};

const sendPhoto = async (userId, file, options = {}) => {
  return sendFileToUser(userId, file, options);
};

const sendVideo = async (userId, file, options = {}) => {
  return sendFileToUser(userId, file, options);
};

const sendDocument = async (userId, file, options = {}) => {
  return sendFileToUser(userId, file, options);
};

const deleteMessage = async (userId, messageId) => {
  try {
    const user = await client.users.fetch(userId);
    if (!user) throw new Error('User not found');

    // Fetch the DM channel with the user
    const dmChannel = await user.createDM();

    // Fetch the message in the DM channel
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

const downloadDocument = async (userId, messageId) => {
  try {
    const user = await client.users.fetch(userId);
    if (!user) throw new Error('User not found');

    // Fetch the DM channel with the user
    const dmChannel = await user.createDM();

    // Fetch the message in the DM channel
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
