import React, { useState, useEffect } from 'react';
import { Select, Spin, Tag, Empty } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { toolsApi } from '../../services/api';
import type { CustomTool } from '../../types/tools';

interface ToolSelectorProps {
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
}

const ToolSelector: React.FC<ToolSelectorProps> = ({
  value,
  onChange,
  multiple = false,
  placeholder = '选择工具',
}) => {
  const [tools, setTools] = useState<CustomTool[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTools();
  }, []);

  const loadTools = async () => {
    setLoading(true);
    try {
      const data = await toolsApi.list();
      setTools(data);
    } catch (error) {
      console.error('Failed to load tools:', error);
    } finally {
      setLoading(false);
    }
  };

  const groupedTools = tools.reduce((acc, tool) => {
    const key = tool.is_builtin ? 'builtin' : 'custom';
    if (!acc[key]) acc[key] = [];
    acc[key].push(tool);
    return acc;
  }, {} as Record<string, CustomTool[]>);

  return (
    <Select
      mode={multiple ? 'multiple' : undefined}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      loading={loading}
      style={{ width: '100%' }}
      optionFilterProp="label"
      showSearch
      filterOption={(input, option) => {
        const tool = tools.find(t => t.name === option?.value);
        return !!(
          tool?.name.toLowerCase().includes(input.toLowerCase()) ||
          tool?.display_name.toLowerCase().includes(input.toLowerCase()) ||
          tool?.description?.toLowerCase().includes(input.toLowerCase())
        );
      }}
      notFoundContent={loading ? <Spin size="small" /> : <Empty description="暂无工具" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
    >
      {Object.entries(groupedTools).map(([group, groupTools]) => (
        <Select.OptGroup key={group} label={group === 'builtin' ? '内置工具' : '自定义工具'}>
          {groupTools.map(tool => (
            <Select.Option 
              key={tool.id} 
              value={tool.name}
              label={tool.display_name}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ToolOutlined style={{ color: tool.is_builtin ? '#8b5cf6' : '#6366f1' }} />
                <span style={{ color: '#f0f0f5' }}>{tool.display_name}</span>
                <Tag 
                  style={{ 
                    marginLeft: 'auto',
                    background: tool.is_builtin ? 'rgba(139,92,246,0.15)' : 'rgba(99,102,241,0.15)',
                    border: tool.is_builtin ? '1px solid rgba(139,92,246,0.3)' : '1px solid rgba(99,102,241,0.3)',
                    color: tool.is_builtin ? '#a78bfa' : '#a5b4fc',
                    fontSize: 10,
                    padding: '0 4px',
                    lineHeight: '16px',
                  }}
                >
                  {tool.name}
                </Tag>
              </div>
              {tool.description && (
                <div style={{ color: '#71717a', fontSize: 11, marginTop: 2, paddingLeft: 22 }}>
                  {tool.description.substring(0, 50)}{tool.description.length > 50 ? '...' : ''}
                </div>
              )}
            </Select.Option>
          ))}
        </Select.OptGroup>
      ))}
    </Select>
  );
};

export default ToolSelector;