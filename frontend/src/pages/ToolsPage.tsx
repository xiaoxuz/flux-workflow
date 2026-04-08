import React, { useState, useEffect } from 'react';
import { Button, Space, Table, Tag, Popconfirm, Modal, Form, Input, message, Drawer, Divider } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, ToolOutlined, CodeOutlined } from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import { toolsApi } from '../services/api';
import type { CustomTool, ToolCreate, ToolUpdate } from '../types/tools';

const { TextArea } = Input;

const DEFAULT_CODE = `def my_tool(param1: str, param2: int = 10) -> str:
    """工具描述（必需）
    
    Args:
        param1: 参数1说明
        param2: 参数2说明
    
    Returns:
        返回值说明
    """
    return f"结果: {param1}, {param2}"
`;

const ToolsPage: React.FC = () => {
  const [tools, setTools] = useState<CustomTool[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [testDrawerVisible, setTestDrawerVisible] = useState(false);
  const [currentTool, setCurrentTool] = useState<CustomTool | null>(null);
  const [form] = Form.useForm();
  const [code, setCode] = useState(DEFAULT_CODE);
  const [testArgs, setTestArgs] = useState('{}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    setLoading(true);
    try {
      const data = await toolsApi.list();
      setTools(data);
    } catch (error) {
      message.error('加载工具列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setCurrentTool(null);
    form.resetFields();
    setCode(DEFAULT_CODE);
    setEditModalVisible(true);
  };

  const handleEdit = (tool: CustomTool) => {
    setCurrentTool(tool);
    form.setFieldsValue({
      name: tool.name,
      display_name: tool.display_name,
      description: tool.description,
      return_type: tool.return_type,
    });
    setCode(tool.code);
    setEditModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const data: ToolCreate | ToolUpdate = {
        ...values,
        code,
        parameters: {},
        return_type: values.return_type || 'str',
      };

      if (currentTool) {
        await toolsApi.update(currentTool.id, data);
        message.success('更新成功');
      } else {
        await toolsApi.create(data as ToolCreate);
        message.success('创建成功');
      }

      setEditModalVisible(false);
      loadTools();
    } catch (error: any) {
      if (error.response?.data?.detail) {
        message.error(error.response.data.detail);
      } else if (error.errorFields) {
        message.error('请填写必填项');
      } else {
        message.error('保存失败');
      }
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await toolsApi.delete(id);
      message.success('删除成功');
      loadTools();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '删除失败');
    }
  };

  const handleTest = (tool: CustomTool) => {
    setCurrentTool(tool);
    setTestArgs('{}');
    setTestResult(null);
    setTestDrawerVisible(true);
  };

  const runTest = async () => {
    if (!currentTool) return;

    let args = {};
    try {
      args = JSON.parse(testArgs);
    } catch {
      message.error('参数 JSON 格式错误');
      return;
    }

    setTestLoading(true);
    try {
      const result = await toolsApi.test(currentTool.id, args);
      setTestResult(result);
    } catch (error) {
      message.error('测试失败');
    } finally {
      setTestLoading(false);
    }
  };

  const columns = [
    {
      title: '工具名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: CustomTool) => (
        <Space>
          <ToolOutlined style={{ color: record.is_builtin ? '#8b5cf6' : '#6366f1' }} />
          <span style={{ color: '#f0f0f5', fontWeight: 500 }}>{name}</span>
        </Space>
      ),
    },
    {
      title: '显示名称',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (name: string) => <span style={{ color: '#d4d4d8' }}>{name}</span>,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (desc: string) => <span style={{ color: '#71717a' }}>{desc || '-'}</span>,
    },
    {
      title: '类型',
      dataIndex: 'is_builtin',
      key: 'is_builtin',
      render: (isBuiltin: boolean) => (
        <Tag style={{ 
          background: isBuiltin ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.15)',
          border: isBuiltin ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(99,102,241,0.3)',
          color: isBuiltin ? '#a78bfa' : '#a5b4fc',
        }}>
          {isBuiltin ? '内置' : '自定义'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_: any, record: CustomTool) => (
        <Space>
          <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleTest(record)}>
            测试
          </Button>
          {!record.is_builtin && (
            <>
              <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
                编辑
              </Button>
              <Popconfirm title="确认删除?" onConfirm={() => handleDelete(record.id)}>
                <Button type="text" size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ color: '#f0f0f5', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>工具管理</div>
          <div style={{ color: '#71717a', fontSize: 13 }}>管理工作流可用的工具函数</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: 8 }}>
          新建工具
        </Button>
      </div>

      <Table
        dataSource={tools}
        rowKey="id"
        columns={columns}
        loading={loading}
        pagination={false}
      />

      <Modal
        title={<span style={{ color: '#f0f0f5' }}>{currentTool ? '编辑工具' : '新建工具'}</span>}
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
        width={800}
        styles={{
          content: { background: 'rgba(18,18,26,0.95)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          body: { padding: 16 },
        }}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              label="工具名称"
              name="name"
              rules={[{ required: true, message: '请输入工具名称' }, { pattern: /^[a-z_][a-z0-9_]*$/, message: '只能包含小写字母、数字和下划线' }]}
            >
              <Input disabled={!!currentTool} placeholder="my_tool" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
            </Form.Item>
            <Form.Item
              label="显示名称"
              name="display_name"
              rules={[{ required: true, message: '请输入显示名称' }]}
            >
              <Input placeholder="我的工具" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
            </Form.Item>
          </div>

          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="工具功能描述" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>

          <Form.Item label="返回类型" name="return_type">
            <Input placeholder="str" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>

          <Form.Item label={<span style={{ color: '#f0f0f5' }}>Python 代码 <CodeOutlined /></span>}>
            <div style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
              <Editor
                height="300px"
                language="python"
                theme="vs-dark"
                value={code}
                onChange={(value) => setCode(value || '')}
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={<span style={{ color: '#f0f0f5' }}>测试工具: {currentTool?.display_name}</span>}
        placement="right"
        width={500}
        open={testDrawerVisible}
        onClose={() => setTestDrawerVisible(false)}
        styles={{
          content: { background: 'rgba(18,18,26,0.95)', backdropFilter: 'blur(20px)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          body: { padding: 16 },
        }}
      >
        {currentTool && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>工具名称</div>
              <div style={{ color: '#f0f0f5', fontFamily: 'monospace' }}>{currentTool.name}</div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>描述</div>
              <div style={{ color: '#a1a1aa' }}>{currentTool.description || '-'}</div>
            </div>

            <Divider style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#f0f0f5', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>输入参数 (JSON)</div>
              <TextArea
                rows={6}
                value={testArgs}
                onChange={(e) => setTestArgs(e.target.value)}
                placeholder='{"param1": "value1"}'
                style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
              />
            </div>

            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={runTest}
              loading={testLoading}
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: 8, marginBottom: 16 }}
            >
              执行测试
            </Button>

            {testResult && (
              <div>
                <div style={{ color: '#f0f0f5', fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
                  执行结果
                  <Tag style={{ marginLeft: 8, background: testResult.error ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', border: testResult.error ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.3)', color: testResult.error ? '#fca5a5' : '#6ee7b7' }}>
                    {testResult.execution_time.toFixed(3)}s
                  </Tag>
                </div>
                {testResult.error ? (
                  <pre style={{ background: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 12, color: '#fca5a5', fontSize: 12, overflow: 'auto', maxHeight: 300, whiteSpace: 'pre-wrap' }}>
                    {testResult.error}
                  </pre>
                ) : (
                  <pre style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: 12, color: '#6ee7b7', fontSize: 12, overflow: 'auto', maxHeight: 300 }}>
                    {JSON.stringify(testResult.result, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default ToolsPage;