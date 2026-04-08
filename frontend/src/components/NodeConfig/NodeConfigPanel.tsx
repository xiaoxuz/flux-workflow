import React from 'react';
import { Drawer, Form, Input, Select, Button, Space, Tabs, InputNumber, Switch, Collapse, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useWorkflowStore } from '../../stores';
import type { WorkflowNode } from '../../types';
import ToolSelector from '../Tools/ToolSelector';
import DynamicListInput from '../common/DynamicListInput';

const { TextArea } = Input;

interface NodeConfigPanelProps {
  visible: boolean;
  node: WorkflowNode | null;
  onClose: () => void;
}

const nodeConfigSchemas: Record<string, { key: string; label: string; type: string; placeholder?: string; options?: string[]; defaultValue?: any }[]> = {
  agent: [
    { key: 'mode', label: 'Agent 模式', type: 'select', options: ['react', 'plan_execute', 'reflexion'], defaultValue: 'react' },
    { key: 'system_prompt', label: '系统提示词', type: 'textarea', placeholder: '你是一个有帮助的助手' },
    { key: 'input_key', label: '输入键', type: 'input', placeholder: 'data.query', defaultValue: 'data.query' },
    { key: 'output_key', label: '输出键', type: 'input', placeholder: 'data.result', defaultValue: 'data.result' },
    { key: 'tools', label: '可用工具', type: 'tool_selector', placeholder: '选择工具' },
    { key: 'model_name', label: '模型名称', type: 'input', placeholder: 'gpt-4.1', defaultValue: 'gpt-4.1' },
    { key: 'base_url', label: 'API Base URL', type: 'input', placeholder: '留空使用默认' },
    { key: 'api_key', label: 'API Key', type: 'input', placeholder: '留空使用环境变量' },
    { key: 'max_steps', label: '最大步数', type: 'number', defaultValue: 10 },
    { key: 'verbose', label: '详细日志', type: 'switch', defaultValue: false },
  ],
  http: [
    { key: 'url', label: '请求 URL', type: 'input', placeholder: 'https://api.example.com' },
    { key: 'method', label: '请求方法', type: 'select', options: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], defaultValue: 'GET' },
    { key: 'headers', label: '请求头 (JSON)', type: 'textarea', placeholder: '{"Authorization": "Bearer ${env.TOKEN}"}' },
    { key: 'params', label: 'URL 参数 (JSON)', type: 'textarea', placeholder: '{"page": 1}' },
    { key: 'body', label: '请求体 (JSON)', type: 'textarea', placeholder: '{"query": "${data.input}"}' },
    { key: 'output_key', label: '输出键', type: 'input', placeholder: 'data.response' },
    { key: 'timeout', label: '超时时间 (秒)', type: 'number', defaultValue: 30 },
  ],
  json: [
    { key: 'action', label: '操作类型', type: 'select', options: ['encode', 'decode'], defaultValue: 'encode' },
    { key: 'input_key', label: '输入键', type: 'input', placeholder: 'data.input', defaultValue: 'data.input' },
    { key: 'output_key', label: '输出键', type: 'input', placeholder: 'data.output', defaultValue: 'data.output' },
    { key: 'indent', label: '缩进空格数', type: 'number', defaultValue: 2 },
    { key: 'ensure_ascii', label: '转义中文', type: 'switch', defaultValue: false },
    { key: 'error_on_fail', label: '失败报错', type: 'switch', defaultValue: true },
  ],
  transform: [
    { key: 'transforms', label: '转换规则 (JSON)', type: 'textarea', placeholder: '[{"action": "set", "key": "data.status", "value": "done"}]' },
  ],
  tool: [
    { key: 'tool_name', label: '工具名称', type: 'tool_selector_single', placeholder: '选择工具' },
    { key: 'args', label: '工具参数 (JSON)', type: 'textarea', placeholder: '{"query": "${data.input}"}' },
    { key: 'output_key', label: '输出键', type: 'input', placeholder: 'data.result' },
    { key: 'parse_output', label: '解析输出', type: 'switch', defaultValue: true },
    { key: 'error_on_fail', label: '失败报错', type: 'switch', defaultValue: true },
  ],
  human: [
    { key: 'prompt', label: '提示信息', type: 'textarea', placeholder: '请审核：${data.content}' },
    { key: 'output_key', label: '输出键', type: 'input', placeholder: 'data.decision' },
    { key: 'options', label: '选项 (JSON)', type: 'textarea', placeholder: '["approve", "reject"]' },
    { key: 'timeout', label: '超时时间 (秒)', type: 'number', defaultValue: 3600 },
  ],
  loop: [
    { key: 'max_iterations', label: '最大迭代次数', type: 'number', defaultValue: 10 },
    { key: 'condition', label: '循环条件', type: 'input', placeholder: 'data.count < 10' },
  ],
  parallel: [
    { key: 'branches', label: '并行分支 (JSON)', type: 'textarea', placeholder: '["branch1", "branch2"]' },
  ],
  subgraph: [
    { key: 'workflow_path', label: '子工作流路径', type: 'input', placeholder: './sub_workflow.json' },
    { key: 'input_mapping', label: '输入映射 (JSON)', type: 'textarea', placeholder: '{"data.input": "data.query"}' },
    { key: 'output_mapping', label: '输出映射 (JSON)', type: 'textarea', placeholder: '{"data.result": "data.sub_result"}' },
  ],
};

