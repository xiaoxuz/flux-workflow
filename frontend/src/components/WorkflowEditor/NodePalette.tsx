import React from 'react';
import { Card, Tooltip } from 'antd';
import { RobotOutlined, ApiOutlined, BranchesOutlined, SyncOutlined, SwapOutlined, ToolOutlined, PartitionOutlined, NodeIndexOutlined, UserOutlined, FlagOutlined, CodeOutlined, TeamOutlined } from '@ant-design/icons';

interface NodePaletteProps {
  onAddNode: (type: string) => void;
}

const nodeTypes = [
  { type: 'start', label: '开始', icon: <FlagOutlined />, color: '#ef4444', desc: '流程起点' },
  { type: 'llm', label: 'LLM', icon: <RobotOutlined />, color: '#6366f1', desc: '大模型调用' },
  { type: 'agent', label: 'Agent', icon: <TeamOutlined />, color: '#f43f5e', desc: '智能 Agent' },
  { type: 'http', label: 'HTTP', icon: <ApiOutlined />, color: '#10b981', desc: '发送 HTTP 请求' },
  { type: 'condition', label: '条件分支', icon: <BranchesOutlined />, color: '#f59e0b', desc: '根据条件分支' },
  { type: 'loop', label: '循环', icon: <SyncOutlined />, color: '#8b5cf6', desc: '循环执行' },
  { type: 'transform', label: '数据转换', icon: <SwapOutlined />, color: '#ec4899', desc: '数据处理' },
  { type: 'json', label: 'JSON', icon: <CodeOutlined />, color: '#22c55e', desc: 'JSON 编码/解码' },
  { type: 'tool', label: '工具调用', icon: <ToolOutlined />, color: '#14b8a6', desc: '调用外部工具' },
  { type: 'parallel', label: '并行执行', icon: <PartitionOutlined />, color: '#3b82f6', desc: '并行运行多个节点' },
  { type: 'subgraph', label: '子图', icon: <NodeIndexOutlined />, color: '#f97316', desc: '嵌入子工作流' },
  { type: 'human', label: '人工输入', icon: <UserOutlined />, color: '#06b6d4', desc: '等待人工输入' },
  { type: 'end', label: '结束', icon: <FlagOutlined />, color: '#6b7280', desc: '流程终点' },
];

const NodePalette: React.FC<NodePaletteProps> = ({ onAddNode }) => {
  return (
    <div style={{ width: 180, background: 'rgba(18,18,26,0.6)', backdropFilter: 'blur(10px)', borderRight: '1px solid rgba(255,255,255,0.06)', padding: 16, display: 'flex', flexDirection: 'column', gap: 8, overflow: 'auto', height: '100%' }}>
      <div style={{ color: '#71717a', fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>节点面板</div>
      {nodeTypes.map((node) => (
        <Tooltip key={node.type} title={node.desc} placement="right">
          <Card
            size="small"
            hoverable
            onClick={() => onAddNode(node.type)}
            style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.06)', 
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            styles={{ body: { padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10 } }}
          >
            <div style={{ 
              width: 28, 
              height: 28, 
              borderRadius: 6, 
              background: `linear-gradient(135deg, ${node.color}20 0%, ${node.color}10 100%)`, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: node.color,
            }}>
              {node.icon}
            </div>
            <span style={{ color: '#e4e4e7', fontSize: 13 }}>{node.label}</span>
          </Card>
        </Tooltip>
      ))}
    </div>
  );
};

export default NodePalette;