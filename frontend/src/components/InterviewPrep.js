import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ArrowLeft, 
  ArrowRight, 
  Mic, 
  MicOff, 
  Edit3, 
  Send,
  Bot,
  User,
  Volume2,
  Clock,
  Paperclip,
  FileText,
  X
} from 'lucide-react';
import './InterviewPrep.css';
import { API_BASE_URL } from '../config';

const InterviewPrep = () => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [inputMode, setInputMode] = useState('voice'); // 'text' or 'voice'
  const [isRecording, setIsRecording] = useState(false);
  const [textAnswer, setTextAnswer] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timer, setTimer] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [chatbotVoiceMode, setChatbotVoiceMode] = useState(false);
  const [isChatbotRecording, setIsChatbotRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [fileContent, setFileContent] = useState(null);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const timerIntervalRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechSynthesisRef = useRef(null);
  const fileInputRef = useRef(null);

  // Sample questions - in real app, this would come from API
  const questions = [
    {
      id: 1,
      question: "What are the different types of machine learning?",
      category: "Machine Learning"
    },
    {
      id: 2,
      question: "Explain the difference between supervised and unsupervised learning.",
      category: "Machine Learning"
    },
    {
      id: 3,
      question: "What is overfitting and how can you prevent it?",
      category: "Machine Learning"
    },
    {
      id: 4,
      question: "Describe the gradient descent algorithm.",
      category: "Machine Learning"
    },
    {
      id: 5,
      question: "What is the bias-variance tradeoff?",
      category: "Machine Learning"
    }
  ];

  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;

  // Timer effect
  useEffect(() => {
    if (timerRunning) {
      timerIntervalRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [timerRunning]);

  // Initialize chatbot with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        role: 'assistant',
        content: "Hello! I'm your Interview Preparation Assistant. I can help you with:\n\n• Technical questions\n• Conceptual explanations\n• Behavioral interview tips\n• Problem-solving strategies\n• Interview preparation advice\n\nHow can I assist you today?"
      }]);
    }
  }, []);

  // Auto scroll to bottom when new message arrives
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Function to read file content
  const readFileContent = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        resolve(e.target.result);
      };
      
      reader.onerror = (e) => {
        reject(e);
      };
      
      if (file.type.startsWith('image/')) {
        // For images, read as base64
        reader.readAsDataURL(file);
      } else if (file.type.startsWith('text/') || file.type === 'application/pdf' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        // For text files, read as text
        reader.readAsText(file);
      } else {
        // For other files, read as base64
        reader.readAsDataURL(file);
      }
    });
  };

  // Handle file selection
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('File size should be less than 10MB');
      return;
    }

    setSelectedFile(file);

    try {
      const content = await readFileContent(file);
      setFileContent(content);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        setFilePreview(URL.createObjectURL(file));
      } else {
        setFilePreview(null);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Error reading file. Please try again.');
      setSelectedFile(null);
    }
  };

  // Remove selected file
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview(null);
    setFileContent(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Function to send message with text
  const handleSendMessageWithText = useCallback(async (text, fileData = null) => {
    if ((!text || !text.trim()) && !fileData || isLoading) return;

    const userMessage = {
      role: 'user',
      content: text.trim() || (fileData ? `[File: ${fileData.name}]` : ''),
      file: fileData ? {
        name: fileData.name,
        type: fileData.type,
        content: fileData.content,
        preview: fileData.preview
      } : null
    };

    setMessages(prev => [...prev, userMessage]);
    const messageToSend = text.trim() || 'Please analyze this file';
    setInputMessage('');
    setIsLoading(true);

    // Clear file after sending
    if (fileData) {
      setSelectedFile(null);
      setFilePreview(null);
      setFileContent(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }

    try {
      const requestBody = {
        message: messageToSend,
        file: fileData ? {
          name: fileData.name,
          type: fileData.type,
          content: fileData.content
        } : null,
        context: {
          currentQuestion: currentQuestion?.question || null,
          category: currentQuestion?.category || null
        },
        conversationHistory: messages.slice(-10)
      };

      const response = await fetch(`${API_BASE_URL}/api/chatbot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const assistantMessage = {
          role: 'assistant',
          content: data.response
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Speak the response if voice mode is on
        if (chatbotVoiceMode) {
          setTimeout(() => {
            speakText(data.response);
          }, 500);
        }
      } else {
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.message || 'Sorry, I encountered an error. Please try again.'
        }]);
      }
    } catch (error) {
      console.error('Chatbot error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I couldn\'t connect to the server. Please make sure the backend server is running.'
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, chatbotVoiceMode, currentQuestion, isLoading]);

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(transcript);
        setIsChatbotRecording(false);
        // Auto-send message after voice input
        setTimeout(() => {
          if (transcript.trim()) {
            handleSendMessageWithText(transcript);
          }
        }, 500);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsChatbotRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsChatbotRecording(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [handleSendMessageWithText]);

  // Text-to-speech function
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      if (speechSynthesisRef.current) {
        window.speechSynthesis.cancel();
      }
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      speechSynthesisRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    }
  };

  // Stop speaking
  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
      setTextAnswer('');
      setTimer(0);
      setTimerRunning(false);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setTextAnswer('');
      setTimer(0);
      setTimerRunning(false);
    }
  };

  const handleVoiceToggle = () => {
    if (inputMode === 'voice') {
      setIsRecording(false);
      setTimerRunning(false);
      setInputMode('text');
    } else {
      setInputMode('voice');
    }
  };

  const handleRecordToggle = () => {
    if (isRecording) {
      setIsRecording(false);
      setTimerRunning(false);
    } else {
      setIsRecording(true);
      setTimerRunning(true);
      // In real app, start voice recording here
    }
  };

  const handleChatbotVoiceToggle = () => {
    if (isChatbotRecording) {
      // Stop recording
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsChatbotRecording(false);
    } else {
      // Start recording
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          setIsChatbotRecording(true);
        } catch (error) {
          console.error('Error starting speech recognition:', error);
        }
      }
    }
  };

  const handleSendMessage = async () => {
    if ((!inputMessage.trim() && !selectedFile) || isLoading) return;
    
    const fileData = selectedFile ? {
      name: selectedFile.name,
      type: selectedFile.type,
      content: fileContent,
      preview: filePreview
    } : null;
    
    await handleSendMessageWithText(inputMessage, fileData);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Handle Ask AI Assistant - send current question to chatbot
  const handleAskAIAssistant = async () => {
    if (!currentQuestion || isLoading) return;
    
    const questionText = `Question: ${currentQuestion.question}\nCategory: ${currentQuestion.category}\n\nPlease help me understand this question and provide guidance on how to answer it effectively.`;
    
    // Send question to chatbot
    await handleSendMessageWithText(questionText, null);
    
    // Scroll to chatbot messages
    setTimeout(() => {
      chatContainerRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="interview-prep">
      <div className="interview-dashboard">
        {/* Left Panel - Interview Question Area */}
        <div className="question-panel">
          <div className="question-card">
            {/* Header with badges */}
            <div className="question-header">
              <span className="question-badge">QUESTION {currentQuestion.id} OF {totalQuestions}</span>
              <span className="timer-badge">
                <Clock size={14} />
                {formatTime(timer)} / 3:00
              </span>
            </div>

            {/* Question Content */}
            <div className="question-content">
              <div className="question-text-wrapper">
                <h2 className="question-text">Q{currentQuestion.id}. {currentQuestion.question}</h2>
                <button className="speaker-btn" title="Play question audio">
                  <Volume2 size={20} />
                </button>
              </div>
            </div>

            {/* Answer Options */}
            <div className="answer-options">
              <button
                className={`answer-mode-btn voice-btn ${inputMode === 'voice' ? 'active' : ''}`}
                onClick={() => setInputMode('voice')}
              >
                <Mic size={20} />
                <span>Voice Answer</span>
              </button>
              <button
                className={`answer-mode-btn type-btn ${inputMode === 'text' ? 'active' : ''}`}
                onClick={() => setInputMode('text')}
              >
                <Edit3 size={20} />
                <span>Type Answer</span>
              </button>
              <button
                className="answer-mode-btn ai-assistant-btn"
                onClick={handleAskAIAssistant}
                disabled={isLoading}
                title="Ask AI Assistant about this question"
              >
                <Bot size={20} />
                <span>Ask AI Assistant</span>
              </button>
            </div>

            {/* Recording Button (for voice mode) */}
            {inputMode === 'voice' && (
              <div className="recording-section">
                <button
                  className={`record-btn ${isRecording ? 'recording' : ''}`}
                  onClick={handleRecordToggle}
                >
                  <Mic size={32} />
                </button>
              </div>
            )}

            {/* Text Input Section (for text mode) */}
            {inputMode === 'text' && (
              <div className="text-input-section">
                <textarea
                  className="answer-textarea"
                  placeholder="Type your answer here..."
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  rows={6}
                />
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="navigation-buttons">
              <button
                className="nav-btn prev-btn"
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
              >
                <ArrowLeft size={20} />
                <span>Previous</span>
              </button>
              <button
                className="nav-btn next-btn"
                onClick={handleNext}
                disabled={currentQuestionIndex === questions.length - 1}
              >
                <span>Next</span>
                <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Panel - AI Chatbot */}
        <div className="chatbot-panel">
          <div className="chatbot-container">
            <div className="chatbot-header">
              <div className="chatbot-header-content">
                <Bot size={24} />
                <div>
                  <h3>Interview Assistant</h3>
                  <p className="chatbot-subtitle">Ask me anything about interview preparation</p>
                </div>
              </div>
            </div>

            <div className="chatbot-messages" ref={chatContainerRef}>
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`chatbot-message ${msg.role === 'user' ? 'user-message' : 'assistant-message'}`}
                >
                  <div className="message-avatar">
                    {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                  </div>
                  <div className="message-content">
                    {msg.file && (
                      <div className="message-file-preview">
                        {msg.file.preview ? (
                          <div className="file-preview-image">
                            <img src={msg.file.preview} alt={msg.file.name} />
                            <div className="file-name">{msg.file.name}</div>
                          </div>
                        ) : (
                          <div className="file-preview-document">
                            <FileText size={24} />
                            <div className="file-name">{msg.file.name}</div>
                          </div>
                        )}
                      </div>
                    )}
                    {msg.content && (
                      <div className="message-text">
                        {msg.content.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            {i < msg.content.split('\n').length - 1 && <br />}
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="chatbot-message assistant-message">
                  <div className="message-avatar">
                    <Bot size={16} />
                  </div>
                  <div className="message-content">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {selectedFile && (
              <div className="chatbot-file-preview-container">
                <div className="chatbot-file-preview">
                  {filePreview ? (
                    <div className="file-preview-image">
                      <img src={filePreview} alt={selectedFile.name} />
                      <span className="file-name">{selectedFile.name}</span>
                    </div>
                  ) : (
                    <div className="file-preview-document">
                      <FileText size={20} />
                      <span className="file-name">{selectedFile.name}</span>
                    </div>
                  )}
                  <button
                    className="file-remove-btn"
                    onClick={handleRemoveFile}
                    title="Remove file"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}
            <div className="chatbot-input-container">
              <input
                type="file"
                ref={fileInputRef}
                className="chatbot-file-input"
                accept="image/*,.pdf,.txt,.doc,.docx,.md"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
              <input
                type="text"
                className="chatbot-input"
                placeholder={isChatbotRecording ? "Listening..." : selectedFile ? "Ask about the file..." : "Type your question..."}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={isLoading || isChatbotRecording}
              />
              <button
                className={`chatbot-voice-btn ${isChatbotRecording ? 'recording' : ''}`}
                onClick={handleChatbotVoiceToggle}
                title={isChatbotRecording ? 'Stop recording' : 'Start voice input'}
                style={{
                  display: 'flex',
                  visibility: 'visible',
                  opacity: 1,
                  width: '44px',
                  height: '44px',
                  minWidth: '44px',
                  minHeight: '44px',
                  backgroundColor: '#f0f0f0',
                  border: '2px solid #667eea',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  zIndex: 100
                }}
              >
                {isChatbotRecording ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
              <button
                className="chatbot-file-btn"
                onClick={() => fileInputRef.current?.click()}
                title="Upload file or image"
                style={{
                  display: 'flex',
                  visibility: 'visible',
                  opacity: 1,
                  width: '44px',
                  height: '44px',
                  minWidth: '44px',
                  minHeight: '44px',
                  backgroundColor: '#f0f0f0',
                  border: '2px solid #667eea',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  zIndex: 100
                }}
              >
                <Paperclip size={18} />
              </button>
              <button
                className="chatbot-send-btn"
                onClick={handleSendMessage}
                disabled={(!inputMessage.trim() && !selectedFile) || isLoading}
              >
                <Send size={18} />
              </button>
              <button
                className={`chatbot-speak-btn ${chatbotVoiceMode ? 'active' : ''}`}
                onClick={() => {
                  setChatbotVoiceMode(!chatbotVoiceMode);
                  if (chatbotVoiceMode) {
                    stopSpeaking();
                  }
                }}
                title={chatbotVoiceMode ? 'Disable voice responses' : 'Enable voice responses'}
              >
                <Volume2 size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InterviewPrep;

