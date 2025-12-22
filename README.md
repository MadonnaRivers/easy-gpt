# Easy GPT Chatbot Interface

React + TypeScript chatbot interface built with Vite and Tailwind CSS.

## 🚀 Quick Start

The development server should already be running! 

**Open your browser and go to:**
```
http://localhost:3000
```

## 📋 Available Commands

### Start Development Server
```bash
npm run dev
```
Starts the Vite dev server on `http://localhost:3000`

### Build for Production
```bash
npm run build
```
Creates an optimized production build in the `dist` folder

### Preview Production Build
```bash
npm run preview
```
Preview the production build locally

## 🛠️ Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Styling
- **Lucide React** - Icons

## 📁 Project Structure

```
bot/
├── src/
│   ├── chatbot_interface.tsx  # Main chatbot component
│   ├── App.tsx                # App wrapper
│   ├── main.tsx               # Entry point
│   └── index.css              # Global styles
├── index.html                 # HTML template
├── package.json               # Dependencies
├── vite.config.ts            # Vite configuration
├── tsconfig.json             # TypeScript config
└── tailwind.config.js        # Tailwind config
```

## 🎨 Features

- ✅ Modern chat interface
- ✅ Sidebar with chat history
- ✅ Responsive design
- ✅ Red theme matching Easy GPT branding
- ✅ Message bubbles with proper formatting
- ✅ New chat functionality

## 🔧 Development

The component uses React hooks for state management and includes:
- Message state management
- Chat history sidebar
- Input handling
- Keyboard shortcuts (Enter to send)

## 📝 Notes

- The component is ready to be integrated with your N8N webhook API
- Currently shows sample messages
- Add API integration in the `handleSend` function

