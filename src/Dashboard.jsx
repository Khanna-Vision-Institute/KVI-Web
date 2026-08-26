import React, { useState, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = () => {
  const [status, setStatus] = useState(null);
  const [selectedJob, setSelectedJob] = useState('backups');
  const [jobHistory, setJobHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch system status
  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/status');
      const data = await response.json();
      setStatus(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch status:', error);
      setLoading(false);
    }
  };

  // Fetch job history
  const fetchJobHistory = async (jobType) => {
    try {
      const response = await fetch(`/api/jobs/${jobType}?limit=20`);
      const data = await response.json();
      setJobHistory(data);
    } catch (error) {
      console.error('Failed to fetch job history:', error);
    }
  };

  // Manual trigger
  const triggerJob = async (jobType) => {
    if (!window.confirm(`Manually trigger ${jobType} job?`)) return;
    
    try {
      const response = await fetch(`/api/trigger/${jobType}`, { method: 'POST' });
      const data = await response.json();
      alert(`Job ${jobType} triggered successfully`);
      fetchStatus();
      fetchJobHistory(jobType);
    } catch (error) {
      alert(`Failed to trigger job: ${error.message}`);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchJobHistory(selectedJob);

    if (autoRefresh) {
      const interval = setInterval(() => {
        fetchStatus();
        fetchJobHistory(selectedJob);
      }, 30000); // Refresh every 30 seconds

      return () => clearInterval(interval);
    }
  }, [selectedJob, autoRefresh]);

  if (loading) {
    return <div className="loading">Loading KVI Monitoring Dashboard...</div>;
  }

  const getStatusColor = (job) => {
    if (!job) return 'gray';
    if (job.status === 'completed') return 'green';
    if (job.status === 'failed') return 'red';
    return 'yellow';
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>🏥 Khanna Vision Institute - System Monitor</h1>
          <div className="header-actions">
            <label>
              <input 
                type="checkbox" 
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (30s)
            </label>
            <span className="system-uptime">
              Uptime: {Math.floor(status?.uptime / 3600)}h {Math.floor((status?.uptime % 3600) / 60)}m
            </span>
          </div>
        </div>
      </header>

      <div className="status-cards">
        <div className={`status-card ${getStatusColor(status?.jobs?.backups)}`}>
          <h3>🗄️ Backups</h3>
          <div className="status-details">
            <p>Last Run: {status?.jobs?.backups ? formatTimestamp(status.jobs.backups.timestamp) : 'Never'}</p>
            <p>Status: <strong>{status?.jobs?.backups?.status || 'No data'}</strong></p>
            {status?.jobs?.backups?.details && (
              <div className="job-details">
                <p>✓ Database: {status.jobs.backups.details.database}</p>
                <p>✓ Media: {status.jobs.backups.details.media}</p>
                <p>✓ Content: {status.jobs.backups.details.content}</p>
              </div>
            )}
          </div>
          <button 
            onClick={() => triggerJob('backup')}
            className="trigger-btn"
          >
            Run Now
          </button>
        </div>

        <div className={`status-card ${getStatusColor(status?.jobs?.fourOhFour)}`}>
          <h3>🚫 404 Monitor</h3>
          <div className="status-details">
            <p>Last Run: {status?.jobs?.fourOhFour ? formatTimestamp(status.jobs.fourOhFour.timestamp) : 'Never'}</p>
            <p>Status: <strong>{status?.jobs?.fourOhFour?.status || 'No data'}</strong></p>
            {status?.jobs?.fourOhFour?.stats && (
              <div className="job-details">
                <p>Checked: {status.jobs.fourOhFour.stats.totalChecked}</p>
                <p>404s: <span className="error-count">{status.jobs.fourOhFour.stats.notFound}</span></p>
                <p>Error Rate: <strong>{status.jobs.fourOhFour.stats.errorRate}</strong></p>
              </div>
            )}
          </div>
          <button 
            onClick={() => triggerJob('fourOhFour')}
            className="trigger-btn"
          >
            Run Now
          </button>
        </div>

        <div className={`status-card ${getStatusColor(status?.jobs?.phoneValidation)}`}>
          <h3>📞 Phone Validator</h3>
          <div className="status-details">
            <p>Last Run: {status?.jobs?.phoneValidation ? formatTimestamp(status.jobs.phoneValidation.timestamp) : 'Never'}</p>
            <p>Status: <strong>{status?.jobs?.phoneValidation?.status || 'No data'}</strong></p>
            {status?.jobs?.phoneValidation?.stats && (
              <div className="job-details">
                <p>Checked: {status.jobs.phoneValidation.stats.totalChecked}</p>
                <p>Incorrect: <span className="error-count">{status.jobs.phoneValidation.stats.incorrect}</span></p>
                <p>Error Rate: <strong>{status.jobs.phoneValidation.stats.errorRate}</strong></p>
              </div>
            )}
          </div>
          <button 
            onClick={() => triggerJob('phoneValidation')}
            className="trigger-btn"
          >
            Run Now
          </button>
        </div>
      </div>

      <div className="history-section">
        <div className="history-header">
          <h2>Job History</h2>
          <div className="job-selector">
            <button 
              className={selectedJob === 'backups' ? 'active' : ''}
              onClick={() => setSelectedJob('backups')}
            >
              Backups
            </button>
            <button 
              className={selectedJob === 'fourOhFour' ? 'active' : ''}
              onClick={() => setSelectedJob('fourOhFour')}
            >
              404 Monitor
            </button>
            <button 
              className={selectedJob === 'phoneValidation' ? 'active' : ''}
              onClick={() => setSelectedJob('phoneValidation')}
            >
              Phone Validation
            </button>
          </div>
        </div>

        <div className="history-table">
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Status</th>
                <th>Details</th>
                <th>Issues</th>
              </tr>
            </thead>
            <tbody>
              {jobHistory.map((job, index) => (
                <tr key={index} className={job.status === 'failed' ? 'error-row' : ''}>
                  <td>{formatTimestamp(job.timestamp)}</td>
                  <td>
                    <span className={`status-badge ${job.status}`}>
                      {job.status}
                    </span>
                  </td>
                  <td>
                    {job.stats && (
                      <div className="stats-cell">
                        {Object.entries(job.stats).slice(0, 3).map(([key, value]) => (
                          <span key={key}>{key}: {value} </span>
                        ))}
                      </div>
                    )}
                    {job.details && (
                      <div className="details-cell">
                        {Object.entries(job.details).map(([key, value]) => (
                          <span key={key}>{key}: {value} </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>
                    {job.error && <span className="error-text">{job.error}</span>}
                    {job.errors && job.errors.length > 0 && (
                      <span className="error-count">{job.errors.length} errors</span>
                    )}
                    {job.inconsistencies && job.inconsistencies.length > 0 && (
                      <details>
                        <summary>{job.inconsistencies.length} issues</summary>
                        <ul>
                          {job.inconsistencies.slice(0, 5).map((issue, i) => (
                            <li key={i}>
                              {issue.url}: {issue.issue}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="critical-alerts">
        <h3>⚠️ Critical Issues Requiring Attention</h3>
        {status?.jobs?.fourOhFour?.errors?.length > 0 && (
          <div className="alert-item">
            <strong>404 Errors:</strong>
            <ul>
              {status.jobs.fourOhFour.errors.slice(0, 5).map((error, i) => (
                <li key={i}>{error.url}</li>
              ))}
            </ul>
          </div>
        )}
        {status?.jobs?.phoneValidation?.inconsistencies?.filter(i => i.severity === 'high').length > 0 && (
          <div className="alert-item">
            <strong>Phone Number Issues:</strong>
            <ul>
              {status.jobs.phoneValidation.inconsistencies
                .filter(i => i.severity === 'high')
                .slice(0, 5)
                .map((issue, i) => (
                  <li key={i}>{issue.url}: Expected {issue.expected}, Found {issue.found}</li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;