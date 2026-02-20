import React, { useState, useEffect, useRef } from 'react';
import Layout from '@/components/Layout';
import { ConversationLog, IntentType, ActionType } from '@/types';
import { Send, Download, Filter, Clock, AlertCircle, CheckCircle, XCircle, ArrowRight } from 'lucide-react';
import axios from 'axios';

export default function ConsolePage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [agentId, setAgentId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [filterIntent, setFilterIntent] = useState<string>('');
  const [filterAction, setFilterAction] = useState<string>('');
  const [filterFailed, setFilterFailed] = useState(false);
  const [sessionId] = useState(`session-${Date.now()}`);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (agentId) {
      loadLogs();
    }
  }, [agentId, filterIntent, filterAction, filterFailed]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadAgents = async () => {
    try {
      const response = await axios.get('/api/agents');
      setAgents(response.data.agents);
      if (response.data.agents.length > 0 && !agentId) {
        setAgentId(response.data.agents[0].agentId);
      }
    } catch (error) {
      console.error('Failed to load agents:', error);
    }
  };

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams();
      if (agentId) params.append('agentId', agentId);
      if (filterIntent) params.append('intent', filterIntent);
      if (filterAction) params.append('action', filterAction);
      if (filterFailed) params.append('failed', 'true');

      const response = await axios.get(`/api/logs?${params.toString()}`);
      setLogs(response.data.logs);
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !agentId || loading) return;

    const userMessage = message;
    setMessage('');
    setLoading(true);

    // Add user message to chat
    const newUserMsg = {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, newUserMsg]);

    try {
      const response = await axios.post('/api/run', {
        agentId,
        message: userMessage,
        sessionId,
      });

      // Add agent response to chat
      const agentMsg = {
        role: 'agent',
        content: response.data.answer,
        data: response.data,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, agentMsg]);

      // Reload logs
      await loadLogs();
    } catch (error: any) {
      console.error('Failed to send message:', error);
      const errorMsg = {
        role: 'error',
        content: error.response?.data?.error || 'Failed to get response',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleExportAgent = async () => {
    try {
      const response = await axios.get(`/api/export?agentId=${agentId}`);
      const dataStr = JSON.stringify(response.data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `agent-${agentId}-export.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export agent configuration');
    }
  };

  const getIntentBadgeColor = (intent: IntentType) => {
    const colors: Record<string, string> = {
      order_status: 'bg-blue-100 text-blue-800',
      create_ticket: 'bg-purple-100 text-purple-800',
      general_query: 'bg-gray-100 text-gray-800',
      greeting: 'bg-green-100 text-green-800',
      complaint: 'bg-red-100 text-red-800',
      abusive: 'bg-red-200 text-red-900',
      unknown: 'bg-yellow-100 text-yellow-800',
    };
    return colors[intent] || 'bg-gray-100 text-gray-800';
  };

  const getActionIcon = (action: ActionType) => {
    switch (action) {
      case 'answer':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'tool_call':
        return <ArrowRight className="w-4 h-4 text-blue-600" />;
      case 'escalate':
        return <AlertCircle className="w-4 h-4 text-amber-600" />;
    }
  };

  return (
    <Layout>
      <div className="animate-slide-in">
        <div className="mb-6">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Test Console</h1>
          <p className="text-slate-600">Test your agent and view execution logs</p>
        </div>

        {/* Agent Selector */}
        <div className="card mb-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Select Agent
              </label>
              <select
                value={agentId}
                onChange={(e) => {
                  setAgentId(e.target.value);
                  setMessages([]);
                }}
                className="input-field"
              >
                {agents.map(agent => (
                  <option key={agent.agentId} value={agent.agentId}>
                    {agent.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleExportAgent}
              disabled={!agentId}
              className="btn-secondary flex items-center gap-2 mt-6"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Interface - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Chat Messages */}
            <div className="card h-[500px] flex flex-col">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 pb-4 border-b">
                Chat Interface
              </h2>

              <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p>Send a message to start testing your agent</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => (
                    <div key={idx}>
                      {msg.role === 'user' ? (
                        <div className="flex justify-end">
                          <div className="bg-blue-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
                            {msg.content}
                          </div>
                        </div>
                      ) : msg.role === 'error' ? (
                        <div className="flex justify-start">
                          <div className="bg-red-100 text-red-800 rounded-lg px-4 py-2 max-w-[80%] border border-red-200">
                            <XCircle className="w-4 h-4 inline mr-2" />
                            {msg.content}
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-start">
                          <div className="bg-slate-100 text-slate-900 rounded-lg px-4 py-2 max-w-[80%]">
                            {msg.content}
                          </div>
                        </div>
                      )}

                      {/* Response Card */}
                      {msg.role === 'agent' && msg.data && (
                        <div className="mt-3 ml-4 border-l-4 border-blue-500 pl-4">
                          <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-600">Intent:</span>
                                <span className={`badge ${getIntentBadgeColor(msg.data.intent)}`}>
                                  {msg.data.intent}
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-600">Confidence:</span>
                                <span className="font-bold text-blue-600">
                                  {(msg.data.confidence * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-600">Action:</span>
                              {getActionIcon(msg.data.action)}
                              <span className="badge badge-info">{msg.data.action}</span>
                            </div>

                            {msg.data.toolExecution && (
                              <div className="bg-slate-50 rounded p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs font-semibold text-slate-700">Tool Call:</span>
                                  <span className={`badge ${msg.data.toolExecution.success ? 'badge-success' : 'badge-error'}`}>
                                    {msg.data.toolExecution.success ? 'Success' : 'Failed'}
                                  </span>
                                </div>
                                <p className="text-xs font-mono text-slate-700 mb-1">
                                  {msg.data.toolExecution.toolName}(
                                  {JSON.stringify(msg.data.toolExecution.arguments)})
                                </p>
                                {msg.data.toolExecution.error && (
                                  <p className="text-xs text-red-600 mt-1">
                                    Error: {msg.data.toolExecution.error}
                                  </p>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-4 text-xs text-slate-600">
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Intent: {msg.data.timing.intentClassification}ms</span>
                              </div>
                              {msg.data.timing.toolExecution && (
                                <div className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  <span>Tool: {msg.data.timing.toolExecution}ms</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <span>Total: {msg.data.timing.total}ms</span>
                              </div>
                            </div>

                            {msg.data.hallucinationBlocked && (
                              <div className="bg-amber-50 border border-amber-200 rounded p-2">
                                <p className="text-xs text-amber-800 font-medium">
                                  ⚠️ Hallucination guard triggered
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type your message..."
                  className="input-field flex-1"
                  disabled={!agentId || loading}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!agentId || loading || !message.trim()}
                  className="btn-primary flex items-center gap-2"
                >
                  {loading ? (
                    <div className="spinner" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Logs Panel - 1 column */}
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Filter className="w-5 h-5" />
                Log Filters
              </h2>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Intent
                  </label>
                  <select
                    value={filterIntent}
                    onChange={(e) => setFilterIntent(e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="">All Intents</option>
                    <option value="order_status">Order Status</option>
                    <option value="create_ticket">Create Ticket</option>
                    <option value="general_query">General Query</option>
                    <option value="greeting">Greeting</option>
                    <option value="complaint">Complaint</option>
                    <option value="unknown">Unknown</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Action
                  </label>
                  <select
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    className="input-field text-sm"
                  >
                    <option value="">All Actions</option>
                    <option value="answer">Answer</option>
                    <option value="tool_call">Tool Call</option>
                    <option value="escalate">Escalate</option>
                  </select>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterFailed}
                    onChange={(e) => setFilterFailed(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-slate-700">Failed Tools Only</span>
                </label>

                <button
                  onClick={() => {
                    setFilterIntent('');
                    setFilterAction('');
                    setFilterFailed(false);
                  }}
                  className="btn-secondary w-full text-sm py-2"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Logs List */}
            <div className="card">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">
                Recent Logs ({logs.length})
              </h2>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {logs.length === 0 ? (
                  <p className="text-center text-slate-500 text-sm py-4">
                    No logs found
                  </p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log._id?.toString()}
                      className="border border-slate-200 rounded p-3 text-xs bg-white hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`badge text-xs ${getIntentBadgeColor(log.response.intent)}`}>
                          {log.response.intent}
                        </span>
                        <span className="text-slate-500">
                          {log.response.timing.total}ms
                        </span>
                      </div>
                      <p className="text-slate-700 mb-1 font-medium truncate">
                        {log.message}
                      </p>
                      <div className="flex items-center gap-2">
                        {getActionIcon(log.response.action)}
                        <span className="text-slate-600">{log.response.action}</span>
                        {log.response.toolExecution && (
                          <span className={`badge text-xs ${
                            log.response.toolExecution.success 
                              ? 'badge-success' 
                              : 'badge-error'
                          }`}>
                            {log.response.toolExecution.toolName}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
