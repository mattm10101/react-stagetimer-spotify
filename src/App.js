import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import io from 'socket.io-client';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import './App.css';

// --- Initialize Supabase Client ---
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- Initialize StageTimer Socket ---
const socket = io('https://api.stagetimer.io', {
  path: '/v1/socket.io',
  auth: {
    room_id: '55T3E3HN',
    api_key: '087a607d0b6b88601123f9ccdba3a898',
  },
});

function App() {
  // --- State ---
  const [connected, setConnected] = useState(false);
  const [timerRunning, setTimerRunning] = useState(false);
  const [status, setStatus] = useState('DISCONNECTED');
  const [roomName, setRoomName] = useState('StageTimer');
  const [currentTimer, setCurrentTimer] = useState(null);
  const [allTimers, setAllTimers] = useState([]);
  const [activeTimerId, setActiveTimerId] = useState(null);
  const [showCurrentTimer, setShowCurrentTimer] = useState(true);
  const [showAllTimers, setShowAllTimers] = useState(true);
  const [isBlackoutOn, setIsBlackoutOn] = useState(false);
  const [isMessageOn, setIsMessageOn] = useState(false);
  const [isDeleteTimersExpanded, setIsDeleteTimersExpanded] = useState(false);
  const [spotifyToken, setSpotifyToken] = useState(null);

  // --- Data Fetching Functions ---
  const fetchAllTimers = useCallback(async () => {
    try {
      const url = `https://api.stagetimer.io/v1/get_all_timers?room_id=55T3E3HN&api_key=087a607d0b6b88601123f9ccdba3a898`;
      const response = await axios.get(url);
      if (response.status === 200 && response.data.ok) {
        setAllTimers(response.data.data);
      } else {
        console.error(`Failed to fetch all timers: ${response.status} - ${response.data.message}`);
      }
    } catch (error) {
      console.error(`Error fetching all timers: ${error.message}`);
    }
  }, []);

  const fetchCurrentTimer = useCallback(async (timerId) => {
    try {
      const url = `https://api.stagetimer.io/v1/get_timer?room_id=55T3E3HN&timer_id=${timerId}&api_key=087a607d0b6b88601123f9ccdba3a898`;
      const response = await axios.get(url);
      if (response.status === 200 && response.data.ok) {
        setCurrentTimer(response.data.data);
      } else {
        console.error(`Failed to fetch current timer: ${response.status} - ${response.data.message}`);
      }
    } catch (error) {
      console.error(`Error fetching current timer: ${error.message}`);
    }
  }, []);

  const fetchRoomDetails = useCallback(async () => {
    try {
      const url = `https://api.stagetimer.io/v1/get_room?room_id=55T3E3HN&api_key=087a607d0b6b88601123f9ccdba3a898`;
      const response = await axios.get(url);
      if (response.status === 200 && response.data.ok) {
        const roomData = response.data.data;
        setRoomName(roomData.name || 'StageTimer');
        const currentActiveTimerId = roomData.active_timer;
        setActiveTimerId(currentActiveTimerId);
        if (currentActiveTimerId) {
          fetchCurrentTimer(currentActiveTimerId);
        }
      } else {
        console.error(`Failed to fetch room: ${response.status} - ${response.data.message}`);
      }
    } catch (error) {
      console.error(`Error fetching room: ${error.message}`);
    }
  }, [fetchCurrentTimer]);

  // --- StageTimer Socket useEffect ---
  useEffect(() => {
    socket.on('connect', () => {
      setConnected(true);
      setStatus('CONNECTED');
      fetchRoomDetails();
      fetchAllTimers();
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setStatus('DISCONNECTED');
    });

    socket.on('playback_status', (data) => {
      console.log('Playback status:', data);
      setTimerRunning(data.running);
      setStatus(data.running ? 'RUNNING' : 'STOPPED');
      if (data.timer_id && data.timer_id !== activeTimerId) {
        setActiveTimerId(data.timer_id);
        fetchCurrentTimer(data.timer_id);
        fetchAllTimers();
      }
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('playback_status');
    };
  }, [activeTimerId, fetchRoomDetails, fetchAllTimers, fetchCurrentTimer]);

  // --- Spotify Auth useEffect ---
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      window.history.replaceState({}, document.title, "/");
      const getToken = async () => {
        try {
          const { data, error } = await supabase.functions.invoke('spotify-auth', {
            body: { code },
          });
          if (error) throw error;
          console.log("Spotify Access Token:", data.access_token);
          setSpotifyToken(data.access_token);
        } catch (error) {
          console.error("Error fetching Spotify token:", error);
        }
      };
      getToken();
    }
  }, []);

  // --- Spotify Login Handler ---
  const handleSpotifyLogin = () => {
    const clientId = process.env.REACT_APP_SPOTIFY_CLIENT_ID;
    const redirectUri = process.env.REACT_APP_REDIRECT_URI;
    const scopes = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
    const authUrl = `https://accounts.spotify.com/authorize?response_type=code&client_id=${clientId}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    window.location.href = authUrl;
  };

  // --- App Functions ---
  async function selectTimer(timerId) {
    if (!connected) return console.error("Not connected yet!");
    try {
      const index = allTimers.findIndex(timer => timer._id === timerId) + 1;
      if (index === 0) return console.error("Timer not found in the list!");

      const resetUrl = `https://api.stagetimer.io/v1/reset_timer?room_id=55T3E3HN&index=${index}&api_key=087a607d0b6b88601123f9ccdba3a898`;
      const resetResponse = await axios.get(resetUrl);
      if (resetResponse.status === 200) {
        setActiveTimerId(timerId);
        setTimerRunning(false);
        await fetchCurrentTimer(timerId);
        await fetchAllTimers();
      } else {
        console.error(`Failed to reset timer: ${resetResponse.status} - ${resetResponse.data.message}`);
      }
    } catch (error) {
      console.error(`HTTP Error: ${error.message}`);
    }
  }

  async function sendCommand(endpoint) {
    if (!connected) return console.error("Not connected yet!");
    try {
      const url = `https://api.stagetimer.io/v1/${endpoint}?room_id=55T3E3HN&api_key=087a607d0b6b88601123f9ccdba3a898`;
      const response = await axios.get(url);
      if (response.status === 200) {
        fetchAllTimers();
        if (response.data.data && typeof response.data.data.running !== 'undefined') {
          setTimerRunning(response.data.data.running);
        }
      } else {
        console.error(`Failed to send ${endpoint} command: ${response.status} - ${response.data}`);
      }
    } catch (error) {
      console.error(`HTTP Error: ${error.message}`);
    }
  }

  async function deleteTimer(timerId) {
    if (!connected) return console.error("Not connected yet!");
    try {
      const url = `https://api.stagetimer.io/v1/delete_timer?room_id=55T3E3HN&timer_id=${timerId}&api_key=087a607d0b6b88601123f9ccdba3a898`;
      const response = await axios.get(url);
      if (response.status === 200) {
        setAllTimers(allTimers.filter(timer => timer._id !== timerId));
        if (activeTimerId === timerId) {
          setActiveTimerId(null);
          setCurrentTimer(null);
          setTimerRunning(false);
        }
        await fetchAllTimers();
      } else {
        console.error(`Failed to delete timer: ${response.status} - ${response.data}`);
      }
    } catch (error) {
      console.error(`HTTP Error: ${error.message}`);
    }
  }

  async function toggleMessage() {
    if (!connected) return console.error("Not connected yet!");
    try {
      const url = `https://api.stagetimer.io/v1/show_or_hide_message?room_id=55T3E3HN&api_key=087a607d0b6b88601123f9ccdba3a898`;
      const response = await axios.get(url);
      if (response.status === 200) {
        setIsMessageOn(prev => !prev);
      } else {
        console.error(`Failed to toggle message: ${response.status} - ${response.data}`);
      }
    } catch (error) {
      console.error(`HTTP Error: ${error.message}`);
    }
  }

  async function toggleBlackout() {
    if (!connected) return console.error("Not connected yet!");
    try {
      const url = `https://api.stagetimer.io/v1/toggle_blackout?room_id=55T3E3HN&api_key=087a607d0b6b88601123f9ccdba3a898`;
      const response = await axios.get(url);
      if (response.status === 200) {
        setIsBlackoutOn(prev => !prev);
      } else {
        console.error(`Failed to toggle blackout: ${response.status} - ${response.data}`);
      }
    } catch (error) {
      console.error(`HTTP Error: ${error.message}`);
    }
  }

  return (
    <div className="App">
      <div className="main-container">
        <div className="timer-sections">
          <div className="current-timer-section">
            <motion.button
              onClick={() => setShowCurrentTimer(!showCurrentTimer)}
              className={showCurrentTimer ? 'hide-button' : 'show-button'}
              whileHover={{ scale: 1.05, boxShadow: '0 0 15px #00e5ff' }}
              whileTap={{ scale: 0.95 }}
              animate={{ boxShadow: '0 0 10px #00e5ff' }}
              transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
            >
              {showCurrentTimer ? 'HIDE CURRENT TIMER' : 'SHOW CURRENT TIMER'}
            </motion.button>
            {showCurrentTimer && (
              <div className="timer-section-content">
                <h2 className={timerRunning ? 'playing' : 'stopped'}>Current Timer</h2>
                {currentTimer ? (
                  <>
                    <div className="timer-info">Name: {currentTimer.name || 'N/A'}</div>
                    <div className="timer-info">Speaker: {currentTimer.speaker || 'N/A'}</div>
                    <div className="timer-info">Notes: {currentTimer.notes || 'N/A'}</div>
                  </>
                ) : (
                  <div className="timer-info">No active timer</div>
                )}
              </div>
            )}
          </div>
          <div className="center-content">
            <h1>{roomName}</h1>
            <iframe
              src="https://stagetimer.io/r/55T3E3HN/"
              title="StageTimer Viewer"
              className="timer-iframe"
            />
            <div className="status">{status}</div>
            
            {!spotifyToken ? (
              <motion.button
                onClick={handleSpotifyLogin}
                className="spotify-login-button"
                whileHover={{ scale: 1.05, boxShadow: '0 0 15px #1DB954' }}
                whileTap={{ scale: 0.95 }}
              >
                Login with Spotify
              </motion.button>
            ) : (
              <div className="spotify-status">✅ Spotify Connected</div>
            )}

            <div className="button-container">
              <motion.button
                onClick={() => sendCommand('start_or_stop')}
                className={timerRunning ? 'stop-button' : 'start-button'}
                whileHover={{ scale: 1.05, boxShadow: '0 0 15px #b300ff' }}
                whileTap={{ scale: 0.95 }}
                animate={{
                  boxShadow: timerRunning
                    ? '0 0 10px #d50000'
                    : '0 0 10px #00c853',
                }}
                transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
              >
                {timerRunning ? 'STOP' : 'START'}
              </motion.button>
              <div className="button-row">
                <motion.button
                  onClick={() => sendCommand('previous')}
                  className="prev-button"
                  whileHover={{ scale: 1.05, boxShadow: '0 0 15px #00e5ff' }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ boxShadow: '0 0 10px #ffd600' }}
                  transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                >
                  PREV
                </motion.button>
                <motion.button
                  onClick={() => sendCommand('next')}
                  className="next-button"
                  whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff4081' }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ boxShadow: '0 0 10px #2962ff' }}
                  transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                >
                  NEXT
                </motion.button>
              </div>
              <div className="button-row">
                <motion.button
                  onClick={toggleMessage}
                  className={`toggle-message-button ${isMessageOn ? 'on' : 'off'}`}
                  whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff9100' }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ boxShadow: '0 0 10px #ff9100' }}
                  transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                >
                  TOGGLE MESSAGE
                </motion.button>
                <motion.button
                  onClick={toggleBlackout}
                  className={`toggle-blackout-button ${isBlackoutOn ? 'on' : 'off'}`}
                  whileHover={{ scale: 1.05, boxShadow: '0 0 15px #aa00ff' }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ boxShadow: '0 0 10px #aa00ff' }}
                  transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                >
                  TOGGLE BLACKOUT
                </motion.button>
              </div>
              <div className="button-row">
                <motion.button
                  onClick={() => setIsDeleteTimersExpanded(prev => !prev)}
                  className="delete-timers-button"
                  whileHover={{ scale: 1.05, boxShadow: '0 0 15px #d50000' }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ boxShadow: '0 0 10px #d50000' }}
                  transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                >
                  DELETE TIMERS
                </motion.button>
                {isDeleteTimersExpanded && (
                  <div className="sub-menu">
                    {allTimers.length > 0 ? (
                      allTimers.map((timer) => (
                        <motion.button
                          key={timer._id}
                          onClick={() => deleteTimer(timer._id)}
                          className="sub-menu-button delete-timer-button"
                          whileHover={{ scale: 1.05, boxShadow: '0 0 15px #d50000' }}
                          whileTap={{ scale: 0.95 }}
                          animate={{ boxShadow: '0 0 5px #d50000' }}
                          transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                        >
                          {timer.name || 'Unnamed Timer'}
                        </motion.button>
                      ))
                    ) : (
                      <div className="sub-menu-button">No timers to delete</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="all-timers-section">
            <motion.button
              onClick={() => setShowAllTimers(!showAllTimers)}
              className={showAllTimers ? 'hide-button' : 'show-button'}
              whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff4081' }}
              whileTap={{ scale: 0.95 }}
              animate={{ boxShadow: '0 0 10px #ff4081' }}
              transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
            >
              {showAllTimers ? 'HIDE ALL TIMERS' : 'SHOW ALL TIMERS'}
            </motion.button>
            {showAllTimers && (
              <div className="timer-section-content all-timers-content">
                <h2 className={timerRunning ? 'playing' : 'stopped'}>All Timers</h2>
                {allTimers.length > 0 ? (
                  allTimers.map((timer) => (
                    <div
                      key={timer._id}
                      className={`timer-info ${
                        timer._id === activeTimerId
                          ? timerRunning
                            ? 'active-playing'
                            : 'active-stopped'
                          : ''
                      }`}
                      onClick={() => selectTimer(timer._id)}
                      style={{ cursor: 'pointer' }}
                    >
                      {timer.name || 'Unnamed Timer'}
                    </div>
                  ))
                ) : (
                  <div className="timer-info">No timers found</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;