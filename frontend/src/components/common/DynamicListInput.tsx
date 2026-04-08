import React from 'react';
import { Input, Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';

interface DynamicListInputProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
  maxItems?: number;
}

const DynamicListInput: React.FC<DynamicListInputProps> = ({
  value = [],
  onChange,
  placeholder = '输入内容',
  maxItems = 50,
}) => {
  const handleAdd = () => {
    if (value.length < maxItems) {
      onChange?.([...value, '']);
    }
  };

  const handleChange = (index: number, newValue: string) => {
    const newList = [...value];
    newList[index] = newValue;
    onChange?.(newList);
  };

  const handleDelete = (index: number) => {
    const newList = value.filter((_, i) => i !== index);
    onChange?.(newList);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {value.map((item, index) => (
        <Space key={index} style={{ width: '100%' }}>
          <Input
            value={item}
            onChange={(e) => handleChange(index, e.target.value)}
            placeholder={placeholder}
            style={{ 
              flex: 1, 
              background: 'rgba(255,255,255,0.05)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              color: '#f0f0f5' 
            }}
          />
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(index)}
            style={{ color: '#f87171' }}
          />
        </Space>
      ))}
      <Button
        type="dashed"
        icon={<PlusOutlined />}
        onClick={handleAdd}
        disabled={value.length >= maxItems}
        style={{ 
          borderColor: 'rgba(255,255,255,0.1)', 
          color: '#a1a1aa',
          width: '100%',
        }}
      >
        添加
      </Button>
    </div>
  );
};

export default DynamicListInput;
