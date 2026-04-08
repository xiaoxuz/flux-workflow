import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { TeamOutlined } from '@ant-design/icons';

const AgentNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as any;
  const mode = nodeData?.config?.mode || 'react';
  const modeLabel: Record<string, string> = {
    react: 'ReAct',
    plan_execute: '计划执行',
    reflexion: '反思',
  };
  
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 12,
      background: selected ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.05)',
      backdropFilter: 'blur(10px)',
      border: selected ? '1px solid rgba(244,63,94,0.5)' : '1px solid rgba(255,255,255,0.1)',
      minWidth: 120,
      boxShadow: selected ? '0 8px 24px rgba(244,63,94,0.25)' : '0 4px 12px rgba(0,0,0,0.2)',
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#f43f5e', width: 8, height: 8, border: '2px solid rgba(255,255,255,0.2)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 32, 
          height: 32, 
          borderRadius: 10, 
          background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(244,63,94,0.3)',
        }}>
          <TeamOutlined style={{ color: 'white', fontSize: 16 }} />
        </div>
        <div>
          <div style={{ color: '#f0f0f5', fontWeight: 600, fontSize: 13 }}>Agent</div>
          <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>{nodeData?.label || modeLabel[mode] || 'Agent'}</div>
        </div>
      </div>
      <div style={{ color: '#fda4af', fontSize: 10, marginTop: 6 }}>{modeLabel[mode] || mode}</div>
      <Handle type="source" position={Position.Right} style={{ background: '#f43f5e', width: 8, height: 8, border: '2px solid rgba(255,255,255,0.2)' }} />
    </div>
  );
};

export default memo(AgentNodeComponent);