import React, { useState, useEffect } from 'react';
import { Spin } from 'antd';
import {
  ApiOutlined,
  TeamOutlined,
  ToolOutlined,
  RocketOutlined,
  DatabaseOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import { workflowApi, toolsApi, knowledgeBaseApi, agentsApi, skillsApi } from '../services/api';

interface DashboardPageProps {
  onNavigate: (view: 'list' | 'tools' | 'knowledge_bases' | 'agents' | 'skills') => void;
}

const modules = [
  { key: 'list' as const, label: '工作流', icon: <ApiOutlined />, gradient: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', desc: '可视化编排业务工作流', countKey: 'workflows' as const },
  { key: 'agents' as const, label: 'Agent', icon: <TeamOutlined />, gradient: 'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)', desc: '智能 Agent 助手' },
  { key: 'tools' as const, label: '工具', icon: <ToolOutlined />, gradient: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)', desc: '自定义工具注册与管理' },
  { key: 'skills' as const, label: 'Skill', icon: <RocketOutlined />, gradient: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)', desc: 'Agent 技能包管理' },
  { key: 'knowledge_bases' as const, label: '知识库', icon: <DatabaseOutlined />, gradient: 'linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)', desc: 'RAG 知识库与检索' },
];

const StatCard: React.FC<{ icon: React.ReactNode; label: string; count: number }> = ({ icon, label, count }) => (
  <div style={{ flex: 1, minWidth: 0, textAlign: 'center', padding: '16px 8px' }}>
    <div style={{ fontSize: 14, marginBottom: 4 }}>{React.cloneElement(icon as React.ReactElement, { style: { color: '#a1a1aa' } })}</div>
    <div style={{ color: '#71717a', fontSize: 12, marginBottom: 2 }}>{label}</div>
    <div style={{ color: '#f0f0f5', fontSize: 28, fontWeight: 700, lineHeight: 1 }}>{count}</div>
    <div style={{ color: '#4ade80', fontSize: 11, marginTop: 4 }}><ArrowUpOutlined style={{ fontSize: 10, marginRight: 2 }} />+0</div>
  </div>
);

const NavCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  desc: string;
  count: number;
  gradient: string;
  onClick: () => void;
}> = ({ icon, label, desc, count, gradient, onClick }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        minWidth: 0,
        background: 'rgba(255,255,255,0.02)',
        borderRadius: 12,
        padding: '24px 20px',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        border: `1px solid ${hovered ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.06)'}`,
        transform: hovered ? 'translateY(-4px)' : 'none',
        boxShadow: hovered ? '0 8px 32px rgba(99,102,241,0.15)' : 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* Top gradient line */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        background: gradient,
        opacity: hovered ? 1 : 0.7,
        transition: 'opacity 0.3s',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `${gradient}20`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}>
          {icon}
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 20,
          padding: '4px 12px',
          fontSize: 13,
          color: '#a1a1aa',
          fontWeight: 500,
        }}>
          {count}
        </div>
      </div>

      <div style={{ color: '#f0f0f5', fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ color: '#71717a', fontSize: 13, lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
};

const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const results = await Promise.allSettled([
          workflowApi.list(),
          agentsApi.list(),
          toolsApi.list(),
          skillsApi.list(),
          knowledgeBaseApi.list(),
        ]);
        const keys = ['workflows', 'agents', 'tools', 'skills', 'knowledge_bases'];
        const newCounts: Record<string, number> = {};
        results.forEach((r, i) => {
          newCounts[keys[i]] = r.status === 'fulfilled' ? (r.value as any[]).length : 0;
        });
        setCounts(newCounts);
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div style={{ padding: 24 }}>
      {/* Hero Section */}
      <div style={{
        background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 60%)',
        border: '1px solid rgba(99,102,241,0.15)',
        borderRadius: 16,
        padding: '48px 32px 36px',
        marginBottom: 24,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: 'linear-gradient(90deg, transparent, #6366f1, #8b5cf6, #6366f1, transparent)',
        }} />
        <div style={{
          color: '#f0f0f5',
          fontSize: 42,
          fontWeight: 800,
          letterSpacing: '-0.03em',
          marginBottom: 12,
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}>
          Flux-Agent
        </div>
        <div style={{
          color: '#a1a1aa',
          fontSize: 16,
          lineHeight: 1.6,
          maxWidth: 600,
          margin: '0 auto',
        }}>
          面向生产环境的 LLM Agent 与 Workflow 编排框架
        </div>
        <div style={{
          color: '#71717a',
          fontSize: 14,
          marginTop: 16,
        }}>
          {new Date().getHours() < 12 ? '上午好，' : new Date().getHours() < 18 ? '下午好，' : '晚上好，'}开始今天的工作吧
        </div>
      </div>

      {/* Stats bar */}
      <div style={{
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '12px 0',
        marginBottom: 24,
        display: 'flex',
        justifyContent: 'space-around',
      }}>
        <StatCard icon={<ApiOutlined />} label="工作流" count={counts.workflows || 0} />
        <StatCard icon={<TeamOutlined />} label="Agent" count={counts.agents || 0} />
        <StatCard icon={<ToolOutlined />} label="工具" count={counts.tools || 0} />
        <StatCard icon={<RocketOutlined />} label="Skill" count={counts.skills || 0} />
        <StatCard icon={<DatabaseOutlined />} label="知识库" count={counts.knowledge_bases || 0} />
      </div>

      {/* Title */}
      <div style={{ color: '#f0f0f5', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>功能导航</div>
      <div style={{ color: '#71717a', fontSize: 13, marginBottom: 20 }}>快速访问各个模块</div>

      {/* Nav cards */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spin size="large" />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
          {modules.map((m) => (
            <NavCard
              key={m.key}
              icon={React.cloneElement(m.icon as React.ReactElement, { style: { color: m.gradient.includes('#6366f1') ? '#a5b4fc' : m.gradient.includes('#f43f5e') ? '#fda4af' : m.gradient.includes('#f59e0b') ? '#fcd34d' : m.gradient.includes('#10b981') ? '#6ee7b7' : '#93c5fd' } })}
              label={m.label}
              desc={m.desc}
              count={counts[m.countKey || m.key] || 0}
              gradient={m.gradient}
              onClick={() => onNavigate(m.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
