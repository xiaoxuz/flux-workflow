import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { ApiOutlined } from '@ant-design/icons';

const HttpNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as any;
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 12,
      background: selected ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.05)',
      backdropFilter: 'blur(10px)',
      border: selected ? '1px solid rgba(16,185,129,0.5)' : '1px solid rgba(255,255,255,0.1)',
      minWidth: 120,
      boxShadow: selected ? '0 8px 24px rgba(16,185,129,0.25)' : '0 4px 12px rgba(0,0,0,0.2)',
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#10b981', width: 8, height: 8, border: '2px solid rgba(255,255,255,0.2)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 32, 
          height: 32, 
          borderRadius: 10, 
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(16,185,129,0.3)',
        }}>
          <ApiOutlined style={{ color: 'white', fontSize: 16 }} />
        </div>
        <div>
          <div style={{ color: '#f0f0f5', fontWeight: 600, fontSize: 13 }}>HTTP</div>
          <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>{nodeData?.label || 'HTTP 请求'}</div>
        </div>
      </div>
      {nodeData?.config?.url && <div style={{ color: '#6ee7b7', fontSize: 10, marginTop: 6, fontFamily: 'monospace', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nodeData.config.method} {nodeData.config.url?.split('?')[0]}</div>}
      <Handle type="source" position={Position.Right} style={{ background: '#10b981', width: 8, height: 8, border: '2px solid rgba(255,255,255,0.2)' }} />
    </div>
  );
};

export default memo(HttpNodeComponent);