import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getScoreColor, getScoreBgColor, getSeverityColor } from '../lib/scorer.js';
import '../styles.css';

function Sidebar({ trustScore = 100, recentFlags = [], messageHistory = [] }) {
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('manipulationRadarExpanded');
    return saved !== null ? JSON.parse(saved) : true; // Default to true (expanded)
  });
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

      {/* Trust Score Display */}
      <div className={`p-6 ${getScoreBgColor(trustScore)} border-b border-gray-700`}>
        <div className="text-sm text-gray-400 mb-2">Trust Score</div>
        <motion.div
          key={trustScore}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className={`text-6xl font-bold ${getScoreColor(trustScore)}`}
        >
          {trustScore}
        </motion.div>
        <div className="text-xs text-gray-400 mt-2">
          {trustScore >= 90 && '✓ Highly Trustworthy'}
          {trustScore >= 70 && trustScore < 90 && '⚠ Moderately Trustworthy'}
          {trustScore >= 50 && trustScore < 70 && '⚠ Low Trust'}
          {trustScore < 50 && '✗ High Risk'}
        </div>
      </div>

      {/* Recent Flags */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="text-sm font-semibold text-gray-300 mb-3">
          Recent Flags ({recentFlags.length})
        </div>
        
        {recentFlags.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">
            No manipulation detected
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {recentFlags.map((flag, index) => (
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
                  <div className="text-xs text-gray-400 mb-1">Total Messages Analyzed</div>
                  <div className="text-sm text-white font-semibold">
                    {messageHistory.length}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-400 mb-1">Flags Detected</div>
                  <div className="text-sm text-white font-semibold">
                    {recentFlags.length}
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
          className="pointer-events-auto fixed w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-l-lg shadow-lg hover:shadow-xl flex items-center justify-center transition-colors duration-200 z-[999999] select-none"
          aria-label="Open Manipulation Radar"
        >
          <span className={`text-xl font-bold ${getScoreColor(trustScore)} pointer-events-none`}>
            {trustScore}
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default Sidebar;
