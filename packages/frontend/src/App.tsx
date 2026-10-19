import React, { useEffect } from 'react';
import { useSessionStore } from './store/useSessionStore.js';
import { SessionSetup } from './sessions/SessionSetup.js';
import { RCACanvas } from './canvas/RCACanvas.js';
import { AgentPanel } from './agents/AgentPanel.js';
import { DecisionModal } from './agents/DecisionModal.js';
import { StatusBar } from './components/StatusBar.js';

export default function App() {
  const sessionId = useSessionStore((s) => s.sessionId);
  const phase = useSessionStore((s) => s.phase);
  const connect = useSessionStore((s) => s.connect);
  const connected = useSessionStore((s) => s.connected);
  const status = useSessionStore((s) => s.status);
  const pendingDecision = useSessionStore((s) => s.pendingDecision);

  useEffect(() => {
    connect();
  }, [connect]);

  if (!connected) {
    return (
      <div style={styles.loading}>
        <div style={styles.loadingCard}>
          <div style={styles.spinner} />
          <h2>Connecting to RCA Server...</h2>
          <p style={{ color: '#888', marginTop: 8 }}>Make sure backend running on port 3002</p>
        </div>
      </div>
    );
  }

  if (!sessionId) {
    return <SessionSetup />;
  }

  return (
    <div style={styles.sessionWrapper}>
      <div style={styles.mainArea}>
        <RCACanvas />
        <AgentPanel />
      </div>
      {pendingDecision && <DecisionModal decision={pendingDecision} />}
      <StatusBar />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  loading: {
    width: '100vw', height: '100vh',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  },
  loadingCard: {
    background: 'white', borderRadius: 16, padding: 40,
    textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  spinner: {
    width: 32, height: 32, border: '3px solid #e0e0e0', borderTop: '3px solid #667eea',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
  },
  sessionWrapper: {
    width: '100vw', height: '100vh', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  mainArea: {
    flex: 1, display: 'flex', overflow: 'hidden',
  },
};
