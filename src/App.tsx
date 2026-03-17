import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ChatbotInterface from './chatbot_interface';
import Dashboard from './Dashboard';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/" element={<ChatbotInterface />} />
        <Route path="/dashboard" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App

