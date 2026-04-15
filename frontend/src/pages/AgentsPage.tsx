import React, { useState, useEffect } from 'react';
import { Button, Space, Table, Tag, Popconfirm, Modal, Form, Input, message, Drawer, Select, InputNumber, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, MessageOutlined, TeamOutlined } from '@ant-design/icons';
import { agentsApi } from '../services/api';
import type { Agent } from '../types/agents';
import ToolSelector from '../components/Tools/ToolSelector';
import SkillSelector from '../components/Tools/SkillSelector';
import MCPServerConfigPanel from '../components/MCP/MCPServerConfigPanel';
import type { MCPServerConfig } from '../types/agents';

const { TextArea } = Input;

interface AgentsPageProps {
  onChat?: (agentId: string) => void;
}

const AgentsPage: React.FC<AgentsPageProps> = ({ onChat }) => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editDrawerVisible, setEditDrawerVisible] = useState(false);
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    loadAgents();
  }, []);

  const loadAgents = async () => {
    setLoading(true);
    try {
      const data = await agentsApi.list();
      setAgents(data);
    } catch (error) {
      message.error('加载 Agent 列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setCurrentAgent(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (agent: Agent) => {
    setCurrentAgent(agent);
    form.setFieldsValue({
      name: agent.name,
      description: agent.description,
      mode: agent.mode,
      model_name: agent.model_name,
      base_url: agent.base_url,
      api_key: agent.api_key,
      system_prompt: agent.system_prompt,
      tools: agent.tools,
      skills: agent.skills || [],
      mcp_servers: agent.mcp_servers || [],
      max_steps: agent.max_steps,
      verbose: agent.verbose,
    });
    setEditDrawerVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      if (currentAgent) {
        await agentsApi.update(currentAgent.id, values);
        message.success('更新成功');
        setEditDrawerVisible(false);
      } else {
        await agentsApi.create(values);
        message.success('创建成功');
        setModalVisible(false);
      }
      
      loadAgents();
    } catch (error: any) {
      if (error.errorFields) {
        message.error('请填写必填项');
      } else {
        message.error(error.response?.data?.detail || '保存失败');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await agentsApi.delete(id);
      message.success('删除成功');
      loadAgents();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '删除失败');
    }
  };

  const handleChat = (agent: Agent) => {
    if (onChat) {
      onChat(agent.id);
    }
  };

  const columns = [
    {
      title: 'Agent 名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <TeamOutlined style={{ color: '#f43f5e' }} />
          <span style={{ color: '#f0f0f5', fontWeight: 500 }}>{name}</span>
        </Space>
      ),
    },
    {
      title: '模式',
      dataIndex: 'mode',
      key: 'mode',
      render: (mode: string) => {
        const modeTags: Record<string, { color: string; label: string }> = {
          react: { color: '#6366f1', label: 'ReAct' },
          plan_execute: { color: '#8b5cf6', label: '计划执行' },
          reflexion: { color: '#f59e0b', label: '反思' },
        };
        const tag = modeTags[mode] || { color: '#71717a', label: mode };
        return <Tag style={{ background: `${tag.color}20`, border: `1px solid ${tag.color}`, color: tag.color }}>{tag.label}</Tag>;
      },
    },
    {
      title: '模型',
      dataIndex: 'model_name',
      key: 'model_name',
      render: (model: string) => <span style={{ color: '#71717a' }}>{model}</span>,
    },
    {
      title: '工具数',
      dataIndex: 'tools',
      key: 'tools',
      render: (tools: string[]) => (
        <Tag style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
          {tools?.length || 0}
        </Tag>
      ),
    },
    {
      title: '绑定 Skills',
      dataIndex: 'skills',
      key: 'skills',
      render: (skills: string[]) => (
        skills && skills.length > 0
          ? skills.map(s => <Tag key={s} color="green">{s}</Tag>)
          : <span style={{ color: '#71717a' }}>无</span>
      ),
    },
    {
      title: 'MCP 服务器',
      dataIndex: 'mcp_servers',
      key: 'mcp_servers',
      render: (mcpServers: MCPServerConfig[]) => (
        mcpServers && mcpServers.length > 0
          ? <Tag color="purple">{mcpServers.length}</Tag>
          : <span style={{ color: '#71717a' }}>无</span>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (t: string) => <span style={{ color: '#71717a' }}>{new Date(t).toLocaleString('zh-CN')}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: Agent) => (
        <Space>
          <Button type="link" size="small" icon={<MessageOutlined />} onClick={() => handleChat(record)}>
            对话
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认删除此 Agent?" onConfirm={() => handleDelete(record.id)}>
            <Button type="text" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#f0f0f5', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Agent 助手</div>
          <div style={{ color: '#71717a', fontSize: 13 }}>创建和管理智能 Agent 助手</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: 8 }}>
          新建 Agent
        </Button>
      </div>

      <Table
        dataSource={agents}
        rowKey="id"
        columns={columns}
        loading={loading}
        pagination={false}
      />

      {/* 创建弹窗 */}
      <Modal
        title={<span style={{ color: '#f0f0f5' }}>新建 Agent</span>}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        okText="创建"
        cancelText="取消"
        width={600}
        styles={{
          content: { background: 'rgba(18,18,26,0.95)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
        }}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Agent 名称" rules={[{ required: true, message: '请输入名称' }]}>
            <Input placeholder="我的 Agent" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input placeholder="Agent 描述" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="mode" label="Agent 模式" initialValue="react">
              <Select style={{ width: '100%' }}>
                <Select.Option value="react">ReAct</Select.Option>
                <Select.Option value="plan_execute">计划执行</Select.Option>
                <Select.Option value="reflexion">反思</Select.Option>
              </Select>
            </Form.Item>
            <Form.Item name="model_name" label="模型名称" initialValue="gpt-4.1">
              <Input placeholder="gpt-4.1" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
            </Form.Item>
          </div>
          <Form.Item name="system_prompt" label="系统提示词">
            <TextArea rows={2} placeholder="你是一个有帮助的助手" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item name="tools" label="绑定工具">
            <ToolSelector multiple placeholder="选择工具" />
          </Form.Item>
          <Form.Item name="skills" label="绑定 Skill">
            <SkillSelector placeholder="选择 Skill" />
          </Form.Item>
          <Form.Item name="mcp_servers" label="MCP 服务器">
            <MCPServerConfigPanel />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="max_steps" label="最大步数" initialValue={10}>
              <InputNumber min={1} max={50} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
            </Form.Item>
            <Form.Item name="verbose" label="详细日志" valuePropName="checked" initialValue={false}>
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 编辑抽屉 */}
      <Drawer
        title={<span style={{ color: '#f0f0f5' }}>编辑 Agent: {currentAgent?.name}</span>}
        placement="right"
        width={500}
        open={editDrawerVisible}
        onClose={() => setEditDrawerVisible(false)}
        styles={{
          content: { background: 'rgba(18,18,26,0.95)', backdropFilter: 'blur(20px)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
        }}
        footer={
          <div style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setEditDrawerVisible(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8' }}>取消</Button>
              <Button type="primary" onClick={handleSave} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none' }}>保存</Button>
            </Space>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Agent 名称" rules={[{ required: true }]}>
            <Input style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item name="mode" label="Agent 模式">
            <Select style={{ width: '100%' }}>
              <Select.Option value="react">ReAct</Select.Option>
              <Select.Option value="plan_execute">计划执行</Select.Option>
              <Select.Option value="reflexion">反思</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="model_name" label="模型名称">
            <Input style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item name="base_url" label="API Base URL">
            <Input style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} placeholder="留空使用默认" />
          </Form.Item>
          <Form.Item name="api_key" label="API Key">
            <Input.Password style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} placeholder="留空使用环境变量" />
          </Form.Item>
          <Form.Item name="system_prompt" label="系统提示词">
            <TextArea rows={2} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item name="tools" label="绑定工具">
            <ToolSelector multiple />
          </Form.Item>
          <Form.Item name="skills" label="绑定 Skill">
            <SkillSelector placeholder="选择 Skill" />
          </Form.Item>
          <Form.Item name="mcp_servers" label="MCP 服务器">
            <MCPServerConfigPanel />
          </Form.Item>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item name="max_steps" label="最大步数">
              <InputNumber min={1} max={50} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
            </Form.Item>
            <Form.Item name="verbose" label="详细日志" valuePropName="checked">
              <Switch />
            </Form.Item>
          </div>
        </Form>
      </Drawer>
    </div>
  );
};

export default AgentsPage;