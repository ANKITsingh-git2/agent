import React, { useState, useEffect } from 'react';
import Layout from '@/components/Layout';
import { FAQ, ToolConfig } from '@/types';
import { Plus, Trash2, AlertCircle, CheckCircle, Wrench, HelpCircle } from 'lucide-react';
import axios from 'axios';

export default function ToolsPage() {
  const [agentId, setAgentId] = useState<string>('');
  const [agents, setAgents] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [tools, setTools] = useState<ToolConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string>('');
  const [toolSaving, setToolSaving] = useState(false);
  const [toolErrors, setToolErrors] = useState<Record<string, string>>({});
  const [toolSuccess, setToolSuccess] = useState<string>('');

  const [newFaq, setNewFaq] = useState({
    question: '',
    answer: '',
  });

  const [faqCount, setFaqCount] = useState(0);

  useEffect(() => {
    loadAgents();
  }, []);

  useEffect(() => {
    if (agentId) {
      loadFaqs();
      loadTools();
    }
  }, [agentId]);

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

  const loadFaqs = async () => {
    try {
      const response = await axios.get(`/api/faqs?agentId=${agentId}`);
      setFaqs(response.data.faqs);
      setFaqCount(response.data.faqs.length);
    } catch (error) {
      console.error('Failed to load FAQs:', error);
    }
  };

  const loadTools = async () => {
    try {
      const response = await axios.get(`/api/tools?agentId=${agentId}`);
      setTools(response.data.tools || []);
    } catch (error) {
      console.error('Failed to load tools:', error);
      setTools([]);
    }
  };

  const validateFaq = () => {
    const newErrors: Record<string, string> = {};

    if (!newFaq.question.trim()) {
      newErrors.question = 'Question is required';
    } else if (newFaq.question.trim().length < 5) {
      newErrors.question = 'Question must be at least 5 characters';
    }

    if (!newFaq.answer.trim()) {
      newErrors.answer = 'Answer is required';
    } else if (newFaq.answer.trim().length < 10) {
      newErrors.answer = 'Answer must be at least 10 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateTools = () => {
    const newErrors: Record<string, string> = {};

    for (const tool of tools) {
      if (!tool.description?.trim() || tool.description.trim().length < 5) {
        newErrors[`${tool.name}.description`] = 'Description is required (min 5 chars)';
      }
      for (const param of tool.parameters || []) {
        if (!param.description?.trim() || param.description.trim().length < 3) {
          newErrors[`${tool.name}.param.${param.name}`] = 'Parameter description is required (min 3 chars)';
        }
      }
    }

    setToolErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSaveTools = async () => {
    if (!agentId) {
      setToolErrors({ submit: 'Please select an agent first' });
      return;
    }
    if (!validateTools()) return;

    setToolSaving(true);
    setToolSuccess('');

    try {
      await axios.put('/api/tools', {
        tools: tools.map(t => ({
          agentId,
          name: t.name,
          enabled: t.enabled,
          description: t.description,
          parameters: t.parameters,
        })),
      });
      setToolSuccess('Tools saved successfully!');
      setTimeout(() => setToolSuccess(''), 3000);
      await loadTools();
    } catch (error: any) {
      setToolErrors({ submit: error.response?.data?.error || 'Failed to save tools' });
    } finally {
      setToolSaving(false);
    }
  };

  const handleAddFaq = async () => {
    if (!agentId) {
      setErrors({ submit: 'Please select an agent first' });
      return;
    }

    if (faqCount >= 5) {
      setErrors({ submit: 'Maximum 5 FAQs allowed' });
      return;
    }

    if (!validateFaq()) return;

    setLoading(true);
    setSuccess('');

    try {
      await axios.post('/api/faqs', {
        agentId,
        question: newFaq.question,
        answer: newFaq.answer,
      });

      setNewFaq({ question: '', answer: '' });
      setSuccess('FAQ added successfully!');
      await loadFaqs();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error || 'Failed to add FAQ' });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFaq = async (faqId: string) => {
    if (!confirm('Are you sure you want to delete this FAQ?')) return;

    try {
      await axios.delete('/api/faqs', { data: { faqId } });
      await loadFaqs();
      setSuccess('FAQ deleted successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error: any) {
      setErrors({ submit: error.response?.data?.error || 'Failed to delete FAQ' });
    }
  };

  return (
    <Layout>
      <div className="animate-slide-in">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Tools & Knowledge</h1>
          <p className="text-slate-600">Configure FAQs and view available tools</p>
        </div>

        {/* Agent Selector */}
        {agents.length > 0 && (
          <div className="card mb-6">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Agent
            </label>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="input-field"
            >
              {agents.map(agent => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {!agentId && (
          <div className="card bg-yellow-50 border-yellow-200 mb-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
              <p className="text-yellow-800">
                Please create an agent first in the Agent Builder before adding FAQs.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* FAQ Section */}
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-blue-600" />
                  FAQ Knowledge Base
                </h2>
                <span className="badge-info">{faqCount} / 5 FAQs</span>
              </div>

              {/* Add New FAQ Form */}
              <div className="bg-slate-50 rounded-lg p-4 mb-4">
                <h3 className="font-medium text-slate-700 mb-3">Add New FAQ</h3>
                
                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Question *
                  </label>
                  <input
                    type="text"
                    value={newFaq.question}
                    onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
                    className={`input-field ${errors.question ? 'border-red-500' : ''}`}
                    placeholder="e.g., What is your return policy?"
                    disabled={!agentId || faqCount >= 5}
                  />
                  {errors.question && (
                    <p className="text-red-600 text-xs mt-1">{errors.question}</p>
                  )}
                </div>

                <div className="mb-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Answer *
                  </label>
                  <textarea
                    value={newFaq.answer}
                    onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                    className={`input-field ${errors.answer ? 'border-red-500' : ''}`}
                    rows={3}
                    placeholder="Our return policy allows returns within 30 days..."
                    disabled={!agentId || faqCount >= 5}
                  />
                  {errors.answer && (
                    <p className="text-red-600 text-xs mt-1">{errors.answer}</p>
                  )}
                </div>

                <button
                  onClick={handleAddFaq}
                  disabled={loading || !agentId || faqCount >= 5}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="spinner" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Add FAQ
                    </>
                  )}
                </button>

                {faqCount >= 5 && (
                  <p className="text-amber-600 text-sm mt-2 text-center">
                    Maximum 5 FAQs reached
                  </p>
                )}
              </div>

              {/* FAQ List */}
              <div className="space-y-3">
                {faqs.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <HelpCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No FAQs added yet</p>
                  </div>
                ) : (
                  faqs.map((faq) => (
                    <div key={faq._id?.toString()} className="border border-slate-200 rounded-lg p-4 bg-white">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-slate-900">{faq.question}</h4>
                        <button
                          onClick={() => handleDeleteFaq(faq._id!.toString())}
                          className="text-red-600 hover:text-red-800 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm text-slate-600">{faq.answer}</p>
                    </div>
                  ))
                )}
              </div>

              {errors.submit && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm">{errors.submit}</p>
                </div>
              )}

              {success && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-slide-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-green-800 text-sm">{success}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tools Section */}
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
                <Wrench className="w-5 h-5 text-purple-600" />
                  Tool Configuration
                </h2>
                <span className="badge badge-info">{tools.length} tools</span>
              </div>

              {toolErrors.submit && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {toolErrors.submit}
                  </p>
                </div>
              )}

              {toolSuccess && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-slide-in">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <p className="text-green-800 text-sm">{toolSuccess}</p>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {tools.map((tool, toolIdx) => (
                  <div key={tool.name} className="border border-slate-200 rounded-lg p-4 bg-white">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-mono font-bold text-slate-900">{tool.name}()</h3>
                        <p className="text-xs text-slate-500">
                          {tool.name === 'order_lookup'
                            ? 'Failure rule: random 20% failure rate'
                            : 'Failure rule: fails if description is too short (<10 chars)'}
                        </p>
                      </div>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={tool.enabled}
                          onChange={(e) => {
                            const enabled = e.target.checked;
                            setTools(prev => {
                              const next = [...prev];
                              next[toolIdx] = { ...next[toolIdx], enabled };
                              return next;
                            });
                          }}
                        />
                        Enabled
                      </label>
                    </div>

                    <div className="mb-3">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Description *
                      </label>
                      <input
                        type="text"
                        value={tool.description}
                        onChange={(e) => {
                          const description = e.target.value;
                          setTools(prev => {
                            const next = [...prev];
                            next[toolIdx] = { ...next[toolIdx], description };
                            return next;
                          });
                        }}
                        className={`input-field ${toolErrors[`${tool.name}.description`] ? 'border-red-500' : ''}`}
                      />
                      {toolErrors[`${tool.name}.description`] && (
                        <p className="text-red-600 text-xs mt-1">{toolErrors[`${tool.name}.description`]}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold text-slate-700">Parameters</h4>
                      {tool.parameters.map((param, paramIdx) => (
                        <div key={param.name} className="bg-slate-50 rounded p-3">
                          <div className="flex items-center justify-between">
                            <div className="text-xs">
                              <code className="font-mono text-slate-900">{param.name}</code>
                              <span className="text-slate-500"> : {param.type}</span>
                            </div>
                            <label className="flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={param.required}
                                onChange={(e) => {
                                  const required = e.target.checked;
                                  setTools(prev => {
                                    const next = [...prev];
                                    const updatedParams = [...next[toolIdx].parameters];
                                    updatedParams[paramIdx] = { ...updatedParams[paramIdx], required };
                                    next[toolIdx] = { ...next[toolIdx], parameters: updatedParams };
                                    return next;
                                  });
                                }}
                              />
                              Required
                            </label>
                          </div>

                          <div className="mt-2">
                            <label className="block text-xs font-medium text-slate-700 mb-1">
                              Parameter Description *
                            </label>
                            <input
                              type="text"
                              value={param.description}
                              onChange={(e) => {
                                const description = e.target.value;
                                setTools(prev => {
                                  const next = [...prev];
                                  const updatedParams = [...next[toolIdx].parameters];
                                  updatedParams[paramIdx] = { ...updatedParams[paramIdx], description };
                                  next[toolIdx] = { ...next[toolIdx], parameters: updatedParams };
                                  return next;
                                });
                              }}
                              className={`input-field ${toolErrors[`${tool.name}.param.${param.name}`] ? 'border-red-500' : ''}`}
                            />
                            {toolErrors[`${tool.name}.param.${param.name}`] && (
                              <p className="text-red-600 text-xs mt-1">{toolErrors[`${tool.name}.param.${param.name}`]}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded p-2">
                      <p className="text-xs text-amber-800">
                        Disabling a tool will cause a tool config failure escalation when that intent requires it.
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleSaveTools}
                disabled={!agentId || toolSaving || tools.length === 0}
                className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
              >
                {toolSaving ? (
                  <>
                    <div className="spinner" />
                    Saving...
                  </>
                ) : (
                  'Save Tools'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