const ConditionBranchEditor: React.FC<{
  branches: any[];
  onChange: (branches: any[]) => void;
}> = ({ branches, onChange }) => {
  const addBranch = () => {
    onChange([...branches, { condition: '', label: `分支${branches.length + 1}` }]);
  };

  const updateBranch = (index: number, field: string, value: string) => {
    const newBranches = [...branches];
    newBranches[index] = { ...newBranches[index], [field]: value };
    onChange(newBranches);
  };

  const removeBranch = (index: number) => {
    onChange(branches.filter((_, i) => i !== index));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 8 }}>
        配置分支条件，每个分支会生成一个输出端口。连线后，边会自动关联到对应分支。
      </div>
      
      {branches.map((branch, index) => (
        <div key={index} style={{ 
          background: 'rgba(255,255,255,0.03)', 
          borderRadius: 8, 
          padding: 12,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#f0f0f5', fontWeight: 500 }}>分支 {index + 1}</span>
            <Popconfirm title="删除此分支?" onConfirm={() => removeBranch(index)}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ color: '#71717a', fontSize: 11, marginBottom: 4 }}>标签</div>
              <Input
                value={branch.label || ''}
                onChange={(e) => updateBranch(index, 'label', e.target.value)}
                placeholder={`分支${index + 1}`}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
              />
            </div>
            <div>
              <div style={{ color: '#71717a', fontSize: 11, marginBottom: 4 }}>条件表达式</div>
              <Input
                value={branch.condition || ''}
                onChange={(e) => updateBranch(index, 'condition', e.target.value)}
                placeholder={index === branches.length - 1 ? 'default' : 'data.score >= 60'}
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5', fontFamily: 'monospace' }}
              />
            </div>
          </div>
        </div>
      ))}
      
      <Button 
        type="dashed" 
        icon={<PlusOutlined />} 
        onClick={addBranch}
        style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#a1a1aa' }}
      >
        添加分支
      </Button>
    </div>
  );
};

