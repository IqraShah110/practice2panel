import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const InterviewForm = ({ onStartInterview, apiBaseUrl }) => {
  const [formData, setFormData] = useState({
    name: '',
    job_role: 'AI Engineer',
    interview_type: 'Conceptual'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      setError('Please enter your name');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${apiBaseUrl || API_BASE_URL}/api/mock-interview/start-interview`, formData);
      onStartInterview(response.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start interview. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="interview-form-wrapper">
      <div className="form-header">
        <h1 className="form-title">
          Welcome to Mock Interview
        </h1>
        <p className="form-subtitle">
          Practice your interview skills with AI-powered feedback
        </p>
      </div>
      <form onSubmit={handleSubmit} className="interview-form">
        <div className="form-group">
          <label htmlFor="name">Candidate Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter your name"
            required
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="job_role">Job Role *</label>
          <select
            id="job_role"
            name="job_role"
            value={formData.job_role}
            onChange={handleChange}
            required
            disabled={loading}
          >
            <option value="AI Engineer">AI Engineer</option>
            <option value="Python Developer">Python Developer</option>
            <option value="Data Scientist">Data Scientist</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="interview_type">Interview Type *</label>
          <select
            id="interview_type"
            name="interview_type"
            value={formData.interview_type}
            onChange={handleChange}
            required
            disabled={loading}
          >
            <option value="Conceptual">Conceptual</option>
            <option value="Behavioral">Behavioral</option>
            <option value="Technical">Technical</option>
          </select>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="button-group form-button-group">
          <button 
            type="submit" 
            className="primary-button form-submit-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="button-spinner"></span>
                Starting Interview...
              </>
            ) : (
              <>
                Start Interview
                <span style={{ marginLeft: '8px' }}>→</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InterviewForm;

