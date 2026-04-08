import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { NodeIndexOutlined } from '@ant-design/icons';

const SubgraphNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as any;
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 12,
      background: selected ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.05)',
      backdropFilter: 'blur(10px)',
      border: selected ? '1px solid rgba(249,115,22,0.5)' : '1px solid rgba(255,255,255,0.1)',
      minWidth: 120,
      boxShadow: selected ? '0 8px 24px rgba(249,115,22,0.25)' : '0 4px 12px rgba(0,0,0,0.2)',
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#f97316', width: 8, height: 8, border: '2px solid rgba(255,255,255,0.2)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 32, 
          height: 32, 
          borderRadius: 10, 
          background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
        }}>
          <NodeIndexOutlined style={{ color: 'white', fontSize: 16 }} />
        </div>
        <div>
          <div style={{ color: '#f0f0f5', fontWeight: 600, fontSize: 13 }}>子图</div>
          <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>{nodeData?.label || '子工作流'}</div>
        </div>
      </div>
      <Handle type="source" position={Position.Right} style={{ background: '#f97316', width: 8, height: 8, border: '2px solid rgba(255,255,255,0.2)' }} />
    </div>
  );
};

export default memo(SubgraphNodeComponent);