const LLMConfigEditor: React.FC<{
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
}> = ({ config, onChange }) => {
  const updateConfig = (key: string, value: any) => {
    onChange({ ...config, [key]: value });
  };

  const collapseItems = [
    {
      key: 'basic',
      label: <span style={{ color: '#f0f0f5', fontWeight: 500 }}>基础配置</span>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>模型名称</div>
            <Input
              value={config.model_name || 'gpt-4o-mini'}
              onChange={(e) => updateConfig('model_name', e.target.value)}
              placeholder="gpt-4o-mini"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
            />
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>系统提示词</div>
            <TextArea
              rows={3}
              value={config.system_prompt || ''}
              onChange={(e) => updateConfig('system_prompt', e.target.value)}
              placeholder="你是一个助手"
              style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
            />
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>用户提示词</div>
            <TextArea
              rows={3}
              value={config.user_prompt || ''}
              onChange={(e) => updateConfig('user_prompt', e.target.value)}
              placeholder="${data.input}"
              style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
            />
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>输出键</div>
            <Input
              value={config.output_key || 'data.output'}
              onChange={(e) => updateConfig('output_key', e.target.value)}
              placeholder="data.response"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>温度</div>
              <InputNumber
                value={config.temperature ?? 0}
                onChange={(v) => updateConfig('temperature', v ?? 0)}
                min={0}
                max={2}
                step={0.1}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
              />
            </div>
            <div>
              <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>最大 Token</div>
              <InputNumber
                value={config.max_tokens ?? 4096}
                onChange={(v) => updateConfig('max_tokens', v ?? 4096)}
                min={1}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'multimodal',
      label: <span style={{ color: '#f0f0f5', fontWeight: 500 }}>多模态配置</span>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 8 }}>图片列表 (URL 或变量)</div>
            <DynamicListInput
              value={config.image_list || []}
              onChange={(v) => updateConfig('image_list', v)}
              placeholder="https://example.com/image.jpg 或 ${data.image_path}"
            />
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 8 }}>视频列表 (URL 或变量)</div>
            <DynamicListInput
              value={config.video_list || []}
              onChange={(v) => updateConfig('video_list', v)}
              placeholder="https://example.com/video.mp4 或 ${data.video_path}"
            />
          </div>
        </div>
      ),
    },
    {
      key: 'tools',
      label: <span style={{ color: '#f0f0f5', fontWeight: 500 }}>工具配置</span>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>可用工具</div>
            <ToolSelector
              multiple
              value={config.tools || []}
              onChange={(v) => updateConfig('tools', v)}
            />
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>工具选择策略</div>
            <Select
              value={config.tool_choice || 'auto'}
              onChange={(v) => updateConfig('tool_choice', v)}
              style={{ width: '100%' }}
            >
              <Select.Option value="auto">auto - 自动选择</Select.Option>
              <Select.Option value="none">none - 不使用工具</Select.Option>
              <Select.Option value="required">required - 必须使用工具</Select.Option>
            </Select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#a1a1aa', fontSize: 13 }}>并行工具调用</span>
            <Switch
              checked={config.parallel_tool_calls ?? true}
              onChange={(v) => updateConfig('parallel_tool_calls', v)}
            />
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>工具循环次数</div>
            <InputNumber
              value={config.max_tool_iterations ?? 10}
              onChange={(v) => updateConfig('max_tool_iterations', v ?? 10)}
              min={1}
              max={100}
              style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'rag',
      label: <span style={{ color: '#f0f0f5', fontWeight: 500 }}>RAG 配置</span>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>知识库</div>
            <Input
              value={config.knowledge_base || ''}
              onChange={(e) => updateConfig('knowledge_base', e.target.value)}
              placeholder="知识库名称"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>检索数量</div>
              <InputNumber
                value={config.rag_top_k ?? 2}
                onChange={(v) => updateConfig('rag_top_k', v ?? 2)}
                min={1}
                max={20}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
              />
            </div>
            <div>
              <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>分数阈值</div>
              <InputNumber
                value={config.rag_score_threshold ?? 0}
                onChange={(v) => updateConfig('rag_score_threshold', v ?? 0)}
                min={0}
                max={1}
                step={0.1}
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
              />
            </div>
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>上下文存储键</div>
            <Input
              value={config.rag_context_key || 'rag_context'}
              onChange={(e) => updateConfig('rag_context_key', e.target.value)}
              placeholder="rag_context"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
            />
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>RAG 模式</div>
            <Select
              value={config.rag_mode || 'append'}
              onChange={(v) => updateConfig('rag_mode', v)}
              style={{ width: '100%' }}
            >
              <Select.Option value="prepend">prepend - 前置参考信息</Select.Option>
              <Select.Option value="append">append - 追加参考信息</Select.Option>
              <Select.Option value="replace">replace - 替换 {`{context}`} 占位符</Select.Option>
            </Select>
          </div>
        </div>
      ),
    },
    {
      key: 'advanced',
      label: <span style={{ color: '#f0f0f5', fontWeight: 500 }}>高级配置</span>,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>API Base URL</div>
            <Input
              value={config.base_url || ''}
              onChange={(e) => updateConfig('base_url', e.target.value)}
              placeholder="留空使用默认"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
            />
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>API Key</div>
            <Input.Password
              value={config.api_key || ''}
              onChange={(e) => updateConfig('api_key', e.target.value)}
              placeholder="留空使用环境变量"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
            />
          </div>
          <div>
            <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>响应格式 (JSON)</div>
            <TextArea
              rows={2}
              value={typeof config.response_format === 'object' ? JSON.stringify(config.response_format, null, 2) : config.response_format || ''}
              onChange={(e) => {
                const v = e.target.value;
                try {
                  updateConfig('response_format', JSON.parse(v));
                } catch {
                  updateConfig('response_format', v);
                }
              }}
              placeholder='{"type": "json_object"}'
              style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#a1a1aa', fontSize: 13 }}>保存到消息历史</span>
            <Switch
              checked={config.save_to_messages ?? true}
              onChange={(v) => updateConfig('save_to_messages', v)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#a1a1aa', fontSize: 13 }}>流式输出</span>
            <Switch
              checked={config.stream ?? false}
              onChange={(v) => updateConfig('stream', v)}
            />
          </div>
        </div>
      ),
    },
  ];

  return (
    <Collapse
      defaultActiveKey={['basic', 'multimodal']}
      items={collapseItems}
      style={{ background: 'transparent', border: 'none' }}
    />
  );
};

