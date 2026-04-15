import React, { useState, useEffect, useRef } from 'react';
import { Input, Button, Spin, Empty, Tag } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { agentsApi } from '../services/api';
import type { Agent, ChatMessage } from '../types/agents';

const { TextArea } = Input;

interface AgentChatPageProps {
  agentId: string;
  onBack: () => void;
}

const AgentChatPage: React.FC<AgentChatPageProps> = ({ agentId, onBack }) => {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [sessionId, setSessionId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadAgent();
  }, [agentId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadAgent = async () => {
    try {
      const data = await agentsApi.get(agentId);
      setAgent(data);
    } catch (error) {
      onBack();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!input.trim() || !agent || loading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      await agentsApi.chatStream(
        agent.id,
        userMessage.content,
        sessionId,
        // onStep: 实时追加 step 消息
        (step: any) => {
          const stepType = step.step_type || step.stepType;
          const chatMsg: ChatMessage = {
            role: 'assistant' as const,
            content: step.content || '',
            timestamp: new Date().toISOString(),
            stepType: stepType as ChatMessage['stepType'],
            toolName: step.tool_name,
            toolInput: step.tool_input,
            toolOutput: step.tool_output,
          };
          setMessages(prev => [...prev, chatMsg]);
        },
        // onDone: 设置最终结果
        (data: any) => {
          if (data.session_id && !sessionId) {
            setSessionId(data.session_id);
          }
          // 检查最后一条消息是否已经是 final_answer，避免重复
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1];
            if (lastMsg && lastMsg.stepType === 'final_answer') {
              return prev;
            }
            if (data.answer) {
              const finalMsg: ChatMessage = {
                role: 'assistant' as const,
                content: data.answer,
                timestamp: new Date().toISOString(),
                stepType: 'final_answer',
              };
              return [...prev, finalMsg];
            }
            return prev;
          });
          setLoading(false);
        },
        // onError
        (error: string) => {
          const errorMessage: ChatMessage = {
            role: 'assistant',
            content: `错误: ${error}`,
            timestamp: new Date().toISOString(),
          };
          setMessages(prev => [...prev, errorMessage]);
          setLoading(false);
        },
      );
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: `错误: ${error.message || '未知错误'}`,
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!agent) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Spin />
      </div>
    );
  }

  const modeLabels: Record<string, string> = {
    react: 'ReAct',
    plan_execute: '计划执行',
    reflexion: '反思',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0f' }}>
      {/* 头部 */}
      <div style={{ 
        flexShrink: 0,
        padding: '16px 24px', 
        borderBottom: '1px solid rgba(255,255,255,0.06)', 
        display: 'flex', 
        alignItems: 'center', 
        gap: 16,
        background: 'rgba(18,18,26,0.8)',
      }}>
        <Button 
          type="text" 
          icon={<ArrowLeftOutlined />} 
          onClick={onBack}
          style={{ color: '#71717a' }}
        />
        <div style={{ 
          width: 40, 
          height: 40, 
          borderRadius: 10, 
          background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <RobotOutlined style={{ color: 'white', fontSize: 20 }} />
        </div>
        <div>
          <div style={{ color: '#f0f0f5', fontSize: 16, fontWeight: 600 }}>{agent.name}</div>
          <div style={{ color: '#71717a', fontSize: 12 }}>
            <Tag style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
              {modeLabels[agent.mode] || agent.mode}
            </Tag>
            <span style={{ marginLeft: 8 }}>{agent.model_name}</span>
          </div>
          {agent.skills && agent.skills.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
              {agent.skills.map(s => (
                <Tag key={s} color="green" style={{ margin: 0, fontSize: 11 }}>{s}</Tag>
              ))}
            </div>
          )}
          {agent.mcp_servers && agent.mcp_servers.length > 0 && (
            <Tag color="purple" style={{ marginTop: 4, fontSize: 11 }}>
              MCP: {agent.mcp_servers.length}
            </Tag>
          )}
        </div>
      </div>

      {/* 消息列表 */}
      <div style={{ 
        flex: 1, 
        minHeight: 0,
        overflow: 'auto', 
        padding: 24, 
        background: 'linear-gradient(180deg, rgba(15,15,20,1) 0%, rgba(10,10,15,1) 100%)' 
      }}>
        {messages.length === 0 ? (
          <Empty 
            description="开始与 Agent 对话吧" 
            style={{ marginTop: 100 }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 1100, margin: '0 auto' }}>
            {messages.map((msg, index) => {
              const isUser = msg.role === 'user';
              const isFinalAnswer = msg.stepType === 'final_answer';
              const isStep = msg.stepType && !isFinalAnswer;
              const hasDetail = msg.toolName || msg.toolInput || msg.toolOutput;
              const isExpanded = expandedSteps.has(index);
              
              if (isStep) {
                const stepIcons: Record<string, string> = {
                  thought: '💭',
                  action: '🔧',
                  observation: '👁️',
                };
                const stepColors: Record<string, string> = {
                  thought: '#a78bfa',
                  action: '#4ade80',
                  observation: '#60a5fa',
                };
                const stepLabels: Record<string, string> = {
                  thought: '思考',
                  action: '工具调用',
                  observation: '观察',
                };
                
                return (
                  <div key={index} style={{ paddingLeft: 48 }}>
                    <div 
                      onClick={() => {
                        if (hasDetail) {
                          const newSet = new Set(expandedSteps);
                          if (isExpanded) {
                            newSet.delete(index);
                          } else {
                            newSet.add(index);
                          }
                          setExpandedSteps(newSet);
                        }
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px dashed rgba(255,255,255,0.08)',
                        borderRadius: 8,
                        padding: '10px 14px',
                        maxWidth: 900,
                        fontFamily: '"SF Mono", "Fira Code", monospace',
                        fontSize: 12,
                        color: 'rgba(255,255,255,0.5)',
                        lineHeight: 1.5,
                        cursor: hasDetail ? 'pointer' : 'default',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {hasDetail && (
                          <span style={{ color: stepColors[msg.stepType!], transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
                            ▶
                          </span>
                        )}
                        <span>{stepIcons[msg.stepType!]}</span>
                        <span style={{ color: stepColors[msg.stepType!], fontWeight: 600 }}>
                          [{stepLabels[msg.stepType!]}]
                        </span>
                        {msg.stepType === 'action' && msg.toolName && (
                          <span style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                            {msg.toolName}
                          </span>
                        )}
                        <span style={{ marginLeft: 8, color: 'rgba(255,255,255,0.4)', flex: 1 }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        </span>
                      </div>
                      {isExpanded && hasDetail && (
                        <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed rgba(255,255,255,0.06)' }}>
                          {msg.toolName && (
                            <div style={{ marginBottom: 8 }}>
                              <span style={{ color: 'rgba(255,255,255,0.3)' }}>工具: </span>
                              <span style={{ color: '#fbbf24' }}>{msg.toolName}</span>
                            </div>
                          )}
                          {msg.toolInput && Object.keys(msg.toolInput).length > 0 && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>参数:</div>
                              <pre style={{ 
                                margin: 0, 
                                padding: '8px 10px', 
                                background: 'rgba(0,0,0,0.3)', 
                                borderRadius: 6,
                                fontSize: 11,
                                color: '#a5b4fc',
                                overflow: 'auto',
                                maxHeight: 120,
                              }}>
                                {JSON.stringify(msg.toolInput, null, 2)}
                              </pre>
                            </div>
                          )}
                          {msg.toolOutput && (
                            <div>
                              <div style={{ color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>返回:</div>
                              <pre style={{ 
                                margin: 0, 
                                padding: '8px 10px', 
                                background: 'rgba(0,0,0,0.3)', 
                                borderRadius: 6,
                                fontSize: 11,
                                color: '#4ade80',
                                overflow: 'auto',
                                maxHeight: 120,
                              }}>
                                {msg.toolOutput}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              
              return (
                <div key={index} style={{ 
                  display: 'flex', 
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-end',
                  gap: 8,
                }}>
                  {!isUser && (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginBottom: 4,
                    }}>
                      <RobotOutlined style={{ color: 'white', fontSize: 14 }} />
                    </div>
                  )}
                  <div style={{
                    background: isUser 
                      ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)'
                      : 'rgba(255,255,255,0.06)',
                    border: isUser ? 'none' : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    padding: '10px 14px',
                    maxWidth: 900,
                    color: '#f0f0f5',
                    fontSize: 14,
                    lineHeight: 1.6,
                    boxShadow: isUser 
                      ? '0 2px 12px rgba(99,102,241,0.3)' 
                      : '0 2px 8px rgba(0,0,0,0.2)',
                  }}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '');
                          const isInline = !match;
                          return isInline ? (
                            <code style={{
                              background: 'rgba(0,0,0,0.3)',
                              padding: '2px 6px',
                              borderRadius: 4,
                              fontSize: 13,
                              fontFamily: '"SF Mono", "Fira Code", monospace',
                            }} {...props}>{children}</code>
                          ) : (
                            <pre style={{
                              background: 'rgba(0,0,0,0.4)',
                              padding: '10px 12px',
                              borderRadius: 8,
                              overflow: 'auto',
                              fontSize: 13,
                              margin: '8px 0',
                            }}>
                              <code {...props}>{children}</code>
                            </pre>
                          );
                        },
                        p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
                        ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: 20 }}>{children}</ul>,
                        ol: ({ children }) => <ol style={{ margin: '8px 0', paddingLeft: 20 }}>{children}</ol>,
                        li: ({ children }) => <li style={{ margin: '4px 0' }}>{children}</li>,
                        a: ({ href, children }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#60a5fa' }}>
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                  {isUser && (
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginBottom: 4,
                    }}>
                      <UserOutlined style={{ color: 'white', fontSize: 14 }} />
                    </div>
                  )}
                </div>
              );
            })}
            {loading && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'flex-start',
                alignItems: 'flex-end',
                gap: 8,
              }}>
                <div style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <RobotOutlined style={{ color: 'white', fontSize: 14 }} />
                </div>
                <div style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '18px 18px 18px 4px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  <Spin size="small" />
                  <span style={{ color: '#71717a', fontSize: 13 }}>思考中...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入框 */}
      <div style={{ 
        flexShrink: 0,
        padding: 16, 
        borderTop: '1px solid rgba(255,255,255,0.06)', 
        background: 'rgba(18,18,26,0.8)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', gap: 12 }}>
          <TextArea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            autoSize={{ minRows: 1, maxRows: 4 }}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: '#f0f0f5',
              borderRadius: 8,
            }}
          />
          <Button 
            type="primary" 
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={loading}
            disabled={!input.trim() || loading}
            style={{ 
              background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', 
              border: 'none',
              borderRadius: 8,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default AgentChatPage;