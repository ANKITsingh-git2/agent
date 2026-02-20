import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { AgentConfig, LanguageMode, SafetyMode } from '@/types';
import { Save, Sparkles, Globe, Shield } from 'lucide-react';
import axios from 'axios';

export default function AgentBuilderPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    persona: '',
    languageMode: 'english' as LanguageMode,
    safetyMode: 'balanced' as SafetyMode,
    confidenceThreshold: 0.7,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    try {
      const response = await axios.get('/api/agents');
      setAgents(response.data.agents);
      
      if (response.data.agents.length > 0 && !selectedAgent) {
        const agent = response.data.agents[0];
        setSelectedAgent(agent.agentId);
        setFormData({
          name: agent.name,
          persona: agent.persona,
          languageMode: agent.languageMode,
          safetyMode: agent.safetyMode,
          confidenceThreshold: agent.confidenceThreshold,
        });
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Agent name is required';
    }

    if (!formData.persona.trim()) {
      newErrors.persona = 'Persona/system prompt is required';
    } else if (formData.persona.trim().length < 20) {
      newErrors.persona = 'Persona should be at least 20 characters';
    }

    if (formData.confidenceThreshold < 0.5 || formData.confidenceThreshold > 0.9) {
      newErrors.confidenceThreshold = 'Threshold must be between 0.50 and 0.90';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setLoading(true);
    setSaved(false);

    try {
      if (selectedAgent) {
        // Update existing agent
        await axios.put('/api/agents', {
          agentId: selectedAgent,
          ...formData,
        });
      } else {
        // Create new agent
        const response = await axios.post('/api/agents', formData);
        setSelectedAgent(response.data.agent.agentId);
      }

      setSaved(true);
      await loadAgents();
      
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      console.error('Save error:', error);
      setErrors({ submit: error.response?.data?.error || 'Failed to save agent' });
    } finally {
      setLoading(false);
    }
  };

  const handleNewAgent = () => {
    setSelectedAgent(null);
    setFormData({
      name: '',
      persona: '',
      languageMode: 'english',
      safetyMode: 'balanced',
      confidenceThreshold: 0.7,
    });
    setErrors({});
  };

  return (
    <Layout>
      <div className="animate-slide-in">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Agent Builder</h1>
            <p className="text-slate-600">Configure your AI agent's personality and safety settings</p>
          </div>
          <button
            onClick={handleNewAgent}
            className="btn-secondary flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            New Agent
          </button>
        </div>

        {/* Agent Selector */}
        {agents.length > 0 && (
          <div className="card mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Existing Agent
            </label>
            <select
              value={selectedAgent || ''}
              onChange={(e) => {
                const agent = agents.find(a => a.agentId === e.target.value);
                if (agent) {
                  setSelectedAgent(agent.agentId);
                  setFormData({
                    name: agent.name,
                    persona: agent.persona,
                    languageMode: agent.languageMode,
                    safetyMode: agent.safetyMode,
                    confidenceThreshold: agent.confidenceThreshold,
                  });
                }
              }}
              className="input-field"
            >
              <option value="">-- Create New --</option>
              {agents.map(agent => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Configuration Form */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Basic Information</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Agent Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className={`input-field ${errors.name ? 'border-red-500' : ''}`}
                  placeholder="e.g., Customer Support Agent"
                />
                {errors.name && (
                  <p className="text-red-600 text-sm mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Persona / System Prompt *
                </label>
                <textarea
                  value={formData.persona}
                  onChange={(e) => setFormData({ ...formData, persona: e.target.value })}
                  className={`input-field ${errors.persona ? 'border-red-500' : ''}`}
                  rows={6}
                  placeholder="You are a helpful customer support agent. Your goal is to assist customers with their queries in a friendly and professional manner..."
                />
                {errors.persona && (
                  <p className="text-red-600 text-sm mt-1">{errors.persona}</p>
                )}
                <p className="text-slate-500 text-xs mt-1">
                  Define how your agent should behave and respond
                </p>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Globe className="w-5 h-5 text-blue-600" />
                Language Mode
              </h2>
              
              <div className="space-y-3">
                <label className="flex items-center p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="languageMode"
                    value="english"
                    checked={formData.languageMode === 'english'}
                    onChange={(e) => setFormData({ ...formData, languageMode: e.target.value as LanguageMode })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-slate-900">English</div>
                    <div className="text-sm text-slate-600">Pure English responses</div>
                  </div>
                </label>

                <label className="flex items-center p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="languageMode"
                    value="hinglish"
                    checked={formData.languageMode === 'hinglish'}
                    onChange={(e) => setFormData({ ...formData, languageMode: e.target.value as LanguageMode })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-slate-900">Hinglish</div>
                    <div className="text-sm text-slate-600">Mix of Hindi and English</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                Safety Mode
              </h2>
              
              <div className="space-y-3">
                <label className="flex items-center p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="safetyMode"
                    value="strict"
                    checked={formData.safetyMode === 'strict'}
                    onChange={(e) => setFormData({ ...formData, safetyMode: e.target.value as SafetyMode })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-slate-900">Strict Mode</div>
                    <div className="text-sm text-slate-600">Only answer from FAQ or tool output</div>
                  </div>
                </label>

                <label className="flex items-center p-4 border-2 border-slate-200 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                  <input
                    type="radio"
                    name="safetyMode"
                    value="balanced"
                    checked={formData.safetyMode === 'balanced'}
                    onChange={(e) => setFormData({ ...formData, safetyMode: e.target.value as SafetyMode })}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-slate-900">Balanced Mode</div>
                    <div className="text-sm text-slate-600">May generate responses with source citation</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-slate-900 mb-4">Confidence Threshold</h2>
              
              <div className="mb-4">
                <input
                  type="range"
                  min="0.5"
                  max="0.9"
                  step="0.05"
                  value={formData.confidenceThreshold}
                  onChange={(e) => setFormData({ ...formData, confidenceThreshold: parseFloat(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-slate-600 mt-2">
                  <span>0.50</span>
                  <span className="font-bold text-blue-600 text-lg">
                    {formData.confidenceThreshold.toFixed(2)}
                  </span>
                  <span>0.90</span>
                </div>
              </div>
              
              {errors.confidenceThreshold && (
                <p className="text-red-600 text-sm mt-1">{errors.confidenceThreshold}</p>
              )}
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                <p className="text-sm text-blue-800">
                  Higher threshold = More escalations to human agents
                  <br />
                  Lower threshold = More automated responses
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-8 flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={loading}
            className="btn-primary flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="spinner" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Configuration
              </>
            )}
          </button>

          {saved && (
            <div className="badge-success animate-slide-in">
              ✓ Configuration saved successfully
            </div>
          )}

          {errors.submit && (
            <div className="badge-error animate-slide-in">
              {errors.submit}
            </div>
          )}
        </div>

        {selectedAgent && (
          <div className="mt-6 card bg-slate-50">
            <p className="text-sm text-slate-600">
              <strong>Agent ID:</strong> <code className="bg-slate-200 px-2 py-1 rounded">{selectedAgent}</code>
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}
