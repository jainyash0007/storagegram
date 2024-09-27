# **Storagegram**
Storagegram is a cloud-based, cross-platform file management system that integrates with Telegram and Discord to enable users to manage file uploads, downloads, sharing, and more. This serverless application is built with modern web technologies and deployed using AWS services, ensuring scalability, low-latency, and high performance.

## Features
**File Management**: Upload, download, rename, delete, and share files across Telegram and Discord platforms.

**Multi-Platform Support**: Seamless integration with both Telegram API and Discord.js.

**Real-Time UI**: A responsive React.js frontend allowing users to organize files in folders and navigate through directories.

**Activity Logs**: Track user activity such as file uploads, downloads, and shares.

**Bulk Operations**: Supports bulk file actions such as bulk delete and multi-file downloads.

**Authentication**: Secured with OAuth2 and JWT tokens for secure file access and sharing.

**Optimized File Operations**: Enhanced performance with NAT Gateway and optimized downloads through AWS Lambda in a VPC.

**CI/CD Pipeline**: Automated deployments using GitHub Actions.

**Monitoring**: Application performance and logs are monitored using AWS CloudWatch.

## Tech Stack
### Backend
**Firebase Functions** – Serverless compute platform.

**Firestore** – Storing file metadata and application data.

**Node.js** – Backend application logic.

**Discord.js & Telegram API** – Integrations for platform-specific file handling.

### Frontend
**React.js** – Responsive UI for real-time file management.

**Firebase Hosting** – Frontend hosting for continuous delivery.

### DevOps & Cloud
**GitHub Actions** – CI/CD pipeline for automated testing and deployment.

# **Setup and Installation**
## 1. Clone the Repository:
git clone https://github.com/jainyash0007/storagegram.git

cd storagegram

## 2. Install Dependencies:
cd frontend

npm install

cd ../backend/functions

npm install

## 3. Change the .env.example files in both frontend and backend to .env and enter the necessary variables in them as given.

## 4. Setup Telegram Bot:
• Create a Telegram Bot:
1. Open Telegram and search for BotFather.
2. Start a chat and use the /newbot command to create your bot.
3. Follow the prompts and note down the API Token, Bot ID and Bot Username you receive.

• Configure Your Bot in the App:

In your .env file, add:

TELEGRAM_BOT_TOKEN=token_from_telegram_bot

TELEGRAM_BOT_ID=bot_id

TELEGRAM_BOT_USERNAME=bot_username

## 5. Setup Discord Bot:
• Create a Discord Bot:
1. Go to the Discord Developer Portal.
2. Click New Application, give it a name, and click Create.
3. Under the Bot tab, click Add Bot, and confirm.
4. Copy the Token and add it to your .env file.

• Configure Bot Permissions:
1. Under the OAuth2 section, create a bot invite link with the required permissions for file management.
2. In your .env file, add:

DISCORD_CLIENT_ID=client_id

DISCORD_CLIENT_SECRET=client_secret

DISCORD_BOT_TOKEN=discord_bot_token

DISCORD_REDIRECT_URI=your_discord_redirect_uri

## 6. Configure other necessary variables in your .env file.
