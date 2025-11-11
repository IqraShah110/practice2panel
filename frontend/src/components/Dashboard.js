import React, { useState } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Target, 
  Award, 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Star,
  Trophy,
  Activity,
  BookOpen,
  Mic,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
  const [selectedPeriod, setSelectedPeriod] = useState('week');

  // Mock data - in real app, this would come from API
  const mockData = {
    overallStats: {
      totalQuizzes: 24,
      totalInterviews: 8,
      averageScore: 78,
      improvementRate: 12.5
    },
    recentActivity: [
      {
        type: 'quiz',
        title: 'Machine Learning - Medium',
        score: 85,
        date: '2 hours ago',
        icon: <BookOpen size={16} />
      },
      {
        type: 'interview',
        title: 'AI Engineer - Technical',
        score: 82,
        date: '1 day ago',
        icon: <Mic size={16} />
      },
      {
        type: 'quiz',
        title: 'Python - Hard',
        score: 72,
        date: '2 days ago',
        icon: <BookOpen size={16} />
      }
    ],
    skillProgress: [
      { skill: 'Machine Learning', progress: 85, trend: 'up' },
      { skill: 'Python', progress: 92, trend: 'up' },
      { skill: 'SQL', progress: 78, trend: 'down' },
      { skill: 'Data Analysis', progress: 81, trend: 'up' },
      { skill: 'Deep Learning', progress: 68, trend: 'up' }
    ],
    achievements: [
      { name: 'First Quiz', description: 'Completed your first quiz', icon: <Star size={20} />, earned: true },
      { name: 'Perfect Score', description: 'Achieved 100% on a quiz', icon: <Trophy size={20} />, earned: true },
      { name: 'Interview Master', description: 'Complete 5 interviews', icon: <Award size={20} />, earned: false },
      { name: 'Streak Master', description: '7 days in a row', icon: <TrendingUp size={20} />, earned: false }
    ]
  };

  const periods = [
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' }
  ];

  const getTrendIcon = (trend) => {
    if (trend === 'up') {
      return <ArrowUp size={16} className="trend-up" />;
    } else if (trend === 'down') {
      return <ArrowDown size={16} className="trend-down" />;
    }
    return null;
  };

  return (
    <div className="dashboard">
      <div className="container">
        <div className="dashboard-header">
          <div className="header-content">
            <h1 className="section-title">Your Learning Dashboard</h1>
            <p className="section-subtitle">
              Track your progress, analyze performance, and celebrate achievements
            </p>
          </div>
          <div className="period-selector">
            <select 
              value={selectedPeriod} 
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="period-select"
            >
              {periods.map((period) => (
                <option key={period.value} value={period.value}>
                  {period.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Overall Stats */}
        <div className="stats-grid">
          <div className="stat-card card">
            <div className="stat-icon">
              <BookOpen size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{mockData.overallStats.totalQuizzes}</div>
              <div className="stat-label">Total Quizzes</div>
            </div>
          </div>

          <div className="stat-card card">
            <div className="stat-icon">
              <Mic size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{mockData.overallStats.totalInterviews}</div>
              <div className="stat-label">Total Interviews</div>
            </div>
          </div>

          <div className="stat-card card">
            <div className="stat-icon">
              <Target size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">{mockData.overallStats.averageScore}%</div>
              <div className="stat-label">Average Score</div>
            </div>
          </div>

          <div className="stat-card card">
            <div className="stat-icon">
              <TrendingUp size={24} />
            </div>
            <div className="stat-content">
              <div className="stat-value">+{mockData.overallStats.improvementRate}%</div>
              <div className="stat-label">Improvement Rate</div>
            </div>
          </div>
        </div>

        <div className="dashboard-content">
          <div className="content-grid">
            {/* Recent Activity */}
            <div className="content-section">
              <div className="section-header">
                <h2>Recent Activity</h2>
                <button className="btn btn-secondary">View All</button>
              </div>
              <div className="activity-list">
                {mockData.recentActivity.map((activity, index) => (
                  <div key={index} className="activity-item">
                    <div className="activity-icon">
                      {activity.icon}
                    </div>
                    <div className="activity-details">
                      <div className="activity-title">{activity.title}</div>
                      <div className="activity-meta">
                        <span className="activity-score">{activity.score}%</span>
                        <span className="activity-date">{activity.date}</span>
                      </div>
                    </div>
                    <div className="activity-status">
                      {activity.score >= 80 ? (
                        <CheckCircle size={20} className="status-success" />
                      ) : (
                        <XCircle size={20} className="status-warning" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Skill Progress */}
            <div className="content-section">
              <div className="section-header">
                <h2>Skill Progress</h2>
                <button className="btn btn-secondary">View Details</button>
              </div>
              <div className="skill-progress-list">
                {mockData.skillProgress.map((skill, index) => (
                  <div key={index} className="skill-progress-item">
                    <div className="skill-info">
                      <span className="skill-name">{skill.skill}</span>
                      <div className="skill-trend">
                        {getTrendIcon(skill.trend)}
                        <span className="skill-percentage">{skill.progress}%</span>
                      </div>
                    </div>
                    <div className="skill-bar">
                      <div 
                        className="skill-fill" 
                        style={{ width: `${skill.progress}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Achievements */}
          <div className="achievements-section">
            <div className="section-header">
              <h2>Achievements & Badges</h2>
              <span className="achievement-count">
                {mockData.achievements.filter(a => a.earned).length}/{mockData.achievements.length}
              </span>
            </div>
            <div className="achievements-grid">
              {mockData.achievements.map((achievement, index) => (
                <div 
                  key={index} 
                  className={`achievement-card ${achievement.earned ? 'earned' : 'locked'}`}
                >
                  <div className="achievement-icon">
                    {achievement.icon}
                  </div>
                  <div className="achievement-content">
                    <h3 className="achievement-name">{achievement.name}</h3>
                    <p className="achievement-description">{achievement.description}</p>
                  </div>
                  <div className="achievement-status">
                    {achievement.earned ? (
                      <CheckCircle size={20} className="status-success" />
                    ) : (
                      <div className="locked-indicator"></div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Chart */}
          <div className="performance-section">
            <div className="section-header">
              <h2>Performance Over Time</h2>
              <div className="chart-controls">
                <button className="chart-btn active">Score</button>
                <button className="chart-btn">Accuracy</button>
                <button className="chart-btn">Time</button>
              </div>
            </div>
            <div className="chart-container card">
              <div className="chart-placeholder">
                <BarChart3 size={64} />
                <h3>Performance Analytics</h3>
                <p>Your performance data will be displayed here</p>
                <div className="chart-metrics">
                  <div className="chart-metric">
                    <span className="metric-label">Best Score</span>
                    <span className="metric-value">95%</span>
                  </div>
                  <div className="chart-metric">
                    <span className="metric-label">Average Time</span>
                    <span className="metric-value">2:30</span>
                  </div>
                  <div className="chart-metric">
                    <span className="metric-label">Questions Answered</span>
                    <span className="metric-value">156</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
