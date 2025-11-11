import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Brain, 
  BookOpen, 
  BarChart3, 
  Target, 
  Users, 
  Zap,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import './Home.css';

const Home = () => {
  const { authenticated } = useAuth();
  const navigate = useNavigate();

  const handleClick = (e) => {
    if (!authenticated) {
      e.preventDefault();
      navigate('/signup');
    }
  };
  const features = [
    {
      icon: <BookOpen size={32} />,
      title: 'Skill Preparation',
      description: 'Master technical skills with topic-wise MCQs and difficulty-based learning paths.',
      color: 'var(--primary-color)'
    },
    {
      icon: <BarChart3 size={32} />,
      title: 'Progress Tracking',
      description: 'Monitor your improvement with detailed analytics and performance insights.',
      color: 'var(--secondary-color)'
    }
  ];

  const jobRoles = [
    {
      title: 'AI Engineer',
      skills: ['Machine Learning', 'Python', 'TensorFlow', 'PyTorch', 'Deep Learning'],
      color: 'var(--primary-color)'
    },
    {
      title: 'Data Scientist',
      skills: ['Python', 'Machine Learning', 'SQL', 'Data Analysis', 'Statistics'],
      color: 'var(--accent-color)'
    },
    {
      title: 'Python Developer',
      skills: ['Python', 'AWS', 'Kubernetes', 'Docker', 'Lambda'],
      color: 'var(--secondary-color)'
    }
  ];

  return (
    <div className="home">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <div className="hero-text animate-fade-in-left">
              <h1 className="hero-title">
                Master Your Interview Skills with
                <span className="highlight"> Practice2Panel</span>
              </h1>
              <p className="hero-description">
                The ultimate platform for skill practice and interview preparation. 
                Prepare smarter, perform better, and land your dream job.
              </p>
              <div className="hero-actions">
                {authenticated ? (
                  <>
                    <Link to="/skill-prep" className="btn btn-primary btn-large">
                      Start Learning
                      <ArrowRight size={20} />
                    </Link>
                    <Link to="/mock-interview" className="btn btn-secondary btn-large">
                      Mock Interview
                    </Link>
                  </>
                ) : (
                  <>
                    <button onClick={handleClick} className="btn btn-primary btn-large">
                      Get Started
                      <ArrowRight size={20} />
                    </button>
                    <button onClick={handleClick} className="btn btn-secondary btn-large">
                      Mock Interview
                    </button>
                  </>
                )}
              </div>
            </div>
              <div className="hero-visual animate-fade-in-right">
                <div className="hero-card animate-float">
                  <Brain size={64} />
                  <h3>Practice2Panel</h3>
                  <p>AI Powered Interview Preparation Platform</p>
                </div>
              </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="container">
          <h2 className="section-title">Why Choose Practice2Panel?</h2>
          <p className="section-subtitle">
            Our platform combines cutting-edge AI technology with proven learning methodologies 
            to give you the competitive edge you need.
          </p>
          <div className="features-grid">
            {features.map((feature, index) => (
              <div key={index} className="feature-card card animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="feature-icon" style={{ color: feature.color }}>
                  {feature.icon}
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Job Roles Section */}
      <section className="job-roles">
        <div className="container">
          <h2 className="section-title">Choose Your Job Role</h2>
          <p className="section-subtitle">
            Choose your job role and get personalized learning paths and interview questions.
          </p>
          <div className="roles-grid">
            {jobRoles.map((role, index) => (
              <div key={index} className="role-card card">
                <div className="role-header" style={{ backgroundColor: role.color }}>
                  <h3>{role.title}</h3>
                </div>
                <div className="role-content">
                  <h4>Key Skills:</h4>
                  <ul className="skills-list">
                    {role.skills.map((skill, skillIndex) => (
                      <li key={skillIndex}>
                        <CheckCircle size={16} />
                        {skill}
                      </li>
                    ))}
                  </ul>
                  {authenticated ? (
                    <Link to="/skill-prep" className="btn btn-primary">
                      Start Learning
                    </Link>
                  ) : (
                    <button onClick={handleClick} className="btn btn-primary">
                      Sign Up to Start
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Ace Your Next Interview?</h2>
            <p>Join thousands of successful candidates who've transformed their interview skills with Practice2Panel.</p>
            <div className="cta-actions">
              {authenticated ? (
                <Link to="/skill-prep" className="btn btn-primary btn-large">
                  Get Started Free
                </Link>
              ) : (
                <button onClick={handleClick} className="btn btn-primary btn-large">
                  Get Started Free
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
