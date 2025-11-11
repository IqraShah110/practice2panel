import React, { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Target, 
  CheckCircle, 
  XCircle, 
  ArrowRight, 
  ArrowLeft,
  Trophy,
  TrendingUp,
  Clock,
  Edit3,
  Play,
  Brain,
  User,
  Loader2,
  Mic,
  MicOff,
  Pause,
  Square,
  ChevronRight,
  Volume2,
  VolumeX,
  Send,
  Star,
  ThumbsUp,
  TrendingDown,
  FileText,
  X,
  HelpCircle,
  MessageSquare,
  Bot
} from 'lucide-react';
import './SkillPrep.css';
import { API_BASE_URL } from '../config';
import Chatbot from './Chatbot';

const SkillPrep = () => {
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedInterviewType, setSelectedInterviewType] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [currentStep, setCurrentStep] = useState('role'); // 'role' | 'type' | 'skill'
  const [difficulty, setDifficulty] = useState('');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [showQuiz, setShowQuiz] = useState(false);
  const [showPractice, setShowPractice] = useState(false);
  const [showSkillOptions, setShowSkillOptions] = useState(false);
  const [showDifficultySelection, setShowDifficultySelection] = useState(false);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [revealedAnswers, setRevealedAnswers] = useState({});
  const [showDifficultyPage, setShowDifficultyPage] = useState(false);
  const [apiQuestions, setApiQuestions] = useState([]);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionsError, setQuestionsError] = useState(null);
  const [currentPracticeQuestion, setCurrentPracticeQuestion] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showQuestionsList, setShowQuestionsList] = useState(false);
  const [questionScores, setQuestionScores] = useState({});
  const [favoriteQuestions, setFavoriteQuestions] = useState({});
  
  // Practice session tracking
  const [practiceSessionData, setPracticeSessionData] = useState([]); // Array of {questionIndex, question, response, feedback}
  const [showCongratulations, setShowCongratulations] = useState(false);
  const [showResultsView, setShowResultsView] = useState(false);
  
  // Voice recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [maxTime] = useState(180); // 3 minutes
  const [showSampleResponse, setShowSampleResponse] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [showVoiceInterface, setShowVoiceInterface] = useState(false);
  
  // Text input states
  const [inputMode, setInputMode] = useState('voice'); // 'voice' or 'text'
  const [textAnswer, setTextAnswer] = useState('');
  
  // Simple answer states
  const [showSimpleAnswer, setShowSimpleAnswer] = useState(false);
  const [simpleAnswer, setSimpleAnswer] = useState('');
  const [showYourResponse, setShowYourResponse] = useState(false);
  const [showFeedbackSection, setShowFeedbackSection] = useState(false);
  
  // Text-to-speech states
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [availableVoices, setAvailableVoices] = useState([]);
  const utteranceRef = useRef(null);
  
  // Message banner state
  const [userMessage, setUserMessage] = useState('');
  const [askAssistantRequest, setAskAssistantRequest] = useState(null);

  // Auto-clear user messages after 5 seconds
  useEffect(() => {
    if (userMessage) {
      const timer = setTimeout(() => {
        setUserMessage('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [userMessage]);

  // Voice recording refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  const jobRoles = {
    'AI Engineer': {
      skills: ['Machine Learning', 'Python', 'TensorFlow', 'PyTorch', 'Deep Learning'],
      color: 'var(--primary-color)'
    },
    'Data Scientist': {
      skills: ['Python', 'Machine Learning', 'SQL', 'Data Analysis', 'Statistics'],
      color: 'var(--accent-color)'
    },
    'Python Developer': {
      skills: ['Python', 'AWS', 'Kubernetes', 'Docker', 'Lambda'],
      color: 'var(--secondary-color)'
    }
  };

  const difficulties = [
    { value: 'easy', label: 'Easy', color: 'var(--accent-color)' },
    { value: 'medium', label: 'Medium', color: 'var(--secondary-color)' },
    { value: 'hard', label: 'Hard', color: 'var(--danger-color)' }
  ];

  // API call function to fetch questions from backend
  const fetchQuestionsFromAPI = async (interviewType, skill) => {
    setIsLoadingQuestions(true);
    setQuestionsError(null);
    setApiQuestions([]);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/questions/${interviewType}/${skill}`);
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status} ${response.statusText} ${text}`);
      }
      const data = await response.json();
      
      if (data.success) {
        setApiQuestions(data.questions);
        // Load scores from localStorage
        loadQuestionScores(interviewType, skill, data.questions);
      } else {
        setQuestionsError(data.message || 'Failed to fetch questions');
      }
    } catch (error) {
      setQuestionsError('Failed to connect to server. Please make sure the backend is running.');
      console.error('API Error:', error);
    } finally {
      setIsLoadingQuestions(false);
    }
  };

  const handleAskAssistant = () => {
    const currentQuestionText = apiQuestions[currentPracticeQuestion];
    if (!currentQuestionText) {
      setUserMessage('No question available to ask the AI assistant.');
      return;
    }

    setAskAssistantRequest({
      question: currentQuestionText,
      context: {
        skill: selectedSkill,
        role: selectedRole,
        interviewType: selectedInterviewType
      },
      timestamp: Date.now()
    });
  };

  // Calculate DET range based on question length
  const calculateDETRange = (question) => {
    if (!question) return { min: 10, max: 60, color: 'blue' };
    
    const length = question.length;
    // Simple calculation: longer questions = higher DET
    if (length < 50) {
      return { min: 10, max: 60, color: 'blue' };
    } else if (length < 100) {
      return { min: 60, max: 95, color: 'green' };
    } else if (length < 150) {
      return { min: 95, max: 125, color: 'yellow' };
    } else {
      return { min: 125, max: 150, color: 'red' };
    }
  };

  // Load question scores from localStorage
  const loadQuestionScores = (interviewType, skill, questions) => {
    try {
      const key = `questionScores_${interviewType}_${skill}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        const scores = JSON.parse(stored);
        setQuestionScores(scores);
      } else {
        setQuestionScores({});
      }
      // Load favorites too
      const favKey = `favoriteQuestions_${interviewType}_${skill}`;
      const favStored = localStorage.getItem(favKey);
      setFavoriteQuestions(favStored ? JSON.parse(favStored) : {});
    } catch (error) {
      console.error('Error loading question scores:', error);
      setQuestionScores({});
      setFavoriteQuestions({});
    }
  };

  // Save question score to localStorage
  const saveQuestionScore = (questionIndex, score) => {
    try {
      const key = `questionScores_${selectedInterviewType}_${selectedSkill}`;
      const updatedScores = { ...questionScores, [questionIndex]: score };
      setQuestionScores(updatedScores);
      localStorage.setItem(key, JSON.stringify(updatedScores));
    } catch (error) {
      console.error('Error saving question score:', error);
    }
  };

  // Get question score
  const getQuestionScore = (questionIndex) => {
    return questionScores[questionIndex] || null;
  };

  const getScoreClass = (scoreValue) => {
    if (scoreValue === null || scoreValue === undefined) return '';
    if (scoreValue >= 80) return 'score-high';
    if (scoreValue >= 60) return 'score-mid';
    if (scoreValue > 0) return 'score-low';
    return '';
  };

  // Toggle favorite for a question and persist
  const toggleFavorite = (questionIndex) => {
    try {
      const updated = { ...favoriteQuestions, [questionIndex]: !favoriteQuestions[questionIndex] };
      setFavoriteQuestions(updated);
      const key = `favoriteQuestions_${selectedInterviewType}_${selectedSkill}`;
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save favorite state', e);
    }
  };

  // Voice recording functions
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const mime = (mediaRecorderRef.current && mediaRecorderRef.current.mimeType) || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: mime });
        setAudioBlob(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach(track => track.stop());
        
        // Process the voice recording to get transcript
        processVoiceRecording(audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      console.error('Error starting recording:', error);
      setUserMessage('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Save current question data to session
  const saveCurrentQuestionData = () => {
    const currentQuestionText = apiQuestions[currentPracticeQuestion];
    const currentResponse = transcript || textAnswer || '';
    const currentFeedback = feedback;
    
    if (currentQuestionText) {
      setPracticeSessionData(prev => {
        const existing = prev.find(item => item.questionIndex === currentPracticeQuestion);
        if (existing) {
          // Update existing entry
          return prev.map(item => 
            item.questionIndex === currentPracticeQuestion
              ? { ...item, response: currentResponse, feedback: currentFeedback }
              : item
          );
        } else {
          // Add new entry
          return [...prev, {
            questionIndex: currentPracticeQuestion,
            question: currentQuestionText,
            response: currentResponse,
            feedback: currentFeedback
          }];
        }
      });
    }
  };

  // Process voice recording to get transcript
  const processVoiceRecording = async (audioBlob) => {
    try {
      console.log('🎤 Processing voice recording...');
      setIsProcessing(true);
      
      const formData = new FormData();
      const filename = audioBlob.type && audioBlob.type.includes('wav') ? 'recording.wav' : 'recording.webm';
      formData.append('audio', audioBlob, filename);
      formData.append('question', apiQuestions[currentPracticeQuestion] || 'Practice question');
      
      // Add retry logic for connection issues
      let response;
      let retries = 3;
      
      while (retries > 0) {
        try {
          response = await fetch(`${API_BASE_URL}/api/process-voice`, {
            method: 'POST',
            body: formData
          });
          break; // Success, exit retry loop
        } catch (fetchError) {
          retries--;
          if (retries === 0) throw fetchError;
          console.log(`🔄 Retrying voice processing... (${3 - retries}/3)`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        }
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      console.log('Voice processing response:', data);
      
      if (data.success && data.transcript) {
        setTranscript(data.transcript);
        console.log('✅ Voice transcribed successfully:', data.transcript);
        // Feedback logic
        if (data.evaluation) {
          try {
            const parsed = typeof data.evaluation === 'string' ? JSON.parse(data.evaluation) : data.evaluation;
            setFeedback(parsed);
            setShowFeedbackModal(true); // Open feedback modal
            // Save score if available (convert 0-10 to percentage)
            if (parsed.score !== undefined) {
              const scorePercentage = (parsed.score / 10) * 100;
              saveQuestionScore(currentPracticeQuestion, scorePercentage);
            }
            // Save to session data
            saveCurrentQuestionData();
          } catch (e) {
            setFeedback({ summary: 'Could not parse feedback from server.' });
          }
        } else {
          setFeedback(null);
        }
      } else {
        setFeedback(null);
        console.error('❌ Voice processing failed:', data.message);
        setUserMessage(`Voice processing failed: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      setFeedback(null);
      console.error('❌ Error processing voice:', error);
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_RESET')) {
        setUserMessage('Voice processing service is temporarily unavailable. Please try text input instead or try again in a moment.');
      } else {
        setUserMessage('Failed to process voice recording. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const playAudio = () => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };


  // Load available voices once
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const loadVoices = () => {
      const voices = synth.getVoices();
      if (voices && voices.length) {
        setAvailableVoices(voices);
      }
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => {
      if (synth) synth.onvoiceschanged = null;
    };
  }, []);

  // Text-to-speech functions
  const speakText = (text) => {
    if (!text || !text.trim()) return;
    if (!('speechSynthesis' in window)) {
      setUserMessage('Text-to-speech is not supported in this browser.');
      return;
    }

    const synth = window.speechSynthesis;
    const speechState = {
      isPaused: isPaused && isSpeaking,
      isSpeaking: isSpeaking && !isPaused
    };

    // Handle resume case
    if (speechState.isPaused) {
      resumeQuestionSpeech();
      return;
    }

    // Stop any ongoing speech
    if (speechState.isSpeaking) {
      synth.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
      return;
    }

    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    
    // Select voice
    const preferred = availableVoices.find(v => /en-?US/i.test(v.lang)) || availableVoices[0];
    if (preferred) utterance.voice = preferred;
    
    // Configure speech
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Event handlers
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };
    
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
    };

    // Reset and speak
    try { synth.cancel(); } catch (_) {}
    synth.speak(utterance);
  };

  const speakTextWithCallback = (text, onEnd, onStart) => {
    if (!text || !text.trim()) {
      if (typeof onEnd === 'function') onEnd();
      return;
    }
    if (!('speechSynthesis' in window)) {
      if (typeof onStart === 'function') onStart();
      if (typeof onEnd === 'function') onEnd();
      return;
    }

    // Stop any existing speech
    if (isSpeaking) {
      try { window.speechSynthesis.cancel(); } catch (_) {}
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utteranceRef.current = utterance;
    const preferred = availableVoices.find(v => /en-?US/i.test(v.lang)) || availableVoices[0];
    if (preferred) utterance.voice = preferred;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      if (typeof onStart === 'function') onStart();
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
      if (typeof onEnd === 'function') onEnd();
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
      if (typeof onEnd === 'function') onEnd();
    };

    try { window.speechSynthesis.cancel(); } catch (_) {}
    window.speechSynthesis.speak(utterance);
  };

  // Pause question speech
  const pauseQuestionSpeech = () => {
    const synth = window.speechSynthesis;
    const canPause = 'speechSynthesis' in window && isSpeaking && !isPaused;
    
    if (!canPause) return;
    
    synth.pause();
    setIsPaused(true);
  };

  // Resume question speech
  const resumeQuestionSpeech = () => {
    const synth = window.speechSynthesis;
    const canResume = 'speechSynthesis' in window && isSpeaking && isPaused;
    
    if (!canResume) return;
    
    synth.resume();
    setIsPaused(false);
  };

  // Handle question voice button click
  const handleQuestionVoiceClick = () => {
    const questionText = apiQuestions[currentPracticeQuestion];
    if (!questionText) return;

    const speechState = {
      isPaused: isPaused && isSpeaking,
      isSpeaking: isSpeaking && !isPaused,
      isIdle: !isSpeaking && !isPaused
    };

    // Use switch-like logic with object mapping
    const actions = {
      pause: pauseQuestionSpeech,
      resume: resumeQuestionSpeech,
      play: () => speakText(questionText)
    };

    const actionMap = {
      isPaused: 'resume',
      isSpeaking: 'pause',
      isIdle: 'play'
    };

    const state = Object.keys(speechState).find(key => speechState[key]);
    const actionKey = actionMap[state] || 'play';
    const action = actions[actionKey];
    
    action?.();
  };

  // No AI feedback: evaluation removed per requirements
  // Submit typed answer for AI feedback
  const submitTextForFeedback = async () => {
    const questionText = String(apiQuestions[currentPracticeQuestion] || '').trim();
    const answerText = String(textAnswer || '').trim();
    if (!questionText || !answerText) {
      setUserMessage('Please type your answer before submitting.');
      return;
    }
    try {
      setIsProcessing(true);
      const response = await fetch(`${API_BASE_URL}/api/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: questionText,
          answer: answerText,
          job_title: selectedRole || 'Software Engineer',
          skills: selectedSkill || ''
        })
      });
      const data = await response.json();
      if (data && data.success) {
        // Ensure feedback parse
        let parsed = null;
        try {
          parsed = typeof data.evaluation === 'string' ? JSON.parse(data.evaluation) : data.evaluation;
        } catch (_) {
          parsed = data.evaluation || null;
        }
        if (parsed) {
          setFeedback(parsed);
          setShowFeedbackModal(true); // Open feedback modal
          // Save score percentage if present
          if (typeof parsed.score !== 'undefined') {
            const scorePct = (parsed.score / 10) * 100;
            saveQuestionScore(currentPracticeQuestion, scorePct);
          }
          // Save to session data
          saveCurrentQuestionData();
        }
        setTranscript(answerText);
        setUserMessage('Feedback generated.');
      } else {
        setUserMessage(data && data.message ? data.message : 'Failed to evaluate answer.');
      }
    } catch (e) {
      setUserMessage('Could not connect to evaluation service.');
    } finally {
      setIsProcessing(false);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      utteranceRef.current = null;
    }
  };

  const toggleVoiceInterface = () => {
    setShowVoiceInterface(!showVoiceInterface);
    if (!showVoiceInterface) {
      // Reset voice states when opening
      setTranscript('');
      setShowSampleResponse(false);
      setRecordingTime(0);
      setAudioBlob(null);
      setAudioUrl(null);
      setIsRecording(false);
      setIsPlaying(false);
      setSimpleAnswer('');
      setShowSimpleAnswer(false);
      setShowYourResponse(false);
      stopSpeaking();
    }
  };

  // Timer effect for recording
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= maxTime) {
            stopRecording();
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRecording, maxTime]);

  // Auto-read current question aloud whenever it changes in practice mode
  useEffect(() => {
    if (!showPractice) {
      stopSpeaking();
      return;
    }
    if (apiQuestions && apiQuestions.length > 0) {
      const questionText = String(apiQuestions[currentPracticeQuestion] || '');
      if (questionText.trim()) {
        // Reset pause state when question changes
        setIsPaused(false);
        try { stopSpeaking(); } catch (_) {}
        // Small delay to ensure previous speech is stopped
        const timer = setTimeout(() => {
          speakTextWithCallback(questionText);
        }, 300);
        return () => clearTimeout(timer);
      }
    }
  }, [showPractice, apiQuestions, currentPracticeQuestion]);


  // Mock MCQ data - now structured as Skill → InterviewType → Difficulty
  const mockQuestions = {
    'Machine Learning': {
      technical: {
        easy: [
        {
          question: 'What is supervised learning?',
          options: [
            'Learning without labeled data',
            'Learning with labeled data',
            'Learning through trial and error',
            'Learning from environment feedback'
          ],
          correct: 1,
          explanation: 'Supervised learning uses labeled training data to learn the mapping from inputs to outputs.'
        },
        {
          question: 'Which of the following is NOT a type of machine learning?',
          options: [
            'Supervised Learning',
            'Unsupervised Learning',
            'Reinforcement Learning',
            'Descriptive Learning'
          ],
          correct: 3,
          explanation: 'Descriptive Learning is not a standard type of machine learning. The main types are Supervised, Unsupervised, and Reinforcement Learning.'
        }
      ],
      medium: [
        {
          question: 'What is the difference between classification and regression?',
          options: [
            'Classification predicts continuous values, regression predicts categories',
            'Classification predicts categories, regression predicts continuous values',
            'Both predict the same type of values',
            'There is no difference'
          ],
          correct: 1,
          explanation: 'Classification predicts discrete categories/classes, while regression predicts continuous numerical values.'
        },
        {
          question: 'What is cross-validation used for?',
          options: [
            'To increase the size of training data',
            'To evaluate model performance and prevent overfitting',
            'To speed up the training process',
            'To reduce the number of features'
          ],
          correct: 1,
          explanation: 'Cross-validation helps evaluate model performance and prevents overfitting by testing the model on different subsets of the data.'
        }
      ],
      hard: [
        {
          question: 'What is the bias-variance tradeoff in machine learning?',
          options: [
            'A technique to reduce overfitting',
            'A balance between model complexity and generalization',
            'A method to increase accuracy',
            'A way to speed up training'
          ],
          correct: 1,
          explanation: 'The bias-variance tradeoff describes the relationship between model complexity and generalization ability.'
        },
        {
          question: 'What is the purpose of regularization in machine learning?',
          options: [
            'To increase model complexity',
            'To prevent overfitting by adding constraints',
            'To speed up training',
            'To increase the number of parameters'
          ],
          correct: 1,
          explanation: 'Regularization prevents overfitting by adding constraints or penalties to the model, encouraging simpler solutions.'
        }
      ]
      },
      behavioral: {
        easy: [
          {
            question: 'Describe a time you explained ML to a non-technical stakeholder.',
            options: [
              'Used complex formulas only',
              'Tailored language and visuals to audience',
              'Avoided details entirely',
              'Delegated to another team'
            ],
            correct: 1,
            explanation: 'Effective behavioral answers show audience awareness and clarity.'
          }
        ],
        medium: [
          {
            question: 'How do you handle disagreement on model approach within a team?',
            options: [
              'Escalate immediately',
              'Decide alone quickly',
              'Facilitate discussion with data and experiments',
              'Ignore concerns'
            ],
            correct: 2,
            explanation: 'Data-driven collaboration and experiments demonstrate maturity.'
          }
        ],
        hard: []
      },
      problemSolving: {
        easy: [
          {
            question: 'You have imbalanced data. First step?',
            options: [
              'Delete majority class',
              'Consider resampling/metrics like F1/AUC',
              'Ignore imbalance',
              'Use accuracy only'
            ],
            correct: 1,
            explanation: 'Start with appropriate metrics and (re)sampling strategies.'
          }
        ],
        medium: [],
        hard: []
      }
    },
    'Python': {
      technical: {
        easy: [
        {
          question: 'What is the correct way to create a function in Python?',
          options: [
            'function myFunction():',
            'def myFunction():',
            'create myFunction():',
            'func myFunction():'
          ],
          correct: 1,
          explanation: 'In Python, functions are defined using the `def` keyword followed by the function name and parentheses.'
        },
        {
          question: 'Which data type is immutable in Python?',
          options: [
            'List',
            'Dictionary',
            'Tuple',
            'Set'
          ],
          correct: 2,
          explanation: 'Tuples are immutable in Python, meaning their elements cannot be changed after creation.'
        }
      ],
      medium: [
        {
          question: 'What is a decorator in Python?',
          options: [
            'A function that modifies another function',
            'A type of loop',
            'A data structure',
            'A built-in function'
          ],
          correct: 0,
          explanation: 'A decorator is a function that takes another function as input and extends its behavior without modifying the original function.'
        },
        {
          question: 'What is the difference between __str__ and __repr__?',
          options: [
            'There is no difference',
            '__str__ is for users, __repr__ is for developers',
            '__str__ is for developers, __repr__ is for users',
            'They serve different purposes in inheritance'
          ],
          correct: 1,
          explanation: '__str__ is meant to be readable for end users, while __repr__ is meant to be unambiguous for developers.'
        }
      ],
      hard: [
        {
          question: 'What is the Global Interpreter Lock (GIL) in Python?',
          options: [
            'A security feature',
            'A mechanism that allows only one thread to execute Python code at a time',
            'A memory management system',
            'A garbage collection mechanism'
          ],
          correct: 1,
          explanation: 'The GIL is a mutex that protects access to Python objects, preventing multiple native threads from executing Python bytecodes simultaneously.'
        }
      ]
      },
      behavioral: { easy: [], medium: [], hard: [] },
      problemSolving: { easy: [], medium: [], hard: [] }
    },
    'SQL': {
      technical: {
        easy: [
        {
          question: 'What does SQL stand for?',
          options: [
            'Structured Query Language',
            'Simple Query Language',
            'Standard Query Language',
            'System Query Language'
          ],
          correct: 0,
          explanation: 'SQL stands for Structured Query Language, which is used to manage and manipulate relational databases.'
        }
      ],
      medium: [
        {
          question: 'What is the difference between INNER JOIN and LEFT JOIN?',
          options: [
            'There is no difference',
            'INNER JOIN returns only matching rows, LEFT JOIN returns all rows from left table',
            'LEFT JOIN returns only matching rows, INNER JOIN returns all rows from left table',
            'They are used for different types of databases'
          ],
          correct: 1,
          explanation: 'INNER JOIN returns only the rows that have matching values in both tables, while LEFT JOIN returns all rows from the left table and matching rows from the right table.'
        }
      ],
      hard: []
      },
      behavioral: { easy: [], medium: [], hard: [] },
      problemSolving: { easy: [], medium: [], hard: [] }
    }
  };

  // Practice questions data
  const practiceQuestions = {
    // Empty initially - no questions available
    // 'Machine Learning': [
    //   {
    //     question: 'What is the main goal of machine learning?',
    //     answer: 'To enable computers to learn and improve from experience without being explicitly programmed.',
    //     category: 'Fundamentals'
    //   },
    //   {
    //     question: 'Name three types of machine learning.',
    //     answer: 'Supervised Learning, Unsupervised Learning, and Reinforcement Learning.',
    //     category: 'Types'
    //   },
    //   {
    //     question: 'What is overfitting in machine learning?',
    //     answer: 'When a model learns the training data too well, including noise and outliers, leading to poor generalization on new data.',
    //     category: 'Common Issues'
    //   },
    //   {
    //     question: 'What is the difference between training and testing data?',
    //     answer: 'Training data is used to teach the model, while testing data is used to evaluate how well the model generalizes to unseen data.',
    //     category: 'Data Management'
    //   }
    // ],
    // 'Python': [
    //   {
    //     question: 'What is a list comprehension in Python?',
    //     answer: 'A concise way to create lists based on existing sequences or iterables using a single line of code.',
    //     category: 'Python Features'
    //   },
    //   {
    //     question: 'Explain the difference between append() and extend() methods.',
    //     answer: 'append() adds a single element to the end of a list, while extend() adds all elements from an iterable to the end of a list.',
    //     category: 'List Methods'
    //   },
    //   {
    //     question: 'What is the difference between a tuple and a list?',
    //     answer: 'Tuples are immutable (cannot be changed after creation) while lists are mutable. Tuples use parentheses () and lists use square brackets [].',
    //     category: 'Data Structures'
    //   },
    //   {
    //     question: 'What is the purpose of the __init__ method in Python?',
    //     answer: 'The __init__ method is a constructor that is automatically called when creating a new instance of a class. It initializes the object\'s attributes.',
    //     category: 'Object-Oriented Programming'
    //   }
    // ],
    // 'TensorFlow': [
    //   {
    //     question: 'What is TensorFlow and what is it used for?',
    //     answer: 'TensorFlow is an open-source machine learning framework developed by Google. It is used for building and training neural networks and other machine learning models.',
    //     category: 'Framework Basics'
    //   },
    //   {
    //     question: 'What is a tensor in TensorFlow?',
    //     answer: 'A tensor is a multi-dimensional array that represents data in TensorFlow. It can be 0-dimensional (scalar), 1-dimensional (vector), 2-dimensional (matrix), or higher-dimensional.',
    //     category: 'Core Concepts'
    //   },
    //   {
    //     question: 'What is the difference between eager execution and graph execution?',
    //     answer: 'Eager execution runs operations immediately as they are called, while graph execution builds a computational graph first and then executes it, which can be more efficient for complex models.',
    //     category: 'Execution Modes'
    //   }
    // ],
    // 'SQL': [
    //   {
    //     question: 'What is the difference between WHERE and HAVING clauses?',
    //     answer: 'WHERE filters individual rows before grouping, while HAVING filters groups after GROUP BY. WHERE cannot use aggregate functions, but HAVING can.',
    //     category: 'SQL Clauses'
    //   },
    //   {
    //     question: 'What is a JOIN and what are the main types?',
    //     answer: 'A JOIN combines rows from two or more tables based on related columns. Main types: INNER JOIN, LEFT JOIN, RIGHT JOIN, and FULL JOIN.',
    //     category: 'Table Operations'
    //   },
    //   {
    //     question: 'What is the difference between DELETE and TRUNCATE?',
    //     answer: 'DELETE removes specific rows and can be rolled back, while TRUNCATE removes all rows, resets auto-increment counters, and cannot be rolled back.',
    //     category: 'Data Manipulation'
    //   }
    // ],
    // 'Data Analysis': [
    //   {
    //     question: 'What is the difference between descriptive and inferential statistics?',
    //     answer: 'Descriptive statistics summarize and describe data (mean, median, standard deviation), while inferential statistics make predictions and draw conclusions about populations based on sample data.',
    //     category: 'Statistics'
    //   },
    //   {
    //     question: 'What is correlation and how is it measured?',
    //     answer: 'Correlation measures the strength and direction of the relationship between two variables. It is measured using correlation coefficients like Pearson\'s r, ranging from -1 to +1.',
    //     category: 'Data Relationships'
    //   },
    //   {
    //     question: 'What is the difference between mean and median?',
    //     answer: 'Mean is the average (sum of all values divided by count), while median is the middle value when data is ordered. Median is less affected by outliers than mean.',
    //     category: 'Central Tendency'
    //   }
    // ],
    // 'AWS': [
    //   {
    //     question: 'What is AWS Lambda and when would you use it?',
    //     answer: 'AWS Lambda is a serverless compute service that runs code in response to events. It\'s used for event-driven applications, microservices, and when you want to avoid managing servers.',
    //     category: 'Serverless Computing'
    //   },
    //   {
    //     question: 'What is the difference between S3 and EBS?',
    //     answer: 'S3 is object storage for files and data, while EBS is block storage for EC2 instances. S3 is accessed via HTTP/HTTPS, EBS is attached directly to EC2 instances.',
    //     category: 'Storage Services'
    //   },
    //   {
    //     question: 'What is Auto Scaling in AWS?',
    //     answer: 'Auto Scaling automatically adjusts the number of EC2 instances based on demand, ensuring optimal performance and cost efficiency.',
    //     category: 'Compute Services'
    //   }
    // ],
    // 'Docker': [
    //   {
    //     question: 'What is a Docker container?',
    //     answer: 'A Docker container is a lightweight, standalone package that includes everything needed to run an application: code, runtime, system tools, libraries, and settings.',
    //     category: 'Container Basics'
    //   },
    //   {
    //     question: 'What is the difference between a Docker image and container?',
    //     answer: 'A Docker image is a template/blueprint for creating containers, while a container is a running instance of an image. Images are read-only, containers are writable.',
    //     category: 'Core Concepts'
    //   },
    //   {
    //     question: 'What is Docker Compose used for?',
    //     answer: 'Docker Compose is used to define and run multi-container Docker applications. It uses a YAML file to configure application services.',
    //     category: 'Orchestration'
    //   }
    // ]
  };

  const handleSkillSelect = (skill) => {
    setSelectedSkill(skill);
    // Reset states
    setShowSkillOptions(false);
    setShowQuiz(false);
    setShowPractice(false);
    setShowVoiceInterface(false);
    setCurrentPracticeQuestion(0);
    setInputMode('voice');
    setTranscript('');
    setSimpleAnswer('');
    setShowSimpleAnswer(false);
    setShowYourResponse(false);
    setFeedback && setFeedback(null);
    
    // Fetch questions and show list
    setIsLoadingQuestions(true);
    setShowQuestionsList(true);
    fetchQuestionsFromAPI(selectedInterviewType, skill);
  };

  const handleStartQuiz = () => {
    if (selectedRole && selectedSkill && difficulty) {
      setShowQuiz(true);
      setShowPractice(false);
      setShowSkillOptions(false);
      setCurrentQuestion(0);
      setScore(0);
      setShowResult(false);
    }
  };

  const handleStartPractice = () => {
    // Reset all states first
    setShowQuiz(false);
    setShowSkillOptions(false);
    setCurrentPracticeQuestion(0);
    setInputMode('voice');

    // Fetch questions and show list
    setIsLoadingQuestions(true);
    setShowQuestionsList(true);
    fetchQuestionsFromAPI(selectedInterviewType, selectedSkill);
  };


  // Handle question click from list
  const handleQuestionClick = (questionIndex) => {
    setCurrentPracticeQuestion(questionIndex);
    setShowQuestionsList(false);
    setShowPractice(true);
    setShowVoiceInterface(true);
    // Reset practice states
    setInputMode('voice');
    setTranscript('');
    setSimpleAnswer('');
    setShowSimpleAnswer(false);
    setShowYourResponse(false);
    setFeedback(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setIsRecording(false);
    setIsPlaying(false);
    // Reset session data when starting new practice
    setPracticeSessionData([]);
    setShowCongratulations(false);
    setShowResultsView(false);
  };

  const handleNextQuestion = () => {
    if (currentPracticeQuestion < apiQuestions.length - 1) {
      // Save current question data before moving to next
      saveCurrentQuestionData();
      
      // Stop any ongoing speech
      stopSpeaking();
      // Reset voice/text UI state so previous feedback doesn't leak into next question
      setShowSimpleAnswer(false);
      setShowYourResponse && setShowYourResponse(false);
      setSimpleAnswer('');
      setTranscript('');
      setTextAnswer('');
      setAudioBlob(null);
      setAudioUrl(null);
      setIsRecording(false);
      setIsPlaying(false);
      setCurrentPracticeQuestion(currentPracticeQuestion + 1);
      setInputMode('voice');
      setFeedback(null); // Hide feedback for next question
    }
  };

  const handleEndPractice = () => {
    // Save current question data before ending
    saveCurrentQuestionData();
    
    // Stop any ongoing speech
    stopSpeaking();
    
    // Show congratulations screen
    setShowCongratulations(true);
  };

  const handleStartPracticeAgain = () => {
    // Reset all practice states
    setShowCongratulations(false);
    setShowResultsView(false);
    setPracticeSessionData([]);
    setCurrentPracticeQuestion(0);
    setInputMode('voice');
    setTranscript('');
    setTextAnswer('');
    setSimpleAnswer('');
    setShowSimpleAnswer(false);
    setShowYourResponse(false);
    setFeedback(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setIsRecording(false);
    setIsPlaying(false);
    setShowPractice(true);
  };

  const handleViewResults = () => {
    setShowCongratulations(false);
    setShowResultsView(true);
  };

  const handlePreviousQuestion = () => {
    if (currentPracticeQuestion > 0) {
      // Stop any ongoing speech
      stopSpeaking();
      // Reset voice/text UI state when navigating
      setShowSimpleAnswer(false);
      setShowYourResponse && setShowYourResponse(false);
      setSimpleAnswer('');
      setTranscript('');
      setTextAnswer('');
      setAudioBlob(null);
      setAudioUrl(null);
      setIsRecording(false);
      setIsPlaying(false);
      setCurrentPracticeQuestion(currentPracticeQuestion - 1);
      setInputMode('voice');
      setFeedback(null); // Hide feedback when navigating back as well
    }
  };

  const handleBackToPractice = () => {
    setShowPractice(false);
    setCurrentPracticeQuestion(0);
  };

  const handleShowDifficultySelection = () => {
    console.log('Start Quiz button clicked!');
    console.log('Current state:', { showDifficultySelection, selectedRole, selectedSkill });
    setShowDifficultyPage(true);
    setShowSkillOptions(false);
  };

  const handleBackToSkillSelection = () => {
    setShowSkillOptions(false);
    setSelectedSkill('');
    setRevealedAnswers({});
    setShowDifficultySelection(false);
    setDifficulty('');
  };

  const handleBackToRoleSelection = () => {
    setSelectedRole('');
    setSelectedInterviewType('');
    setSelectedSkill('');
    setShowSkillOptions(false);
    setDifficulty('');
    setRevealedAnswers({});
    setShowDifficultySelection(false);
    setCurrentStep('role');
  };

  const handleBackToTypeSelection = () => {
    setSelectedSkill('');
    setShowSkillOptions(false);
    setCurrentStep('type');
  };

  const handleDifficultySelect = (selectedDifficulty) => {
    setDifficulty(selectedDifficulty);
    setShowQuiz(true);
    setShowDifficultyPage(false);
    setCurrentQuestion(0);
    setScore(0);
    setShowResult(false);
    try { localStorage.setItem('currentSkillName', selectedSkill || ''); } catch (_) {}
    // stay on the same page (no route change)
  };

  const handleRevealAnswer = (questionIndex) => {
    setRevealedAnswers(prev => ({
      ...prev,
      [questionIndex]: !prev[questionIndex]
    }));
  };

  const handleAnswerSelect = (answerIndex) => {
    setSelectedAnswer(answerIndex);
  };

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return;

    const questions = getQuestions();
    const currentQ = questions[currentQuestion];
    if (!currentQ) return;

    if (selectedAnswer === currentQ.correct) {
      setScore(score + 1);
      setIsCorrect(true);
    } else {
      setIsCorrect(false);
    }

    setTimeout(() => {
      if (currentQuestion < questions.length - 1) {
        setCurrentQuestion(currentQuestion + 1);
        setSelectedAnswer(null);
        setIsCorrect(null);
      } else {
        setShowResult(true);
      }
    }, 2000);
  };

  const resetQuiz = () => {
    setShowQuiz(false);
    setShowResult(false);
    setCurrentQuestion(0);
    setScore(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
  };

  const getQuestions = () => {
    if (!selectedSkill || !selectedInterviewType || !difficulty) return [];
    return mockQuestions[selectedSkill]?.[selectedInterviewType]?.[difficulty] || [];
  };

  const questions = getQuestions();
  const currentQ = questions[currentQuestion];

  if (showResult) {
    const percentage = Math.round((score / questions.length) * 100);
    return (
      <div className="skill-prep">
        <div className="container">
          <div className="result-container">
            <div className="result-header">
              <button onClick={() => setShowResult(false)} className="back-btn">
                Back to Quiz
              </button>
              <div className="result-content">
                <Trophy size={64} className="result-icon" />
                <h2>Quiz Complete!</h2>
                <p>Here's how you performed:</p>
              </div>
            </div>
            
            <div className="result-card card">
              <div className="result-stats">
                <div className="stat-item">
                  <div className="stat-value">{score}/{questions.length}</div>
                  <div className="stat-label">Correct Answers</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{percentage}%</div>
                  <div className="stat-label">Accuracy</div>
                </div>
              </div>

              <div className="result-actions">
                <button onClick={resetQuiz} className="btn btn-primary">
                  Try Again
                </button>
                <button onClick={() => setShowResult(false)} className="btn btn-secondary">
                  Review Answers
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showQuiz) {
    if (!questions || questions.length === 0) {
      return (
        <div className="skill-prep">
          <div className="container">
            <div className="quiz-container">
              <div className="quiz-header">
                <button onClick={() => setShowQuiz(false)} className="back-btn">
                  Back to Difficulty Selection
                </button>
              </div>
              <div className="no-questions-container">
                <div className="no-questions-card card">
                  <h3>No Questions Available</h3>
                  <p>Please choose a different difficulty or interview type.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="skill-prep">
        <div className="container">
          <div className="quiz-container">
            <div className="quiz-header">
              <button onClick={() => setShowQuiz(false)} className="back-btn">
                Back to Difficulty Selection
              </button>
              <div className="quiz-info">
                <h2>{selectedSkill} - {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</h2>
                <div className="quiz-progress">
                  Question {currentQuestion + 1} of {questions.length}
                </div>
              </div>
              <div className="quiz-score">
                Score: {score}
              </div>
            </div>

            <div className="question-card card">
              <div className="question-content">
                <h3>{currentQ?.question || 'No question found'}</h3>
                
                <div className="options-list">
                  {currentQ?.options?.map((option, index) => (
                    <button
                      key={index}
                      className={`option-btn ${selectedAnswer === index ? 'selected' : ''} ${
                        isCorrect !== null && index === currentQ.correct ? 'correct' : ''
                      } ${isCorrect !== null && selectedAnswer === index && index !== currentQ.correct ? 'incorrect' : ''}`}
                      onClick={() => handleAnswerSelect(index)}
                      disabled={isCorrect !== null}
                    >
                      <span className="option-letter">{String.fromCharCode(65 + index)}</span>
                      <span className="option-text">{option}</span>
                      {isCorrect !== null && index === currentQ?.correct && (
                        <CheckCircle size={20} className="option-icon correct" />
                      )}
                      {isCorrect !== null && selectedAnswer === index && index !== currentQ?.correct && (
                        <XCircle size={20} className="option-icon incorrect" />
                      )}
                    </button>
                  ))}
                </div>

                {selectedAnswer !== null && (
                  <div className="explanation">
                    <h4>Explanation:</h4>
                    <p>{currentQ?.explanation}</p>
                  </div>
                )}

                <div className="question-actions">
                  {selectedAnswer === null ? (
                    <button 
                      className="btn btn-primary" 
                      disabled={selectedAnswer === null}
                    >
                      Submit Answer
                    </button>
                  ) : (
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSubmitAnswer}
                    >
                      {currentQuestion < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                      <ArrowRight size={20} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showQuestionsList) {
    return (
      <div className="skill-prep">
        <div className="container">
          <button 
            onClick={() => {
              setShowQuestionsList(false);
              setCurrentStep('skill');
            }} 
            className="back-btn"
          >
            Back to Skill Selection
          </button>
          <div className="questions-list-container">
            <div className="questions-list-header">
              <h2>Read and Complete - {selectedSkill}</h2>
              <p>Select a question to practice</p>
            </div>

            {isLoadingQuestions ? (
              <div className="loading-container">
                <Loader2 size={48} className="loading-spinner" />
                <p>Loading questions from database...</p>
              </div>
            ) : questionsError ? (
              <div className="error-container">
                <div className="error-card card">
                  <h3>⚠️ {questionsError}</h3>
                  <p>Please check if the backend server is running on port 5000.</p>
                  <button 
                    onClick={() => fetchQuestionsFromAPI(selectedInterviewType, selectedSkill)}
                    className="btn btn-primary"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : apiQuestions.length > 0 ? (
              <div className="questions-list">
                {apiQuestions.map((question, index) => {
                  const questionNumber = index + 1; // First question is #1
                  const preview = String(question || '').slice(0, 140);
                  const scoreValue = getQuestionScore(index);
                  const scoreClass = getScoreClass(scoreValue);

                  return (
                    <div 
                      key={index} 
                      className="question-list-item simple"
                      onClick={() => handleQuestionClick(index)}
                    >
                      <div className="ql-left">
                        <div className="ql-number">{questionNumber}</div>
                        <div className="ql-texts">
                          <div className="question-title">Read and Complete #{questionNumber}</div>
                          <div className="question-preview">{preview}{question && question.length > 140 ? '…' : ''}</div>
                        </div>
                      </div>
                      <div className="ql-actions">
                        <div className="ql-actions-top">
                          <button 
                            className="ql-btn play"
                            title="Open"
                            onClick={(e) => { e.stopPropagation(); handleQuestionClick(index); }}
                          >
                            <Play size={16} />
                          </button>
                          <button 
                            className={`ql-btn star ${favoriteQuestions[index] ? 'active' : ''}`}
                            title={favoriteQuestions[index] ? 'Unfavorite' : 'Favorite'}
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(index); }}
                          >
                            {favoriteQuestions[index] ? '★' : '☆'}
                          </button>
                        </div>
                        {scoreValue !== null && (
                          <div className={`ql-score-text ${scoreClass}`}>
                            {`Score: ${scoreValue.toFixed(0)}%`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="no-questions-container">
                <div className="no-questions-card card">
                  <h3>No Questions Available</h3>
                  <p>There are no questions available for this skill and interview type combination.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show congratulations screen
  if (showCongratulations) {
    return (
      <div className="skill-prep">
        <div className="container">
          <div className="congratulations-container">
            <div className="congratulations-card card">
              <div className="congratulations-header">
                <Trophy size={80} className="congratulations-icon" />
                <h2>Congratulations! You Did It! 🎉</h2>
                <p>You have completed all the practice questions. Great job!</p>
              </div>
              
              <div className="congratulations-actions">
                <button 
                  className="btn btn-primary btn-large"
                  onClick={handleStartPracticeAgain}
                >
                  Start Practice Again
                  <Play size={20} />
                </button>
                <button 
                  className="btn btn-secondary btn-large"
                  onClick={handleViewResults}
                >
                  View Results
                  <TrendingUp size={20} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show results view
  if (showResultsView) {
    return (
      <div className="skill-prep">
        <div className="container">
          <button 
            onClick={() => {
              setShowResultsView(false);
              setShowCongratulations(true);
            }} 
            className="back-btn"
          >
            Back to Congratulations
          </button>
          <div className="results-view-container">
            <div className="results-view-header">
              <h2>Practice Session Report</h2>
              <p>Complete report of your practice session</p>
            </div>
            
            <div className="results-list">
              {practiceSessionData.length > 0 ? (
                practiceSessionData.map((item, index) => (
                  <div key={index} className="result-item card">
                    <div className="result-item-header">
                      <div className="result-item-number">Question {item.questionIndex + 1}</div>
                      {item.feedback && item.feedback.score !== undefined && (
                        <div className={`result-item-score ${getScoreClass((item.feedback.score / 10) * 100)}`}>
                          Score: {item.feedback.score}/10
                        </div>
                      )}
                    </div>
                    
                    <div className="result-item-content">
                      {/* Question Card */}
                      <div className="result-section-card question-card">
                        <div className="result-section-header">
                          <div className="result-section-title">
                            <HelpCircle className="result-section-icon question-icon" size={22} />
                            <h4>Question</h4>
                          </div>
                        </div>
                        <div className="result-section-body">
                        <p>{item.question}</p>
                        </div>
                      </div>
                      
                      {/* Your Response Card */}
                      {item.response && (
                        <div className="result-section-card response-card">
                          <div className="result-section-header">
                            <div className="result-section-title">
                              <MessageSquare className="result-section-icon response-icon" size={22} />
                              <h4>Your Response</h4>
                            </div>
                          </div>
                          <div className="result-section-body">
                          <p>{item.response}</p>
                          </div>
                        </div>
                      )}
                      
                      {item.feedback && (
                        <div className="feedback-card-container">
                          <div className="feedback-card-header">
                            <div className="feedback-card-title">
                              <Trophy className="feedback-icon" size={24} />
                              <h4>AI Feedback</h4>
                            </div>
                          </div>
                          
                          <div className="feedback-card-body">
                          {item.feedback.score !== undefined && (
                              <div className="feedback-card-item feedback-score-card">
                                <div className="feedback-item-header">
                                  <Star className="feedback-item-icon score-icon" size={20} />
                                  <strong>Score</strong>
                                </div>
                                <div className="feedback-score-value">
                                  <span className="score-number">{item.feedback.score}</span>
                                  <span className="score-divider">/</span>
                                  <span className="score-total">10</span>
                                </div>
                            </div>
                          )}
                            
                          {item.feedback.strengths && item.feedback.strengths.length > 0 && (
                              <div className="feedback-card-item feedback-strengths-card">
                                <div className="feedback-item-header">
                                  <ThumbsUp className="feedback-item-icon strengths-icon" size={20} />
                                  <strong>Strengths</strong>
                                </div>
                                <ul className="feedback-list">
                                {item.feedback.strengths.map((strength, i) => (
                                    <li key={i}>
                                      <CheckCircle className="list-icon" size={16} />
                                      {strength}
                                    </li>
                                ))}
                              </ul>
                            </div>
                          )}
                            
                          {item.feedback.improvements && item.feedback.improvements.length > 0 && (
                              <div className="feedback-card-item feedback-improvements-card">
                                <div className="feedback-item-header">
                                  <TrendingDown className="feedback-item-icon improvements-icon" size={20} />
                                  <strong>Areas for Improvement</strong>
                                </div>
                                <ul className="feedback-list">
                                {item.feedback.improvements.map((improvement, i) => (
                                    <li key={i}>
                                      <TrendingUp className="list-icon" size={16} />
                                      {improvement}
                                    </li>
                                ))}
                              </ul>
                            </div>
                          )}
                            
                          {item.feedback.summary && (
                              <div className="feedback-card-item feedback-summary-card">
                                <div className="feedback-item-header">
                                  <FileText className="feedback-item-icon summary-icon" size={20} />
                                  <strong>Summary</strong>
                                </div>
                                <p className="feedback-summary-text">{item.feedback.summary}</p>
                            </div>
                          )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-results card">
                  <p>No practice data available. Please complete some questions first.</p>
                </div>
              )}
            </div>
            
            <div className="results-view-actions">
              <button 
                className="btn btn-primary btn-large"
                onClick={handleStartPracticeAgain}
              >
                Start Practice Again
                <Play size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showPractice) {
    return (
      <div className="skill-prep">
        <div className="container">
          <button 
            onClick={() => {
              setShowPractice(false);
              setShowQuestionsList(true);
            }} 
            className="back-btn"
          >
            Back to Questions List
          </button>
          <div className="practice-container">
            <div className="practice-header">
              <h2>Practice Questions - {selectedSkill}</h2>
              <p>Review conceptual questions to strengthen your understanding</p>
            </div>

            {isLoadingQuestions ? (
              <div className="loading-container">
                <Loader2 size={48} className="loading-spinner" />
                <p>Loading questions from database...</p>
              </div>
            ) : questionsError ? (
              <div className="error-container">
                <div className="error-card card">
                  <h3>⚠️ {questionsError}</h3>
                  <p>Please check if the backend server is running on port 5000.</p>
                  <button 
                    onClick={() => fetchQuestionsFromAPI(selectedInterviewType, selectedSkill)}
                    className="btn btn-primary"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : apiQuestions.length > 0 ? (
              <div className="practice-split-layout">
                {/* Left Side - Practice Questions */}
                <div className="practice-questions-side">
                  <div className="practice-questions-container">
                    <div className="voice-practice-interface">
                  <div className="voice-interview-container">
                      {/* Question Display */}
                      <div className="question-section">
                        <div className="question-header">
                          <div className="question-info">
                            <span className="question-number">Question {currentPracticeQuestion + 1} of {apiQuestions.length}</span>
                            <div className="timer">
                              <Clock size={16} />
                              <span>{formatTime(recordingTime)} / {formatTime(maxTime)}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="question-text-container">
                          <div className="question-text">
                            {apiQuestions[currentPracticeQuestion]}
                            
                            {/* Question Voice Controls - Inside Question Box */}
                            <button
                              className="question-voice-btn-inline"
                              onClick={handleQuestionVoiceClick}
                              title={(() => {
                                const states = {
                                  isPaused: 'Resume',
                                  isSpeaking: 'Pause',
                                  default: 'Play question'
                                };
                                if (isPaused && isSpeaking) return states.isPaused;
                                if (isSpeaking && !isPaused) return states.isSpeaking;
                                return states.default;
                              })()}
                            >
                              {(() => {
                                const buttonStates = {
                                  paused: { icon: Play },
                                  speaking: { icon: Pause },
                                  idle: { icon: Volume2 }
                                };
                                
                                let state = 'idle';
                                if (isPaused && isSpeaking) state = 'paused';
                                else if (isSpeaking && !isPaused) state = 'speaking';
                                
                                const { icon: Icon } = buttonStates[state];
                                return <Icon size={20} />;
                              })()}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Input Mode Toggle - always show both; Type toggles open/close */}
                      <div className="input-mode-toggle">
                        <button
                          className={`mode-button ${inputMode === 'voice' ? 'active' : ''}`}
                          onClick={() => setInputMode('voice')}
                        >
                          <Mic size={20} />
                          Voice Answer
                        </button>
                        <button
                          className={`mode-button ${inputMode === 'text' ? 'active' : ''}`}
                          onClick={() => setInputMode(inputMode === 'text' ? 'voice' : 'text')}
                        >
                          <Edit3 size={20} />
                          Type Answer
                        </button>
                        <button
                          className="mode-button ai-assistant-btn"
                          onClick={handleAskAssistant}
                          title="Ask AI Assistant about this question"
                        >
                          <Bot size={20} />
                          Ask AI Assistant
                        </button>
                      </div>

                      {/* Voice Controls */}
                      {inputMode === 'voice' && (
                        <div className="voice-controls">
                          <button
                            className={`voice-button ${isRecording ? 'recording' : ''}`}
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={isProcessing}
                          >
                            {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
                          </button>
                          
                          {audioUrl && (
                            <button
                              className="play-button"
                              onClick={isPlaying ? pauseAudio : playAudio}
                            >
                              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                            </button>
                          )}
                          
                          {isProcessing && (
                            <div className="processing-indicator">
                              <Loader2 size={20} className="animate-spin" />
                              <span>Processing voice...</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Text Input */}
                      {inputMode === 'text' && (
                        <div className="text-input-section">
                          <textarea
                            className="text-answer-input"
                            placeholder="Type your answer here..."
                            value={textAnswer}
                            onChange={(e) => setTextAnswer(e.target.value)}
                            rows={6}
                            disabled={isProcessing}
                          />
                          <button
                            className="send-btn"
                            title={isProcessing ? 'Submitting...' : 'Submit'}
                            onClick={(e) => { e.preventDefault(); submitTextForFeedback(); }}
                            disabled={isProcessing || !textAnswer.trim()}
                          >
                            <Send size={18} />
                          </button>
                        </div>
                      )}

                      {/* Status */}
                      <div className="recording-status">
                        {inputMode === 'voice' ? (
                          isRecording ? (
                            <div className="status-recording">
                              <div className="pulse-dot"></div>
                              <span>Recording... Speak now</span>
                            </div>
                          ) : null
                        ) : (
                          textAnswer.trim() ? (
                            <div className="status-complete">
                              <CheckCircle size={16} />
                            <span>Answer ready!</span>
                            </div>
                          ) : null
                        )}
                      </div>

                      {/* User Message */}
                      {userMessage && (
                        <div className="user-message">
                          <div className="message-content">
                            <XCircle size={16} />
                            <span>{userMessage}</span>
                            <button 
                              className="message-close"
                              onClick={() => setUserMessage('')}
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      )}

                      {/* AI feedback button removed */}

                      {/* Simple Answer Section */}
                      {simpleAnswer && (
                        <div className="simple-answer-container">
                          <div 
                            className="simple-answer-header"
                            onClick={() => setShowSimpleAnswer(!showSimpleAnswer)}
                          >
                            <div className="simple-answer-title">
                              <BookOpen size={20} />
                              <span>Simple Answer</span>
                              <span className="ready-badge">Click to view</span>
                            </div>
                            <div className="header-actions">
                              <button
                                className="voice-play-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  speakText(simpleAnswer);
                                }}
                                title={isSpeaking ? "Stop speaking" : "Listen to answer"}
                              >
                                {isSpeaking ? <Square size={16} /> : <Volume2 size={16} />}
                              </button>
                              <ChevronRight 
                                size={20} 
                                className={`chevron ${showSimpleAnswer ? 'expanded' : ''}`}
                              />
                            </div>
                          </div>
                          
                          {showSimpleAnswer && (
                            <div className="simple-answer-content">
                              <div className="simple-answer-text">{simpleAnswer}</div>
                            </div>
                          )}
                        </div>
                      )}


                      {/* Your Response (collapsible) */}
                      {transcript && (
                        <div className="your-response-container">
                          <div className="simple-answer-header" onClick={() => setShowYourResponse(!showYourResponse)}>
                            <div className="simple-answer-title">
                              <Edit3 size={20} />
                              <span>Your Response</span>
                              <span className="ready-badge">Click to view</span>
                            </div>
                            <div className="header-actions">
                              <button
                                className="voice-play-button"
                                onClick={(e) => { e.stopPropagation(); speakText(transcript); }}
                                title={isSpeaking ? "Stop speaking" : "Listen to your response"}
                              >
                                {isSpeaking ? <Square size={16} /> : <Volume2 size={16} />}
                              </button>
                              <ChevronRight size={20} className={`chevron ${showYourResponse ? 'expanded' : ''}`} />
                            </div>
                          </div>
                          {showYourResponse && (
                            <div className="simple-answer-content">
                              <div className="simple-answer-text">{transcript}</div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Feedback Section (collapsible) */}
                      {feedback && (
                        <div className="feedback-section-container">
                          <div className="simple-answer-header" onClick={() => setShowFeedbackSection(!showFeedbackSection)}>
                            <div className="simple-answer-title">
                              <Trophy size={20} />
                              <span>AI Feedback</span>
                              <span className="ready-badge">Click to view</span>
                            </div>
                            <div className="header-actions">
                              <ChevronRight size={20} className={`chevron ${showFeedbackSection ? 'expanded' : ''}`} />
                            </div>
                          </div>
                          {showFeedbackSection && (
                            <div className="feedback-section-content">
                              <div className="feedback-card-container practice-feedback">
                                <div className="feedback-card-body">
                          {typeof feedback.score !== 'undefined' && (
                                    <div className="feedback-card-item feedback-score-card">
                                      <div className="feedback-item-header">
                                        <Star className="feedback-item-icon score-icon" size={20} />
                                        <strong>Score</strong>
                                      </div>
                                      <div className="feedback-score-value">
                                        <span className="score-number">{feedback.score}</span>
                                        <span className="score-divider">/</span>
                                        <span className="score-total">10</span>
                                      </div>
                                    </div>
                          )}
                                  
                          {feedback.strengths && feedback.strengths.length > 0 && (
                                    <div className="feedback-card-item feedback-strengths-card">
                                      <div className="feedback-item-header">
                                        <ThumbsUp className="feedback-item-icon strengths-icon" size={20} />
                                        <strong>Strengths</strong>
                                      </div>
                                      <ul className="feedback-list">
                                        {feedback.strengths.map((s, i) => (
                                          <li key={i}>
                                            <CheckCircle className="list-icon" size={16} />
                                            {s}
                                          </li>
                                        ))}
                              </ul>
                            </div>
                          )}
                                  
                          {feedback.improvements && feedback.improvements.length > 0 && (
                                    <div className="feedback-card-item feedback-improvements-card">
                                      <div className="feedback-item-header">
                                        <TrendingDown className="feedback-item-icon improvements-icon" size={20} />
                                        <strong>Areas for Improvement</strong>
                                      </div>
                                      <ul className="feedback-list">
                                        {feedback.improvements.map((s, i) => (
                                          <li key={i}>
                                            <TrendingUp className="list-icon" size={16} />
                                            {s}
                                          </li>
                                        ))}
                              </ul>
                            </div>
                          )}
                                  
                          {feedback.summary && (
                                    <div className="feedback-card-item feedback-summary-card">
                                      <div className="feedback-item-header">
                                        <FileText className="feedback-item-icon summary-icon" size={20} />
                                        <strong>Summary</strong>
                                      </div>
                                      <p className="feedback-summary-text">{feedback.summary}</p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      <audio
                        ref={audioRef}
                        src={audioUrl}
                        onEnded={() => setIsPlaying(false)}
                        onPause={() => setIsPlaying(false)}
                      />

                      {/* Navigation Controls */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                        <button 
                          className="btn btn-secondary"
                          onClick={handlePreviousQuestion}
                          disabled={currentPracticeQuestion === 0}
                          title="Previous question"
                        >
                          <ArrowLeft size={20} />
                          Previous
                        </button>

                        {currentPracticeQuestion === apiQuestions.length - 1 ? (
                          <button 
                            className="btn btn-primary"
                            onClick={handleEndPractice}
                            title="End practice session"
                          >
                            END
                          </button>
                        ) : (
                          <button 
                            className="btn btn-primary"
                            onClick={handleNextQuestion}
                            title="Next question"
                          >
                            Next
                            <ArrowRight size={20} />
                          </button>
                        )}
                      </div>
                  </div>
                </div>
              </div>
                </div>

                {/* Right Side - Chatbot Sidebar */}
                <div className="chatbot-sidebar">
                  <Chatbot
                    currentQuestion={apiQuestions[currentPracticeQuestion] || null}
                    selectedSkill={selectedSkill}
                    selectedRole={selectedRole}
                    interviewType={selectedInterviewType}
                    isSidebar={true}
                    askAssistantRequest={askAssistantRequest}
                  />
                </div>
              </div>
            ) : (
              <div className="no-questions-container">
                <div className="no-questions-card card">
                  <h3>No Questions Available</h3>
                  <p>There are no practice questions available for this skill and interview type combination.</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Feedback Modal */}
        {showFeedbackModal && feedback && (
          <div className="feedback-modal-overlay" onClick={() => {
            setShowFeedbackModal(false);
            setShowFeedbackSection(true); // Auto-expand feedback section after closing modal
          }}>
            <div className="feedback-modal-container" onClick={(e) => e.stopPropagation()}>
              <div className="feedback-modal-header">
                <div className="feedback-modal-title">
                  <Trophy className="feedback-icon" size={28} />
                  <h3>AI Feedback</h3>
                </div>
                <button 
                  className="feedback-modal-close"
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setShowFeedbackSection(true); // Auto-expand feedback section after closing modal
                  }}
                  aria-label="Close feedback modal"
                >
                  <X size={24} />
                </button>
              </div>
              
              <div className="feedback-modal-body">
                {typeof feedback.score !== 'undefined' && (
                  <div className="feedback-card-item feedback-score-card">
                    <div className="feedback-item-header">
                      <Star className="feedback-item-icon score-icon" size={20} />
                      <strong>Score</strong>
                    </div>
                    <div className="feedback-score-value">
                      <span className="score-number">{feedback.score}</span>
                      <span className="score-divider">/</span>
                      <span className="score-total">10</span>
                    </div>
                  </div>
                )}
                
                {feedback.strengths && feedback.strengths.length > 0 && (
                  <div className="feedback-card-item feedback-strengths-card">
                    <div className="feedback-item-header">
                      <ThumbsUp className="feedback-item-icon strengths-icon" size={20} />
                      <strong>Strengths</strong>
                    </div>
                    <ul className="feedback-list">
                      {feedback.strengths.map((s, i) => (
                        <li key={i}>
                          <CheckCircle className="list-icon" size={16} />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {feedback.improvements && feedback.improvements.length > 0 && (
                  <div className="feedback-card-item feedback-improvements-card">
                    <div className="feedback-item-header">
                      <TrendingDown className="feedback-item-icon improvements-icon" size={20} />
                      <strong>Areas for Improvement</strong>
                    </div>
                    <ul className="feedback-list">
                      {feedback.improvements.map((s, i) => (
                        <li key={i}>
                          <TrendingUp className="list-icon" size={16} />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {feedback.summary && (
                  <div className="feedback-card-item feedback-summary-card">
                    <div className="feedback-item-header">
                      <FileText className="feedback-item-icon summary-icon" size={20} />
                      <strong>Summary</strong>
                    </div>
                    <p className="feedback-summary-text">{feedback.summary}</p>
                  </div>
                )}
              </div>
              
              <div className="feedback-modal-footer">
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setShowFeedbackModal(false);
                    setShowFeedbackSection(true); // Auto-expand feedback section after closing modal
                  }}
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }


  if (showDifficultyPage) {
    return (
      <div className="skill-prep">
        <div className="container">
          <div className="difficulty-page-container">
            <div className="difficulty-page-header">
              <button onClick={() => setShowDifficultyPage(false)} className="back-btn">
                Back to Skill Selection
              </button>
              <h2>Choose Your Quiz Difficulty for {selectedSkill}</h2>
              <p>Select the difficulty level that matches your current knowledge</p>
            </div>
            
            <div className="difficulty-cards">
              {difficulties.map((diff) => (
                <div key={diff.value} className="difficulty-card card" onClick={() => handleDifficultySelect(diff.value)}>
                  <div className="difficulty-card-icon">
                    {diff.value === 'easy' && <TrendingUp size={48} />}
                    {diff.value === 'medium' && <Target size={48} />}
                    {diff.value === 'hard' && <Trophy size={48} />}
                  </div>
                  <h3>{diff.label}</h3>
                  <p className="difficulty-description">
                    {diff.value === 'easy' && 'Perfect for beginners. Basic concepts and fundamental questions.'}
                    {diff.value === 'medium' && 'For those with some experience. Intermediate level challenges.'}
                    {diff.value === 'hard' && 'Advanced level. Complex scenarios and expert knowledge required.'}
                  </p>
                  <div className="difficulty-features">
                    {diff.value === 'easy' && (
                      <>
                        <span>✓ Basic Concepts</span>
                        <span>✓ Simple Questions</span>
                        <span>✓ Great for Starters</span>
                      </>
                    )}
                    {diff.value === 'medium' && (
                      <>
                        <span>✓ Intermediate Level</span>
                        <span>✓ Practical Scenarios</span>
                        <span>✓ Balanced Challenge</span>
                      </>
                    )}
                    {diff.value === 'hard' && (
                      <>
                        <span>✓ Advanced Topics</span>
                        <span>✓ Complex Problems</span>
                        <span>✓ Expert Level</span>
                      </>
                    )}
                  </div>
                  <button className="btn btn-primary btn-large">
                    Start {diff.label} Quiz
                    <ArrowRight size={20} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showSkillOptions) {
    return (
      <div className="skill-prep">
        <div className="container">
          <div className="skill-options-container">
            <div className="skill-options-header">
              <button onClick={handleBackToRoleSelection} className="back-btn">
                Back to Role Selection
              </button>
              <h2>Choose Your Learning Path for {selectedSkill}</h2>
              <p>Select how you want to practice {selectedSkill}</p>
            </div>
            
            <div className="learning-path-options">
              <div className="learning-option-card card">
                <div className="learning-option-icon">
                  <Edit3 size={48} />
                </div>
                <h3>Practice Questions</h3>
                <p>Review conceptual questions and detailed answers to strengthen your understanding</p>
                <div className="learning-option-features">
                  <span>✓ Conceptual Learning</span>
                  <span>✓ Detailed Explanations</span>
                  <span>✓ Self-Paced Study</span>
                </div>
                <button 
                  className="btn btn-primary btn-large"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStartPractice();
                  }}
                  style={{ 
                    cursor: 'pointer',
                    zIndex: 10,
                    position: 'relative'
                  }}
                >
                  Start Practice
                  <ArrowRight size={20} />
                </button>
              </div>

              <div className="learning-option-card card">
                <div className="learning-option-icon">
                  <Play size={48} />
                </div>
                <h3>Start Quiz</h3>
                <p>Test your knowledge with interactive MCQs at different difficulty levels</p>
                <div className="learning-option-features">
                  <span>✓ Interactive Testing</span>
                  <span>✓ Multiple Difficulties</span>
                  <span>✓ Score Tracking</span>
                </div>
                
                <div className="quiz-button-container">
                  <button 
                    className="btn btn-primary btn-large"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleShowDifficultySelection();
                    }}
                    style={{ 
                      cursor: 'pointer',
                      zIndex: 10,
                      position: 'relative'
                    }}
                  >
                    Start Quiz
                    <ArrowRight size={20} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="skill-prep">
      <div className="container">
        <button onClick={() => window.history.back()} className="back-btn">
          Back to Dashboard
        </button>
        <div className="skill-prep-header">
          <h1 className="section-title">Skill Preparation</h1>
          <p className="section-subtitle">
            Master technical skills with topic-wise MCQs and difficulty-based learning paths
          </p>
        </div>

        <div className="setup-container">
          <div className="setup-card card">
            {currentStep === 'role' && (
              <div className="setup-section">
                <h3>1. Choose Your Job Role</h3>
                <div className="role-options vertical-list">
                  {Object.entries(jobRoles).map(([role, data]) => (
                    <button
                      key={role}
                      className={`role-option ${selectedRole === role ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedRole(role);
                        setCurrentStep('type');
                      }}
                      style={{ '--role-color': data.color }}
                    >
                      <div className="role-color-indicator"></div>
                      <span>{role}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 'type' && selectedRole && (
              <div className="setup-section">
                <h3>2. Select Interview Type</h3>
                <div className="interview-type-options vertical-list">
                  {[
                    { value: 'technical', label: 'Technical Interview', icon: <Brain size={20} /> },
                    { value: 'conceptual', label: 'Conceptual Interview', icon: <BookOpen size={20} /> },
                    { value: 'problemSolving', label: 'Problem Solving Interview', icon: <Target size={20} /> },
                    { value: 'behavioral', label: 'Behavioral Interview', icon: <User size={20} /> }
                  ].map((type) => (
                    <button
                      key={type.value}
                      className={`interview-type-option ${type.value} ${selectedInterviewType === type.value ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedInterviewType(type.value);
                        setCurrentStep('skill');
                      }}
                    >
                      {type.icon}
                      <span>{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 'skill' && selectedRole && selectedInterviewType && (
              <div className="setup-section">
                <h3>3. Select a Skill</h3>
                <div className="skill-options vertical-list">
                  {jobRoles[selectedRole].skills.map((skill) => (
                    <button
                      key={skill}
                      className={`skill-option ${selectedSkill === skill ? 'selected' : ''}`}
                      onClick={() => handleSkillSelect(skill)}
                    >
                      <BookOpen size={20} />
                      <span>{skill}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillPrep;
