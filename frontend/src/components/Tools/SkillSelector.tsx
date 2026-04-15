import React, { useState, useEffect } from 'react';
import { Select, Spin, Tag, Empty } from 'antd';
import { RocketOutlined } from '@ant-design/icons';
import { skillsApi } from '../../services/api';
import type { SkillSummary } from '../../types/skills';

interface SkillSelectorProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  placeholder?: string;
}

const SkillSelector: React.FC<SkillSelectorProps> = ({
  value,
  onChange,
  placeholder = '选择 Skill',
}) => {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const data = await skillsApi.list();
      setSkills(data);
    } catch (error) {
      console.error('Failed to load skills:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Select
      mode="multiple"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      loading={loading}
      style={{ width: '100%' }}
      optionFilterProp="label"
      showSearch
      filterOption={(input, option) => {
        const skill = skills.find(s => s.name === option?.value);
        return !!(
          skill?.name.toLowerCase().includes(input.toLowerCase()) ||
          skill?.description.toLowerCase().includes(input.toLowerCase())
        );
      }}
      notFoundContent={
        loading ? (
          <Spin size="small" />
        ) : (
          <Empty description="暂无 Skill" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        )
      }
    >
      {skills.map(skill => (
        <Select.Option key={skill.name} value={skill.name} label={skill.name}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RocketOutlined style={{ color: skill.disable_model_invocation ? '#f59e0b' : '#10b981' }} />
            <span style={{ color: '#f0f0f5' }}>{skill.name}</span>
            {skill.disable_model_invocation && (
              <Tag
                style={{
                  marginLeft: 'auto',
                  background: 'rgba(245,158,11,0.15)',
                  border: '1px solid rgba(245,158,11,0.3)',
                  color: '#fbbf24',
                  fontSize: 10,
                  padding: '0 4px',
                  lineHeight: '16px',
                }}
              >
                手动触发
              </Tag>
            )}
          </div>
          {skill.description && (
            <div style={{ color: '#71717a', fontSize: 11, marginTop: 2, paddingLeft: 22 }}>
              {skill.description.substring(0, 50)}
              {skill.description.length > 50 ? '...' : ''}
            </div>
          )}
        </Select.Option>
      ))}
    </Select>
  );
};

export default SkillSelector;
