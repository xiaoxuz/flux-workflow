import React from 'react';
import { useState, useEffect } from 'react';
import { Spin, Empty } from 'antd';
import { executionApi } from '../../services/api';
import type { TraceData } from '../../types';

interface TraceViewerProps {
  executionId: string | null;
  showHistory?: boolean;
  onViewDetail?: (id: string) => void;
  onBackToHistory?: () => void;
}

const TraceViewer: React.FC<TraceViewerProps> = ({ executionId, onViewDetail }) => {
  const [trace, setTrace] = useState<TraceData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (executionId) {
      loadTrace(executionId);
    }
  }, [executionId]);

  const loadTrace = async (id: string) => {
    setLoading(true);
    try {
      const data = await executionApi.getTrace(id);
      setTrace(data);
    } catch (error) {
      console.error('Failed to load trace:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>;
  }

  if (!executionId) {
    return <Empty description="请选择一个执行记录" style={{ padding: 40, color: '#71717a' }} />;
  }

  if (!trace || trace.nodes.length === 0) {
    return <Empty description="暂无追踪数据" style={{ padding: 40, color: '#71717a' }} />;
  }

  const statusColors: Record<string, string> = {
    pending: '#71717a',
    running: '#3b82f6',
    success: '#22c55e',
    failed: '#ef4444',
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ marginBottom: 16 }}>
        <span style={{ color: '#f0f0f5', fontSize: 14, fontWeight: 500 }}>执行追踪</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {trace.nodes.map((node) => (
          <div 
            key={node.id}
            style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.06)', 
              borderRadius: 8,
              padding: 12,
              cursor: 'pointer',
            }}
            onClick={() => onViewDetail?.(node.id)}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  background: statusColors[node.status] || '#71717a' 
                }} />
                <span style={{ color: '#f0f0f5', fontWeight: 500 }}>{node.node_id}</span>
                <span style={{ color: '#71717a', fontSize: 12 }}>{node.node_type}</span>
              </div>
              <span style={{ color: '#71717a', fontSize: 12 }}>
                {node.duration_ms ? `${(node.duration_ms/1000).toFixed(2)}s` : '-'}
              </span>
            </div>
            {node.error && (
              <div style={{ color: '#ef4444', fontSize: 12, marginTop: 8 }}>
                错误: {node.error}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TraceViewer;