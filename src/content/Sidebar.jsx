import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getScoreColor, getScoreBgColor, getSeverityColor } from '../lib/scorer.js';
import '../styles.css';

function Sidebar({ trustScore = 100, recentFlags = [], messageHistory = [], selectedMessage = null, onBackToOverview = null, lockState = { isActive: false, ownerTabId: null, ownerUrl: null, since: null }, onTakeover = null, verificationHistory = [] }) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('manipulationRadarExpanded');
    return saved !== null ? JSON.parse(saved) : true; // Default to true (expanded)
  });

  // Auto-expand sidebar when message is selected
  useEffect(() => {
    if (selectedMessage && !isExpanded) {
      setIsExpanded(true);
    }
  }, [selectedMessage, isExpanded]);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [iconPosition, setIconPosition] = useState(() => {
    const saved = localStorage.getItem('manipulationRadarIconPosition');
    return saved !== null ? parseFloat(saved) : 50; // Default to 50% from top (middle of screen)
  });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    localStorage.setItem('manipulationRadarExpanded', JSON.stringify(isExpanded));
  }, [isExpanded]);

  useEffect(() => {
    localStorage.setItem('manipulationRadarIconPosition', iconPosition.toString());
  }, [iconPosition]);

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  const dragStartYRef = useRef(0);
  const dragStartPositionRef = useRef(0);

  const handleMouseDown = useCallback((e) => {
    if (isExpanded) return;
    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    dragStartPositionRef.current = iconPosition;
    e.preventDefault();
  }, [isExpanded, iconPosition]);

  const handleMouseMove = useCallback((e) => {
    if (!isDragging || isExpanded) return;
    const deltaY = e.clientY - dragStartYRef.current;
    const windowHeight = window.innerHeight;
    const iconHeight = 48; // 12 * 4 = 48px (w-12 h-12)
    const maxPosition = ((windowHeight - iconHeight) / windowHeight) * 100;
    const newPosition = Math.max(0, Math.min(maxPosition, dragStartPositionRef.current + (deltaY / windowHeight) * 100));
    setIconPosition(newPosition);
  }, [isDragging, isExpanded]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Locked Mode View Component
  const LockedModeView = () => {
    if (lockState.isActive) return null;

    const formatSince = (timestamp) => {
      if (!timestamp) return 'Unknown';
      const date = new Date(timestamp);
      const now = Date.now();
      const diff = now - timestamp;
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return 'Just now';
      if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
      return date.toLocaleString();
    };

    return (
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Manipulation Radar</h2>
            <p className="text-xs text-gray-400">AI Trust Score Monitor</p>
          </div>
          <button
            onClick={toggleExpanded}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 transition-colors p-1"
            aria-label="Close sidebar"
          >
            <svg
              className="w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Locked Mode Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800/50 backdrop-blur-sm border border-gray-700 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Locked Mode</h3>
            <p className="text-sm text-gray-400 mb-4">
              Manipulation Radar is active in another tab
            </p>
          </div>

          <div className="w-full space-y-3 mb-6">
            {lockState.ownerUrl && (
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Active in:</div>
                <div className="text-sm text-gray-300 break-all">{lockState.ownerUrl}</div>
              </div>
            )}

            {lockState.since && (
              <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-3">
                <div className="text-xs text-gray-400 mb-1">Since:</div>
                <div className="text-sm text-gray-300">{formatSince(lockState.since)}</div>
              </div>
            )}
          </div>

          {onTakeover && (
            <button
              onClick={onTakeover}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors backdrop-blur-sm border border-blue-500/30"
            >
              Take Over
            </button>
          )}
        </div>
      </div>
    );
  };

  // Message Detail View Component
  const MessageDetailView = () => {
    if (!selectedMessage) return null;

    return (
      <div className="flex flex-col h-full">
        {/* Header with Back Button */}
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Message Analysis</h2>
            <p className="text-xs text-gray-400">Detailed breakdown</p>
          </div>
          {onBackToOverview && (
            <button
              onClick={onBackToOverview}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              ← Back
            </button>
          )}
        </div>

        {/* Message Text */}
        <div className="p-4 border-b border-gray-700 max-h-32 overflow-y-auto">
          <div className="text-xs text-gray-400 mb-2">Message Text</div>
          <div className="text-sm text-gray-300 whitespace-pre-wrap break-words">
            {selectedMessage.text}
          </div>
        </div>

        {/* Verification Status */}
        <div className="p-6 bg-gray-800/50 border-b border-gray-700">
          <div className="text-sm text-gray-400 mb-2">Verification Status</div>
          {selectedMessage.score !== undefined ? (
            <>
              <motion.div
                key={selectedMessage.score}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3 }}
                className={`text-6xl font-bold ${getScoreColor(selectedMessage.score)}`}
              >
                {selectedMessage.score}
              </motion.div>
              <div className="text-xs text-gray-400 mt-2">
                {selectedMessage.score >= 90 && '✓ Highly Trustworthy'}
                {selectedMessage.score >= 70 && selectedMessage.score < 90 && '⚠ Moderately Trustworthy'}
                {selectedMessage.score >= 50 && selectedMessage.score < 70 && '⚠ Low Trust'}
                {selectedMessage.score < 50 && '✗ High Risk'}
              </div>
            </>
          ) : (
            <>
              <div className="text-4xl font-bold text-gray-500 mb-2">N/A</div>
              <div className="text-xs text-gray-400 mt-2">
                Not verified yet
              </div>
            </>
          )}
          {selectedMessage.timestamp && (
            <div className="text-xs text-gray-500 mt-2">
              Message: {formatTime(selectedMessage.timestamp)}
            </div>
          )}
        </div>

        {/* Flags Breakdown */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="text-sm font-semibold text-gray-300 mb-3">
            Flags Detected ({selectedMessage.flags?.length || 0})
          </div>
          
          {!selectedMessage.flags || selectedMessage.flags.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-8">
              {selectedMessage.score === undefined 
                ? 'Click "🔍 Verify Response" to analyze this message'
                : 'No manipulation flags detected'}
            </div>
          ) : (
            <div className="space-y-3">
              {selectedMessage.flags.map((flag, index) => (
                <motion.div
                  key={`flag-${index}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                  className="bg-gray-800 rounded-lg p-4 border border-gray-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(flag.severity)}`}
                    >
                      {flag.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-400 font-semibold capitalize">
                      {flag.type}
                    </span>
                  </div>
                  <div className="text-sm text-gray-300 mb-2">
                    {flag.message}
                  </div>
                  {flag.matchedText && (
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <div className="text-xs text-gray-400 mb-1">Matched phrase:</div>
                      <div className="text-xs text-gray-200 bg-gray-900/50 px-2 py-1 rounded font-mono">
                        "{flag.matchedText}"
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Overview View Component (existing view)
  const OverviewView = () => (
    <>
      {/* Verification Status - Updated for On-Demand Verification */}
      <div className="p-6 bg-gray-800/50 border-b border-gray-700">
        <div className="text-sm text-gray-400 mb-2">Verification Status</div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
          <div className="text-lg font-semibold text-green-400">Online</div>
        </div>
        <div className="text-xs text-gray-400 mt-2">
          Click "🔍 Verify Response" on any AI message to analyze
        </div>
      </div>

      {/* Verification History */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-sm font-semibold text-gray-300 mb-3">
          Verification History
        </div>
        
        {verificationHistory.length === 0 && recentFlags.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">
            <div className="mb-2">No verifications yet.</div>
            <div className="text-xs">Click "🔍 Verify Response" on any AI message to start.</div>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {/* Show verification history entries */}
              {verificationHistory.map((verification, index) => (
                <motion.div
                  key={`verification-${verification.messageId}-${index}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="bg-gray-800 rounded-lg p-3 border border-gray-700 cursor-pointer hover:bg-gray-750 transition-colors"
                  onClick={() => {
                    // Could open message detail view here
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-lg font-bold ${verification.riskScore === 0 ? 'text-green-400' : verification.riskScore < 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {verification.riskScore}
                      </span>
                      <span className="text-xs text-gray-400">
                        Risk / {verification.reliabilityScore} Reliability
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {formatTime(verification.timestamp)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-300 mb-2 line-clamp-2">
                    {verification.messageText}
                  </div>
                  {verification.detections && verification.detections.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {verification.detections.slice(0, 3).map((det, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-300 capitalize"
                        >
                          {det.type}
                        </span>
                      ))}
                      {verification.detections.length > 3 && (
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-700 text-gray-400">
                          +{verification.detections.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  {verification.detections && verification.detections.length === 0 && (
                    <div className="text-xs text-green-400 mt-2">✓ No issues detected</div>
                  )}
                </motion.div>
              ))}
              
              {/* Show recent flags if no verification history yet */}
              {verificationHistory.length === 0 && recentFlags.map((flag, index) => (
                <motion.div
                  key={`${flag.timestamp}-${index}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="bg-gray-800 rounded-lg p-3 border border-gray-700"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium border ${getSeverityColor(flag.severity)}`}
                    >
                      {flag.severity.toUpperCase()}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(flag.timestamp)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 mb-1 font-semibold">
                    {flag.type.toUpperCase()}
                  </div>
                  <div className="text-sm text-gray-300">{flag.message}</div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Details Section */}
      <div className="border-t border-gray-700">
        <button
          onClick={() => setIsDetailsOpen(!isDetailsOpen)}
          className="w-full p-4 flex items-center justify-between hover:bg-gray-800 transition-colors"
        >
          <span className="text-sm font-semibold text-gray-300">Details</span>
          <motion.svg
            animate={{ rotate: isDetailsOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </motion.svg>
        </button>

        <AnimatePresence>
          {isDetailsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="p-4 space-y-3 bg-gray-800/50">
                <div>
                  <div className="text-xs text-gray-400 mb-1">Total Verifications</div>
                  <div className="text-sm text-white font-semibold">
                    {verificationHistory.length}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-400 mb-1">Total Flags Detected</div>
                  <div className="text-sm text-white font-semibold">
                    {recentFlags.filter(f => f.type !== 'none').length}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-400 mb-1">Messages Analyzed</div>
                  <div className="text-sm text-white font-semibold">
                    {messageHistory.length}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mb-2">Flag Types</div>
                  <div className="space-y-1">
                    {['sycophancy', 'flattery', 'persuasion', 'emotional', 'authority'].map(
                      (type) => {
                        const count = recentFlags.filter((f) => f.type === type).length;
                        if (count === 0) return null;
                        return (
                          <div
                            key={type}
                            className="flex justify-between text-xs text-gray-300"
                          >
                            <span className="capitalize">{type}:</span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );

  return (
    <AnimatePresence mode="wait">
      {isExpanded ? (
        <motion.div
          key="expanded"
          initial={{ x: 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 320, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="pointer-events-auto h-full w-full bg-gray-900 text-white overflow-hidden flex flex-col fixed top-0 right-0"
          style={{ width: '320px', height: '100vh' }}
        >
          {/* Conditional Rendering: Locked Mode, Message Detail, or Overview */}
          {!lockState.isActive ? (
            <LockedModeView />
          ) : selectedMessage ? (
            <MessageDetailView />
          ) : (
            <>
              {/* Header */}
              <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Manipulation Radar</h2>
                  <p className="text-xs text-gray-400">AI Trust Score Monitor</p>
                </div>
                <button
                  onClick={toggleExpanded}
                  className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-700 transition-colors p-1"
                  aria-label="Close sidebar"
                >
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <OverviewView />
            </>
          )}
        </motion.div>
      ) : (
        <motion.button
          key="collapsed"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => {
            if (!isDragging) {
              toggleExpanded();
            }
          }}
          onMouseDown={handleMouseDown}
          style={{
            top: `${iconPosition}%`,
            right: '0',
            transform: 'translateY(-50%)',
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          className={`pointer-events-auto fixed w-12 h-12 rounded-l-lg shadow-lg hover:shadow-xl flex items-center justify-center transition-colors duration-200 z-[999999] select-none ${
            lockState && !lockState.isActive
              ? 'bg-yellow-600 hover:bg-yellow-700'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
          aria-label={lockState && !lockState.isActive ? 'Manipulation Radar - Locked' : 'Open Manipulation Radar'}
        >
          {!lockState.isActive ? (
            <svg
              className="w-6 h-6 text-white pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 text-white pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default Sidebar;
