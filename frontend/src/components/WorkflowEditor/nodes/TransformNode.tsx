import React, { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { SwapOutlined } from '@ant-design/icons';

const TransformNodeComponent: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as any;
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 12,
      background: selected ? 'rgba(236,72,153,0.15)' : 'rgba(255,255,255,0.05)',
      backdropFilter: 'blur(10px)',
      border: selected ? '1px solid rgba(236,72,153,0.5)' : '1px solid rgba(255,255,255,0.1)',
      minWidth: 120,
      boxShadow: selected ? '0 8px 24px rgba(236,72,153,0.25)' : '0 4px 12px rgba(0,0,0,0.2)',
      transition: 'all 0.2s ease',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#ec4899', width: 8, height: 8, border: '2px solid rgba(255,255,255,0.2)' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ 
          width: 32, 
          height: 32, 
          borderRadius: 10, 
          background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(236,72,153,0.3)',
        }}>
          <SwapOutlined style={{ color: 'white', fontSize: 16 }} />
        </div>
        <div>
          <div style={{ color: '#f0f0f5', fontWeight: 600, fontSize: 13 }}>数据转换</div>
          <div style={{ color: '#71717a', fontSize: 11, marginTop: 2 }}>{nodeData?.label || '数据处理'}</div>
        </div>
      </div>
      {nodeData?.config?.transforms && <div style={{ color: '#f9a8d4', fontSize: 10, marginTop: 6, fontFamily: 'monospace' }}>{nodeData.config.transforms.length} 个转换</div>}
      <Handle type="source" position={Position.Right} style={{ background: '#ec4899', width: 8, height: 8, border: '2px solid rgba(255,255,255,0.2)' }} />
    </div>
  );
};

export default memo(TransformNodeComponent);