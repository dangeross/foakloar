import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './components/App.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[ErrorBoundary]', error, info.componentStack); }
  render() {
    if (this.state.error) {
      return <pre style={{ color: 'red', padding: 20, whiteSpace: 'pre-wrap' }}>
        {this.state.error.toString()}
        {'\n\n'}Click to retry: <button onClick={() => { this.setState({ error: null }); window.location.reload(); }}>Reload</button>
      </pre>;
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <ErrorBoundary><App /></ErrorBoundary>
);
