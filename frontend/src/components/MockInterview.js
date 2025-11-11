import React, { useState } from 'react';
import { API_BASE_URL } from '../config';
import InterviewForm from './mockinterview/InterviewForm';
import InterviewScreen from './mockinterview/InterviewScreen';
import SummaryScreen from './mockinterview/SummaryScreen';
import './MockInterview.css';

function MockInterview() {
  const [currentScreen, setCurrentScreen] = useState('form');
  const [sessionData, setSessionData] = useState(null);
  const [summaryData, setSummaryData] = useState(null);

  const handleStartInterview = (session) => {
    setSessionData(session);
    setCurrentScreen('interview');
  };

  const handleEndInterview = (summary) => {
    setSummaryData(summary);
    setCurrentScreen('summary');
  };

  const handleRestart = () => {
    setSessionData(null);
    setSummaryData(null);
    setCurrentScreen('form');
  };

  return (
    <div className="mock-interview-app">
      <div className="mock-interview-container">
        {currentScreen === 'form' && (
          <InterviewForm 
            onStartInterview={handleStartInterview}
            apiBaseUrl={API_BASE_URL}
          />
        )}
        {currentScreen === 'interview' && sessionData && (
          <InterviewScreen
            sessionData={sessionData}
            onEndInterview={handleEndInterview}
            onRestart={handleRestart}
            apiBaseUrl={API_BASE_URL}
          />
        )}
        {currentScreen === 'summary' && summaryData && (
          <SummaryScreen
            summaryData={summaryData}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}

export default MockInterview;

