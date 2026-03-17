import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ChatbotInterface from './chatbot_interface';
import DashboardGate from './DashboardGate';

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <Routes>
        <Route path="/" element={<ChatbotInterface />} />
        <Route path="/dashboard" element={<DashboardGate />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App