const NodeConfigPanel: React.FC<NodeConfigPanelProps> = ({ visible, node, onClose }) => {
  const { updateNode } = useWorkflowStore();
  const [form] = Form.useForm();
  const [branches, setBranches] = React.useState<any[]>([]);
  const [llmConfig, setLLMConfig] = React.useState<Record<string, any>>({});

  React.useEffect(() => {
    if (node) {
      const config = node.data.config || {};
      const formValues: Record<string, any> = {
        label: node.data.label,
      };
      
      const nodeType = node.data.type || node.type;
      
      if (nodeType === 'condition') {
        setBranches(config.branches || []);
      } else if (nodeType === 'llm') {
        setLLMConfig(config);
      } else {
        const schema = nodeConfigSchemas[nodeType] || [];
        schema.forEach(field => {
          formValues[field.key] = config[field.key] ?? field.defaultValue;
        });
      }
      
      form.setFieldsValue(formValues);
    }
  }, [node, form]);

  const handleSave = () => {
    if (!node) return;
    const values = form.getFieldsValue();
    const { label, ...config } = values;
    
    const nodeType = node.data.type || node.type;
    
    if (nodeType === 'condition') {
      config.branches = branches;
    } else if (nodeType === 'llm') {
      Object.assign(config, llmConfig);
    } else {
      const newConfig: Record<string, any> = {};
      Object.keys(config).forEach(key => {
        const value = config[key];
        if (value !== undefined && value !== '' && value !== null) {
          if (typeof value === 'string' && (value.startsWith('[') || value.startsWith('{'))) {
            try {
              newConfig[key] = JSON.parse(value);
            } catch {
              newConfig[key] = value;
            }
          } else {
            newConfig[key] = value;
          }
        }
      });
      Object.assign(config, newConfig);
    }
    
    updateNode(node.id, {
      data: {
        ...node.data,
        label,
        config: nodeType === 'condition' ? { branches } : nodeType === 'llm' ? llmConfig : config,
      },
    });
    onClose();
  };

  const renderField = (field: { key: string; label: string; type: string; placeholder?: string; options?: string[]; defaultValue?: any }) => {
    switch (field.type) {
      case 'input':
        return <Input placeholder={field.placeholder} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />;
      case 'textarea':
        return <TextArea rows={4} placeholder={field.placeholder} style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />;
      case 'number':
        return <InputNumber style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} placeholder={field.placeholder} />;
      case 'select':
        return (
          <Select placeholder={field.placeholder} style={{ width: '100%' }}>
            {field.options?.map((opt) => (
              <Select.Option key={opt} value={opt}>{opt}</Select.Option>
            ))}
          </Select>
        );
      case 'switch':
        return <Switch />;
      case 'tool_selector':
        return <ToolSelector multiple placeholder={field.placeholder} />;
      case 'tool_selector_single':
        return <ToolSelector multiple={false} placeholder={field.placeholder} />;
      default:
        return <Input placeholder={field.placeholder} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />;
    }
  };
  
  if (!node) return null;

  const nodeType = node.data.type || node.type;
  const schema = nodeConfigSchemas[nodeType] || [];

  return (
    <Drawer
      title={<span style={{ color: '#f0f0f5' }}>{node.data.label || nodeType} - 配置</span>}
      placement="right"
      width={480}
      open={visible}
      onClose={onClose}
      styles={{
        content: { background: 'rgba(18,18,26,0.95)', backdropFilter: 'blur(20px)' },
        header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
      }}
      footer={
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8' }}>取消</Button>
            <Button type="primary" onClick={handleSave} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none' }}>保存</Button>
          </Space>
        </div>
      }
    >
      <Form form={form} layout="vertical" 
        style={{ color: '#f0f0f5' }}
        labelCol={{ style: { color: '#f0f0f5' } }}
      >
        <Form.Item label="节点名称" name="label">
          <Input placeholder="节点显示名称" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
        </Form.Item>
        
        {nodeType === 'condition' ? (
          <ConditionBranchEditor branches={branches} onChange={setBranches} />
        ) : nodeType === 'llm' ? (
          <LLMConfigEditor config={llmConfig} onChange={setLLMConfig} />
        ) : (
          <Tabs 
            defaultActiveKey="config"
            style={{ color: '#f0f0f5' }}
            items={[
              {
                key: 'config',
                label: '配置',
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {schema.map((field) => (
                      <Form.Item key={field.key} label={field.label} name={field.key} valuePropName={field.type === 'switch' ? 'checked' : 'value'}>
                        {renderField(field)}
                      </Form.Item>
                    ))}
                    {schema.length === 0 && (
                      <div style={{ color: '#71717a', textAlign: 'center', padding: 20 }}>
                        该节点类型无需配置
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'advanced',
                label: '高级',
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <Form.Item label="重试策略 (JSON)" name="retry_policy">
                      <TextArea rows={4} placeholder='{"max_attempts": 3, "initial_interval": 1}' style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
                    </Form.Item>
                    <Form.Item label="缓存策略 (JSON)" name="cache_policy">
                      <TextArea rows={4} placeholder='{"enabled": true, "ttl": 300}' style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
                    </Form.Item>
                  </div>
                ),
              },
              {
                key: 'raw',
                label: '原始 JSON',
                children: (
                  <TextArea 
                    rows={20} 
                    value={JSON.stringify(node.data, null, 2)} 
                    style={{ fontFamily: 'monospace', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        updateNode(node.id, { data: parsed });
                      } catch {}
                    }}
                  />
                ),
              },
            ]}
          />
        )}
      </Form>
    </Drawer>
  );
};

export default NodeConfigPanel;
