import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

function Popup() {
  const [enabled, setEnabled] = useState(true);
  const [sensitivity, setSensitivity] = useState('medium');

  useEffect(() => {
    // Load settings from storage
    chrome.storage.sync.get(['enabled', 'sensitivity'], (result) => {
      if (result.enabled !== undefined) {
        setEnabled(result.enabled);
      }
      if (result.sensitivity) {
        setSensitivity(result.sensitivity);
      }
    });
  }, []);

  const handleToggle = () => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    chrome.storage.sync.set({ enabled: newEnabled });
  };

  const handleSensitivityChange = (value) => {
    setSensitivity(value);
    chrome.storage.sync.set({ sensitivity: value });
  };

  return (
    <div className="w-80 bg-gray-900 text-white">
      <div className="p-6">
        <div className="flex items-center mb-6">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
            <span className="text-xl">🛡️</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">Manipulation Radar</h1>
            <p className="text-xs text-gray-400">AI Trust Monitor</p>
          </div>
        </div>

        {/* Enable/Disable Toggle */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-300">
              Extension Status
            </label>
            <button
              onClick={handleToggle}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                enabled ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              <motion.div
                className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                animate={{ x: enabled ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500">
            {enabled
              ? 'Monitoring active on ChatGPT and Claude'
              : 'Extension is disabled'}
          </p>
        </div>

        {/* Sensitivity Setting */}
        <div className="mb-6">
          <label className="text-sm font-semibold text-gray-300 mb-3 block">
            Detection Sensitivity
          </label>
          <div className="space-y-2">
            {['low', 'medium', 'high'].map((level) => (
              <button
                key={level}
                onClick={() => handleSensitivityChange(level)}
                className={`w-full p-3 rounded-lg text-left transition-colors ${
                  sensitivity === level
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="capitalize font-medium">{level}</span>
                  {sensitivity === level && (
                    <motion.svg
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </motion.svg>
                  )}
                </div>
                <p className="text-xs mt-1 opacity-75">
                  {level === 'low' && 'Fewer false positives'}
                  {level === 'medium' && 'Balanced detection'}
                  {level === 'high' && 'Maximum detection'}
                </p>
              </button>
            ))}
          </div>
        </div>


        {/* Info Section */}
        <div className="pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-400 leading-relaxed">
            Manipulation Radar analyzes AI responses for patterns of sycophancy,
            flattery, persuasion, and emotional manipulation. The trust score
            ranges from 0-100, with higher scores indicating more trustworthy
            responses.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Popup;
