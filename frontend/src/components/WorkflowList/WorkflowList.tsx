import React from 'react';
import { Table, Button, Space, Tag, Popconfirm } from 'antd';
import { PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';
import type { Workflow } from '../../types';

interface WorkflowListProps {
  workflows: Workflow[];
  onEdit: (workflow: Workflow) => void;
  onDelete?: (id: string) => void;
}

const WorkflowList: React.FC<WorkflowListProps> = ({ workflows, onEdit, onDelete }) => {
  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', render: (t: string) => <span style={{ color: '#f0f0f5', fontWeight: 500 }}>{t}</span> },
    { title: '描述', dataIndex: 'description', key: 'description', render: (d?: string) => <span style={{ color: '#71717a' }}>{d || '-'}</span> },
    { title: '版本', dataIndex: 'version', key: 'version', render: (v: number) => <Tag style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa' }}>v{v}</Tag> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => {
      const statusConfig: Record<string, { bg: string; border: string; color: string }> = {
        draft: { bg: 'rgba(113,113,122,0.15)', border: 'rgba(113,113,122,0.3)', color: '#a1a1aa' },
        published: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', color: '#4ade80' },
        offline: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', color: '#f87171' },
      };
      const cfg = statusConfig[s] || statusConfig.draft;
      return <Tag style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>{s}</Tag>;
    }},
    { title: '更新时间', dataIndex: 'updated_at', key: 'updated_at', render: (t: string) => <span style={{ color: '#71717a' }}>{new Date(t).toLocaleString('zh-CN')}</span> },
    { title: '操作', key: 'action', render: (_: any, r: Workflow) => (
      <Space>
        <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => onEdit(r)}>编辑</Button>
        {onDelete && (
          <Popconfirm title="确认删除?" onConfirm={() => onDelete(r.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        )}
      </Space>
    )},
  ];

  return <Table dataSource={workflows} rowKey="id" columns={columns} />;
};

export default WorkflowList;