import React, { useState } from 'react';
import { Form, Select, Input, Button, Space, Card, Tag, message as antdMessage } from 'antd';
import { PlusOutlined, DeleteOutlined, ExperimentOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { mcpServersApi } from '../../services/api';
import type { MCPServerConfig } from '../../types/agents';

const { TextArea } = Input;

interface MCPServerConfigPanelProps {
  value?: MCPServerConfig[];
  onChange?: (value: MCPServerConfig[]) => void;
}

const MCPServerConfigPanel: React.FC<MCPServerConfigPanelProps> = ({ value = [], onChange }) => {
  const [testing, setTesting] = useState<Record<number, boolean>>({});
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; tools?: string[]; error?: string }>>({});

  const handleChange = (newValue: MCPServerConfig[]) => {
    onChange?.(newValue);
  };

  const handleAdd = () => {
    const newServer: MCPServerConfig = {
      name: '',
      transport: 'stdio',
      command: '',
      args: [],
      url: '',
      tool_name_prefix: '',
    };
    handleChange([...value, newServer]);
  };

  const handleRemove = (index: number) => {
    handleChange(value.filter((_, i) => i !== index));
  };

  const handleFieldChange = (index: number, field: keyof MCPServerConfig, fieldValue: any) => {
    const updated = value.map((item, i) => {
      if (i === index) {
        if (field === 'transport') {
          return { ...item, transport: fieldValue, args: item.args || [] };
        }
        return { ...item, [field]: fieldValue };
      }
      return item;
    });
    handleChange(updated);
  };

  const handleArgsChange = (index: number, argsText: string) => {
    const args = argsText.split('\n').filter(a => a.trim());
    handleFieldChange(index, 'args', args);
  };

  const handleEnvChange = (index: number, envText: string) => {
    const env: Record<string, string> = {};
    envText.split('\n').forEach(line => {
      const eqIndex = line.indexOf('=');
      if (eqIndex > 0) {
        env[line.slice(0, eqIndex).trim()] = line.slice(eqIndex + 1).trim();
      }
    });
    handleFieldChange(index, 'env', env);
  };

  const handleTest = async (index: number) => {
    const config = value[index];
    if (!config.name) {
      antdMessage.warning('请先填写服务器名称');
      return;
    }
    setTesting(prev => ({ ...prev, [index]: true }));
    try {
      const result = await mcpServersApi.test(config);
      setTestResults(prev => ({ ...prev, [index]: result }));
      if (result.success) {
        antdMessage.success(`测试成功，获取 ${result.tools.length} 个工具`);
      } else {
        antdMessage.error(`测试失败: ${result.error}`);
      }
    } catch {
      antdMessage.error('测试请求失败');
    } finally {
      setTesting(prev => ({ ...prev, [index]: false }));
    }
  };

  return (
    <div>
      {value.map((server, index) => {
        const argsText = (server.args || []).join('\n');
        const envText = Object.entries(server.env || {}).map(([k, v]) => `${k}=${v}`).join('\n');
        const testResult = testResults[index];

        return (
          <Card
            key={index}
            size="small"
            style={{ marginBottom: 8, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
            title={
              <Space>
                <span style={{ color: '#f0f0f5' }}>{server.name || `服务器 ${index + 1}`}</span>
                <Tag color={server.transport === 'stdio' ? 'blue' : server.transport === 'http' ? 'green' : 'purple'}>
                  {server.transport}
                </Tag>
                {testResult && (
                  testResult.success
                    ? <Tag icon={<CheckCircleOutlined />} color="success">已连接 ({testResult.tools?.length} tools)</Tag>
                    : <Tag icon={<CloseCircleOutlined />} color="error">{testResult.error}</Tag>
                )}
              </Space>
            }
            extra={
              <Space>
                <Button
                  type="text"
                  size="small"
                  icon={<ExperimentOutlined />}
                  loading={testing[index]}
                  onClick={() => handleTest(index)}
                  style={{ color: '#60a5fa' }}
                >
                  测试
                </Button>
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleRemove(index)}
                />
              </Space>
            }
          >
            <Form layout="vertical" size="small">
              <Form.Item label="名称" required>
                <Input
                  value={server.name}
                  onChange={e => handleFieldChange(index, 'name', e.target.value)}
                  placeholder="my-mcp-server"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
                />
              </Form.Item>

              <Form.Item label="传输方式">
                <Select
                  value={server.transport}
                  onChange={v => handleFieldChange(index, 'transport', v)}
                  style={{ width: '100%' }}
                >
                  <Select.Option value="stdio">stdio (本地进程)</Select.Option>
                  <Select.Option value="http">HTTP (远程服务)</Select.Option>
                  <Select.Option value="streamable_http">Streamable HTTP</Select.Option>
                </Select>
              </Form.Item>

              {server.transport === 'stdio' && (
                <>
                  <Form.Item label="命令" required>
                    <Input
                      value={server.command || ''}
                      onChange={e => handleFieldChange(index, 'command', e.target.value)}
                      placeholder="npx / python / node ..."
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
                    />
                  </Form.Item>
                  <Form.Item label="参数 (每行一个)">
                    <TextArea
                      value={argsText}
                      onChange={e => handleArgsChange(index, e.target.value)}
                      rows={2}
                      placeholder="-m\nmcp_server"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
                    />
                  </Form.Item>
                  <Form.Item label="环境变量 (每行一个 KEY=VALUE)">
                    <TextArea
                      value={envText}
                      onChange={e => handleEnvChange(index, e.target.value)}
                      rows={2}
                      placeholder="API_KEY=xxx"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
                    />
                  </Form.Item>
                </>
              )}

              {(server.transport === 'http' || server.transport === 'streamable_http') && (
                <>
                  <Form.Item label="URL" required>
                    <Input
                      value={server.url || ''}
                      onChange={e => handleFieldChange(index, 'url', e.target.value)}
                      placeholder="http://localhost:8000/mcp"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
                    />
                  </Form.Item>
                  <Form.Item label="请求头 (每行一个 KEY: VALUE)">
                    <TextArea
                      value={Object.entries(server.headers || {}).map(([k, v]) => `${k}: ${v}`).join('\n')}
                      onChange={e => {
                        const headers: Record<string, string> = {};
                        e.target.value.split('\n').forEach(line => {
                          const colonIndex = line.indexOf(':');
                          if (colonIndex > 0) {
                            headers[line.slice(0, colonIndex).trim()] = line.slice(colonIndex + 1).trim();
                          }
                        });
                        handleFieldChange(index, 'headers', headers);
                      }}
                      rows={2}
                      placeholder="Authorization: Bearer xxx&#10;Cookie: session=abc"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
                    />
                  </Form.Item>
                </>
              )}

              <Form.Item label="工具名前缀">
                <Input
                  value={server.tool_name_prefix || ''}
                  onChange={e => handleFieldChange(index, 'tool_name_prefix', e.target.value)}
                  placeholder="可选"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
                />
              </Form.Item>
            </Form>
          </Card>
        );
      })}

      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)', color: '#a5b4fc' }}
      >
        添加 MCP 服务器
      </Button>
    </div>
  );
};

export default MCPServerConfigPanel;
