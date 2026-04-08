import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { BranchesOutlined } from '@ant-design/icons';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

const ConditionNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as any;
  const branches = nodeData?.config?.branches || [];
  const branchList = Array.isArray(branches) ? branches : [];
  
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 12,
      background: selected ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.05)',
      backdropFilter: 'blur(10px)',
      border: selected ? '1px solid rgba(245,158,11,0.5)' : '1px solid rgba(255,255,255,0.1)',
      minWidth: 160,
      boxShadow: selected ? '0 8px 24px rgba(245,158,11,0.25)' : '0 4px 12px rgba(0,0,0,0.2)',
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#f59e0b', width: 10, height: 10, border: '2px solid rgba(255,255,255,0.2)' }} />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 32, 
          height: 32, 
          borderRadius: 10, 
          background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
        }}>
          <BranchesOutlined style={{ color: 'white', fontSize: 16 }} />
        </div>
        <div>
          <div style={{ color: '#f0f0f5', fontWeight: 600, fontSize: 13 }}>条件分支</div>
          <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>{nodeData?.label || '条件判断'}</div>
        </div>
      </div>
      
      {branchList.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {branchList.map((branch: any, index: number) => {
            const handleId = `branch_${index}`;
            const color = COLORS[index % COLORS.length];
            const label = branch.label || branch.condition?.substring(0, 15) || `分支${index + 1}`;
            
            return (
              <div key={handleId} style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6,
                position: 'relative',
              }}>
                <div style={{ 
                  width: 8, 
                  height: 8, 
                  borderRadius: '50%', 
                  background: color,
                  flexShrink: 0,
                }} />
                <span style={{ color: '#a1a1aa', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                  {label}
                </span>
                <Handle 
                  type="source" 
                  position={Position.Right} 
                  id={handleId}
                  style={{ 
                    background: color, 
                    width: 10, 
                    height: 10,
                    top: 'auto',
                    right: -6,
                    border: '2px solid rgba(255,255,255,0.2)',
                  }} 
                />
              </div>
            );
          })}
        </div>
      )}
      
      {branchList.length === 0 && (
        <div style={{ color: '#71717a', fontSize: 10, marginTop: 8 }}>
          点击配置分支
        </div>
      )}
    </div>
  );
};

export default memo(ConditionNodeComponent);