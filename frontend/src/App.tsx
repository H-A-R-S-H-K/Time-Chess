import { useState, useEffect, useRef, useCallback } from 'react';
import Game from './pages/Game';
import { matchmake, getGameStatus } from './services/api';
import './index.css';

type View = 'lobby' | 'searching' | 'game';

function App() {
  const [view, setView] = useState<View>('lobby');
  const [gameId, setGameId] = useState('');
  const [playerColor, setPlayerColor] = useState('');
  const [timeSeconds, setTimeSeconds] = useState(60);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => clearPoll();
  }, [clearPoll]);

  const handlePlay = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await matchmake(timeSeconds);
      setGameId(res.gameId);
      setPlayerColor(res.color);

      if (res.status === 'matched') {
        setView('game');
      } else {
        // Waiting for opponent — start polling
        setView('searching');
        pollRef.current = setInterval(async () => {
          try {
            const status = await getGameStatus(res.gameId);
            if (status.ready) {
              clearPoll();
              setView('game');
            }
          } catch {
            // ignore poll errors
          }
        }, 1000);
      }
    } catch {
      setErrorMsg('Failed to find a match. Is the server running?');
    }
    setLoading(false);
  };

  const handleCancel = () => {
    clearPoll();
    setView('lobby');
    setGameId('');
    setPlayerColor('');
  };

  const handleLeave = () => {
    clearPoll();
    setView('lobby');
    setGameId('');
    setPlayerColor('');
  };

  if (view === 'game') {
    return <Game gameId={gameId} playerColor={playerColor} onLeave={handleLeave} />;
  }

  const timeOptions = [
    { value: 30, display: '0:30', label: 'Bullet' },
    { value: 60, display: '1:00', label: 'Bullet' },
    { value: 180, display: '3:00', label: 'Blitz' },
    { value: 300, display: '5:00', label: 'Blitz' },
  ];

  return (
    <div className="lobby">
      <div className="lobby-card">
        <div className="lobby-header">
          <span className="lobby-icon">♟</span>
          <h1 className="lobby-title">Chess Arena</h1>
          <p className="lobby-subtitle">Time-Attack Chess</p>
        </div>

        {view === 'searching' ? (
          <div className="searching-overlay">
            <div className="searching-animation">
              <div className="searching-spinner" />
              <span className="searching-text">Looking for opponent<span className="searching-dots"></span></span>
            </div>
            <p className="searching-sub">
              Playing as {playerColor === 'white' ? '♔ White' : '♚ Black'} · {timeOptions.find(t => t.value === timeSeconds)?.display}
            </p>
            <button className="btn btn--danger" onClick={handleCancel}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="time-controls">
              <div className="time-controls-label">Time Control</div>
              <div className="time-grid">
                {timeOptions.map((t) => (
                  <button
                    key={t.value}
                    className={`time-btn ${timeSeconds === t.value ? 'time-btn--active' : ''}`}
                    onClick={() => setTimeSeconds(t.value)}
                  >
                    {t.display}
                    <span className="time-label">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="play-section">
              <button
                className="btn btn--primary btn--large"
                onClick={handlePlay}
                disabled={loading}
              >
                {loading ? 'Finding match...' : '⚔ Play'}
              </button>
            </div>
          </>
        )}

        {errorMsg && <div className="lobby-error">{errorMsg}</div>}

        <div className="rules-card">
          <h3>⏱ Time-Attack Rules</h3>
          <ul>
            <li>Each player has a countdown timer</li>
            <li>Your timer ticks down on your turn</li>
            <li>Give check: <strong>+10s</strong> for you, <strong>−5s</strong> for opponent</li>
            <li>Timer hits 0 → you lose!</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default App;
