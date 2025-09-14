import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import io from 'socket.io-client';
import axios from 'axios';
import './App.css';

const socket = io('https://api.stagetimer.io', {
  path: '/v1/socket.io',
  auth: {
    room_id: '55T3E3HN',
    api_key: '087a607d0b6b88601123f9ccdba3a898',
  },
});

function App() {
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
  const [isAddTimeExpanded, setIsAddTimeExpanded] = useState(false);
  const [isSubtractTimeExpanded, setIsSubtractTimeExpanded] = useState(false);
  const [isAddTimersExpanded, setIsAddTimersExpanded] = useState(false);
  const [isDeleteTimersExpanded, setIsDeleteTimersExpanded] = useState(false);

  async function fetchRoomDetails() {
    try {
      const url = `https://api.stagetimer.io/v1/get_room?room_id=55T3E3HN&api_key=087a607d0b6b88601123f9ccdba3a898`;
      const response = await axios.get(url);
      if (response.status === 200 && response.data.ok) {
        const roomData = response.data.data;
        setRoomName(roomData.name || 'StageTimer');
        const activeTimerId = roomData.active_timer;
        setActiveTimerId(activeTimerId);
        if (activeTimerId) {
          fetchCurrentTimer(activeTimerId);
        }
      } else {
        console.error(`Failed to fetch room: ${response.status} - ${response.data.message}`);
      }
    } catch (error) {
      console.error(`Error fetching room: ${error.message}`);
    }
  }

  async function fetchCurrentTimer(timerId) {
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
  }

  async function fetchAllTimers() {
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
  }

  async function selectTimer(timerId) {
    if (!connected) {
      console.error("Not connected yet!");
      return;
    }
    try {
      const index = allTimers.findIndex(timer => timer._id === timerId) + 1;
      if (index === 0) {
        console.error("Timer not found in the list!");
        return;
      }

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
  }, [activeTimerId]);

  async function sendCommand(endpoint) {
    if (!connected) {
      console.error("Not connected yet!");
      return;
    }
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

  async function addTime(amount) {
    if (!connected || !activeTimerId) {
      console.error("Not connected or no active timer!");
      return;
    }
    try {
      const url = `https://api.stagetimer.io/v1/add_time?room_id=55T3E3HN&amount=${amount}&api_key=087a607d0b6b88601123f9ccdba3a898`;
      const response = await axios.get(url);
      if (response.status === 200) {
        fetchAllTimers();
        setIsAddTimeExpanded(false);
      } else {
        console.error(`Failed to add time: ${response.status} - ${response.data}`);
      }
    } catch (error) {
      console.error(`HTTP Error: ${error.message}`);
    }
  }

  async function subtractTime(amount) {
    if (!connected || !activeTimerId) {
      console.error("Not connected or no active timer!");
      return;
    }
    try {
      const url = `https://api.stagetimer.io/v1/subtract_time?room_id=55T3E3HN&amount=${amount}&api_key=087a607d0b6b88601123f9ccdba3a898`;
      const response = await axios.get(url);
      if (response.status === 200) {
        fetchAllTimers();
        setIsSubtractTimeExpanded(false);
      } else {
        console.error(`Failed to subtract time: ${response.status} - ${response.data}`);
      }
    } catch (error) {
      console.error(`HTTP Error: ${error.message}`);
    }
  }

  async function createTimer(name, minutes, seconds) {
    if (!connected) {
      console.error("Not connected yet!");
      return;
    }
    try {
      const url = `https://api.stagetimer.io/v1/create_timer?room_id=55T3E3HN&api_key=087a607d0b6b88601123f9ccdba3a898&name=${encodeURIComponent(name)}&minutes=${minutes}&seconds=${seconds}&type=DURATION&appearance=COUNTDOWN&trigger=MANUAL`;
      const response = await axios.get(url);
      if (response.status === 200) {
        fetchAllTimers();
        setIsAddTimersExpanded(false);
      } else {
        console.error(`Failed to add timer: ${response.status} - ${response.data}`);
      }
    } catch (error) {
      console.error(`HTTP Error: ${error.message}`);
    }
  }

  async function deleteTimer(timerId) {
    if (!connected) {
      console.error("Not connected yet!");
      return;
    }
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
    if (!connected) {
      console.error("Not connected yet!");
      return;
    }
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
    if (!connected) {
      console.error("Not connected yet!");
      return;
    }
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
                  onClick={() => setIsAddTimeExpanded(prev => !prev)}
                  className="add-time-button"
                  whileHover={{ scale: 1.05, boxShadow: '0 0 15px #00c853' }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ boxShadow: '0 0 10px #00c853' }}
                  transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                >
                  ADD TIME
                </motion.button>
                {isAddTimeExpanded && (
                  <div className="sub-menu">
                    <motion.button
                      onClick={() => addTime('30s')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #00c853' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #00c853' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      30 Seconds
                    </motion.button>
                    <motion.button
                      onClick={() => addTime('1m')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #00c853' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #00c853' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      1 Minute
                    </motion.button>
                    <motion.button
                      onClick={() => addTime('2m')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #00c853' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #00c853' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      2 Minutes
                    </motion.button>
                    <motion.button
                      onClick={() => addTime('5m')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #00c853' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #00c853' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      5 Minutes
                    </motion.button>
                    <motion.button
                      onClick={() => addTime('10m')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #00c853' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #00c853' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      10 Minutes
                    </motion.button>
                    <motion.button
                      onClick={() => addTime('30m')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #00c853' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #00c853' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      30 Minutes
                    </motion.button>
                  </div>
                )}
                <motion.button
                  onClick={() => setIsSubtractTimeExpanded(prev => !prev)}
                  className="subtract-time-button"
                  whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff4081' }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ boxShadow: '0 0 10px #ff4081' }}
                  transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                >
                  SUBTRACT TIME
                </motion.button>
                {isSubtractTimeExpanded && (
                  <div className="sub-menu">
                    <motion.button
                      onClick={() => subtractTime('30s')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff4081' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff4081' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      30 Seconds
                    </motion.button>
                    <motion.button
                      onClick={() => subtractTime('1m')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff4081' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff4081' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      1 Minute
                    </motion.button>
                    <motion.button
                      onClick={() => subtractTime('2m')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff4081' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff4081' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      2 Minutes
                    </motion.button>
                    <motion.button
                      onClick={() => subtractTime('5m')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff4081' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff4081' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      5 Minutes
                    </motion.button>
                    <motion.button
                      onClick={() => subtractTime('10m')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff4081' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff4081' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      10 Minutes
                    </motion.button>
                    <motion.button
                      onClick={() => subtractTime('30m')}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff4081' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff4081' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      30 Minutes
                    </motion.button>
                  </div>
                )}
              </div>
              <div className="button-row">
                <motion.button
                  onClick={() => setIsAddTimersExpanded(prev => !prev)}
                  className="add-timers-button"
                  whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff9100' }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ boxShadow: '0 0 10px #ff9100' }}
                  transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                >
                  ADD TIMERS
                </motion.button>
                {isAddTimersExpanded && (
                  <div className="sub-menu">
                    <motion.button
                      onClick={() => createTimer('30 Seconds', 0, 30)}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff9100' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff9100' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      30 Seconds
                    </motion.button>
                    <motion.button
                      onClick={() => createTimer('1 Minute', 1, 0)}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff9100' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff9100' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      1 Minute
                    </motion.button>
                    <motion.button
                      onClick={() => createTimer('2 Minutes', 2, 0)}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff9100' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff9100' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      2 Minutes
                    </motion.button>
                    <motion.button
                      onClick={() => createTimer('5 Minutes', 5, 0)}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff9100' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff9100' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      5 Minutes
                    </motion.button>
                    <motion.button
                      onClick={() => createTimer('10 Minutes', 10, 0)}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff9100' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff9100' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      10 Minutes
                    </motion.button>
                    <motion.button
                      onClick={() => createTimer('30 Minutes', 30, 0)}
                      className="sub-menu-button"
                      whileHover={{ scale: 1.05, boxShadow: '0 0 15px #ff9100' }}
                      whileTap={{ scale: 0.95 }}
                      animate={{ boxShadow: '0 0 5px #ff9100' }}
                      transition={{ boxShadow: { repeat: Infinity, duration: 1, repeatType: 'reverse' } }}
                    >
                      30 Minutes
                    </motion.button>
                  </div>
                )}
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