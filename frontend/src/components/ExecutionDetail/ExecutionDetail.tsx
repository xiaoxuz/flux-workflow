import React from 'react';
import { useState, useEffect } from 'react';
import { Spin, Tag, Timeline, Collapse, Empty } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SyncOutlined } from '@ant-design/icons';
import { executionApi } from '../../services/api';
import type { Execution, TraceNode } from '../../types';

interface ExecutionDetailProps {
  executionId: string | null;
  visible?: boolean;
  refreshKey?: number;
}

const statusColors: Record<string, string> = {
  pending: '#71717a',
  running: '#3b82f6',
  success: '#22c55e',
  failed: '#ef4444',
};

const statusBgColors: Record<string, string> = {
  pending: 'rgba(113,113,122,0.1)',
  running: 'rgba(59,130,246,0.1)',
  success: 'rgba(34,197,94,0.1)',
  failed: 'rgba(239,68,68,0.1)',
};

const ExecutionDetail: React.FC<ExecutionDetailProps> = ({ executionId, visible, refreshKey }) => {
  const [execution, setExecution] = useState<Execution | null>(null);
  const [traceNodes, setTraceNodes] = useState<TraceNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (executionId && visible) {
      loadExecution(executionId);
      loadTrace(executionId);
    }
  }, [executionId, visible, refreshKey]);

  const loadExecution = async (id: string) => {
    setLoading(true);
    try {
      const data = await executionApi.get(id);
      setExecution(data);
    } catch (error) {
      console.error('Failed to load execution:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTrace = async (id: string) => {
    try {
      const data = await executionApi.getTrace(id);
      setTraceNodes(data.nodes || []);
    } catch (error) {
      console.error('Failed to load trace:', error);
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (time?: string) => {
    if (!time) return '-';
    return new Date(time).toLocaleString('zh-CN');
  };

  const renderJsonValue = (data: any, maxHeight = 150) => {
    if (!data || Object.keys(data).length === 0) {
      return <span style={{ color: '#71717a' }}>无数据</span>;
    }
    return (
      <pre style={{ 
        background: 'rgba(0,0,0,0.2)', 
        borderRadius: 6, 
        padding: 10, 
        fontSize: 11, 
        overflow: 'auto', 
        maxHeight,
        color: '#a5b4fc',
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    );
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>;
  }

  if (!execution) {
    return <div style={{ padding: 16, color: '#71717a' }}>请选择一个执行记录查看详情</div>;
  }

  return (
    <div style={{ padding: 16, overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <Tag 
            style={{ 
              background: statusBgColors[execution.status], 
              border: `1px solid ${statusColors[execution.status]}`,
              color: statusColors[execution.status],
              fontSize: 12,
              padding: '2px 10px',
            }}
          >
            {execution.status === 'success' ? '执行成功' : 
             execution.status === 'failed' ? '执行失败' :
             execution.status === 'running' ? '执行中' :
             execution.status === 'cancelled' ? '已取消' : '等待中'}
          </Tag>
          <span style={{ color: '#71717a', fontSize: 11, fontFamily: 'monospace' }}>
            {execution.id.substring(0, 16)}...
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 6 }}>
            <div style={{ color: '#71717a', fontSize: 11 }}>耗时</div>
            <div style={{ color: '#f0f0f5', fontWeight: 500, fontSize: 14 }}>{formatDuration(execution.duration_ms)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 6 }}>
            <div style={{ color: '#71717a', fontSize: 11 }}>Token</div>
            <div style={{ color: '#f0f0f5', fontWeight: 500, fontSize: 14 }}>{execution.total_tokens || 0}</div>
          </div>
        </div>
      </div>

      {execution.error && (
        <div style={{ marginBottom: 16, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: 10 }}>
          <div style={{ color: '#ef4444', fontSize: 12, fontWeight: 500, marginBottom: 4 }}>错误信息</div>
          <div style={{ color: '#fca5a5', fontSize: 11 }}>{execution.error}</div>
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <div style={{ color: '#f0f0f5', fontSize: 13, fontWeight: 500, marginBottom: 8 }}>节点执行流程</div>
        {traceNodes.length === 0 ? (
          <Empty description="暂无执行追踪数据" style={{ padding: 20 }} image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : (
          <Timeline
            items={traceNodes.map((node) => ({
              color: node.status === 'success' ? '#22c55e' : node.status === 'failed' ? '#ef4444' : '#3b82f6',
              dot: node.status === 'success' ? <CheckCircleOutlined /> : 
                   node.status === 'failed' ? <CloseCircleOutlined /> : 
                   <SyncOutlined spin />,
              children: (
                <div key={node.id}>
                  <div style={{ 
                    background: 'rgba(255,255,255,0.03)', 
                    borderRadius: 8, 
                    overflow: 'hidden',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ 
                      padding: '10px 12px', 
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#f0f0f5', fontWeight: 500, fontSize: 13 }}>
                          {node.node_name || node.node_id.substring(0, 20)}
                        </span>
                        <Tag 
                          style={{ 
                            background: statusBgColors[node.status], 
                            border: `1px solid ${statusColors[node.status]}`,
                            color: statusColors[node.status],
                            fontSize: 10,
                            padding: '0 6px',
                            lineHeight: '18px',
                          }}
                        >
                          {node.status}
                        </Tag>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#71717a', fontSize: 11 }}>
                        {node.duration_ms && <span>{formatDuration(node.duration_ms)}</span>}
                        {node.tokens > 0 && <span>{node.tokens} tokens</span>}
                      </div>
                    </div>
                    
                    <Collapse
                      ghost
                      size="small"
                      items={[
                        {
                          key: '1',
                          label: <span style={{ color: '#71717a', fontSize: 11 }}>查看详情</span>,
                          children: (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div>
                                <div style={{ color: '#71717a', fontSize: 11, marginBottom: 4 }}>节点 ID</div>
                                <div style={{ color: '#a5b4fc', fontSize: 11, fontFamily: 'monospace' }}>{node.node_id}</div>
                              </div>
                              
                              <div>
                                <div style={{ color: '#71717a', fontSize: 11, marginBottom: 4 }}>输入数据</div>
                                {renderJsonValue(node.input_data)}
                              </div>
                              
                              <div>
                                <div style={{ color: '#71717a', fontSize: 11, marginBottom: 4 }}>输出数据</div>
                                {renderJsonValue(node.output_data)}
                              </div>
                              
                              {node.error && (
                                <div>
                                  <div style={{ color: '#71717a', fontSize: 11, marginBottom: 4 }}>错误</div>
                                  <div style={{ color: '#ef4444', fontSize: 11 }}>{node.error}</div>
                                </div>
                              )}
                              
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 10, color: '#71717a' }}>
                                <div>开始: {formatTime(node.started_at)}</div>
                                <div>结束: {formatTime(node.finished_at)}</div>
                              </div>
                            </div>
                          ),
                        },
                      ]}
                    />
                  </div>
                </div>
              ),
            }))}
          />
        )}
      </div>

      <Collapse
        ghost
        size="small"
        items={[
          {
            key: 'input',
            label: <span style={{ color: '#f0f0f5', fontSize: 13 }}>初始输入</span>,
            children: renderJsonValue(execution.inputs, 200),
          },
          {
            key: 'output',
            label: <span style={{ color: '#f0f0f5', fontSize: 13 }}>最终输出</span>,
            children: renderJsonValue(execution.outputs, 200),
          },
        ]}
      />

      <div style={{ marginTop: 16, fontSize: 10, color: '#52525b' }}>
        <div>创建: {formatTime(execution.created_at)}</div>
        {execution.started_at && <div>开始: {formatTime(execution.started_at)}</div>}
        {execution.finished_at && <div>结束: {formatTime(execution.finished_at)}</div>}
      </div>
    </div>
  );
};

export default ExecutionDetail;