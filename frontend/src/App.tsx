import React, { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Button, Space, Modal, message, Table, Tag, Popconfirm, Drawer, Input } from 'antd';
import { PlusOutlined, SettingOutlined, ApiOutlined, LeftOutlined, SaveOutlined, HistoryOutlined, PlayCircleOutlined, DownloadOutlined, UploadOutlined, ExportOutlined, ToolOutlined, DatabaseOutlined, TeamOutlined } from '@ant-design/icons';
import type { Node } from '@xyflow/react';

import WorkflowCanvas from './components/WorkflowEditor/WorkflowCanvas';
import NodePalette from './components/WorkflowEditor/NodePalette';
import NodeConfigPanel from './components/NodeConfig/NodeConfigPanel';
import ExecutionDetail from './components/ExecutionDetail/ExecutionDetail';
import ToolsPage from './pages/ToolsPage';
import KnowledgeBasesPage from './pages/KnowledgeBasesPage';
import AgentsPage from './pages/AgentsPage';
import AgentChatPage from './pages/AgentChatPage';
import { workflowApi, executionApi } from './services/api';
import { useWorkflowStore } from './stores';
import type { Workflow, WorkflowNode, Execution } from './types';

const { Sider: LayoutSider, Content, Header } = Layout;
const { TextArea } = Input;

const App: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState<'list' | 'editor' | 'tools' | 'knowledge_bases' | 'agents'>('list');
  const [chattingAgentId, setChattingAgentId] = useState<string | null>(null);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [nodeConfigVisible, setNodeConfigVisible] = useState(false);
  const [traceDrawerVisible, setTraceDrawerVisible] = useState(false);
  const [showExecutionHistory, setShowExecutionHistory] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentWorkflow, setCurrentWorkflow] = useState<Workflow | null>(null);
  const [executeModalVisible, setExecuteModalVisible] = useState(false);
  const [executeInputData, setExecuteInputData] = useState('{}');
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [exportWorkflowData, setExportWorkflowData] = useState<Workflow | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { 
    workflows, 
    setWorkflows, 
    nodes, 
    edges,
    addNode,
    setNodes,
    setEdges,
    setCurrentWorkflow: setStoreCurrentWorkflow,
  } = useWorkflowStore();

  const loadWorkflows = async () => {
    try {
      const data = await workflowApi.list();
      setWorkflows(data);
    } catch (error) {
      console.error('Failed to load workflows:', error);
    }
  };

  useEffect(() => {
    loadWorkflows();
  }, []);

  const handleEditWorkflow = async (workflow: Workflow) => {
    setCurrentWorkflow(workflow);
    setStoreCurrentWorkflow(workflow);
    setSelectedWorkflowId(workflow.id);
    setNodes(workflow.graph?.nodes || []);
    setEdges(workflow.graph?.edges || []);
    setCurrentView('editor');
    
    try {
      const execs = await workflowApi.listExecutions(workflow.id);
      setExecutions(execs);
    } catch (error) {
      console.error('Failed to load executions:', error);
    }
  };

  const handleSaveWorkflow = async () => {
    if (!selectedWorkflowId) return;
    try {
      await workflowApi.update(selectedWorkflowId, { graph: { nodes, edges } });
      message.success('保存成功');
      loadWorkflows();
    } catch (error) {
      message.error('保存失败');
    }
  };

  const handlePublishWorkflow = async () => {
    if (!selectedWorkflowId) return;
    try {
      await workflowApi.publish(selectedWorkflowId);
      message.success('发布成功');
      loadWorkflows();
    } catch (error) {
      message.error('发布失败');
    }
  };

  const handleExecuteWorkflow = async () => {
    setExecuteModalVisible(true);
    setExecuteInputData('{}');
  };

  const handleConfirmExecute = async () => {
    if (!selectedWorkflowId) return;
    
    let inputData = {};
    try {
      inputData = JSON.parse(executeInputData);
    } catch {
      message.error('输入数据 JSON 格式错误');
      return;
    }
    
    setExecuteModalVisible(false);
    
    try {
      setIsExecuting(true);
      const result = await workflowApi.execute(selectedWorkflowId, inputData);
      setSelectedExecutionId(result.execution_id);
      setTraceDrawerVisible(true);
      const execs = await workflowApi.listExecutions(selectedWorkflowId);
      setExecutions(execs);
      message.success(`执行已启动，ID: ${result.execution_id.substring(0, 8)}...`);
      
      let pollCount = 0;
      const pollExecution = setInterval(async () => {
        pollCount++;
        if (pollCount > 300) {
          setIsExecuting(false);
          clearInterval(pollExecution);
          return;
        }
        try {
          const execData = await executionApi.get(result.execution_id);
          console.log('[Polling] Execution status:', execData.status);
          if (execData.status === 'success' || execData.status === 'failed' || execData.status === 'cancelled') {
            setIsExecuting(false);
            clearInterval(pollExecution);
            const updatedExecs = await workflowApi.listExecutions(selectedWorkflowId);
            setExecutions(updatedExecs);
            if (execData.status === 'failed') {
              message.error(`执行失败: ${execData.error || '未知错误'}`);
            }
          }
        } catch (e) {
          console.error('[Polling] Error:', e);
        }
      }, 2000);
    } catch (error: any) {
      message.error('执行失败: ' + (error.response?.data?.detail || error.message));
      setIsExecuting(false);
    }
  };

  const handleStopExecution = async () => {
    if (!selectedWorkflowId || !selectedExecutionId) return;
    try {
      await workflowApi.stopExecution(selectedWorkflowId, selectedExecutionId);
      message.success('执行已停止');
      setIsExecuting(false);
      const execs = await workflowApi.listExecutions(selectedWorkflowId);
      setExecutions(execs);
    } catch (error) {
      message.error('停止失败');
    }
  };

  const handleAddNode = (type: string) => {
    const labels: Record<string, string> = {
      start: '开始',
      llm: 'LLM',
      http: 'HTTP 请求',
      condition: '条件分支',
      loop: '循环',
      transform: '数据转换',
      tool: '工具调用',
      parallel: '并行执行',
      subgraph: '子图',
      human: '人工输入',
      end: '结束',
    };
    const newNode: WorkflowNode = {
      id: `node_${Date.now()}`,
      type,
      position: { x: 250, y: 150 + Math.random() * 100 },
      data: { label: labels[type] || type, type, config: {} },
    };
    addNode(newNode);
  };

  const handleNodeSelect = (node: Node) => {
    const workflowNode = nodes.find(n => n.id === node.id);
    if (workflowNode) {
      setSelectedNode(workflowNode);
      setNodeConfigVisible(true);
    }
  };

  const handleBackToList = () => {
    setCurrentView('list');
    setSelectedWorkflowId(null);
    setCurrentWorkflow(null);
    setStoreCurrentWorkflow(null);
    setNodes([]);
    setEdges([]);
  };

  const handleViewExecution = (executionId: string) => {
    setSelectedExecutionId(executionId);
    setShowExecutionHistory(false);
    setTraceDrawerVisible(true);
  };

  const handleCreateWorkflow = async () => {
    try {
      const name = prompt('请输入工作流名称');
      if (!name) return;
      const workflow = await workflowApi.create({ name, description: '' });
      message.success('创建成功');
      loadWorkflows();
      handleEditWorkflow(workflow);
    } catch (error) {
      message.error('创建失败');
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    try {
      await workflowApi.delete(id);
      message.success('删除成功');
      loadWorkflows();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleOpenExportModal = (workflow?: Workflow) => {
    setExportWorkflowData(workflow || currentWorkflow);
    setExportModalVisible(true);
  };

  const convertToFluxAgentConfig = (graph: { nodes: any[]; edges: any[] }) => {
    const NODE_TYPE_MAP: Record<string, string> = {
      llm: 'LLMNode',
      http: 'HTTPRequestNode',
      condition: 'ConditionNode',
      loop: 'LoopNode',
      transform: 'TransformNode',
      tool: 'ToolNode',
      parallel: 'ParallelNode',
      subgraph: 'SubgraphNode',
      human: 'HumanInputNode',
    };

    const nodes = graph.nodes || [];
    const edges = graph.edges || [];

    let startNodeId: string | null = null;
    const endNodeIds: Set<string> = new Set();

    nodes.forEach(node => {
      if (node.type === 'start') startNodeId = node.id;
      if (node.type === 'end') endNodeIds.add(node.id);
    });

    const fluxNodes = nodes
      .filter(node => !['start', 'end'].includes(node.type))
      .map(node => ({
        id: node.id,
        type: NODE_TYPE_MAP[node.type] || node.type,
        config: node.data?.config || {},
      }));

    const conditionMaps: Record<string, Record<string, string>> = {};
    const fluxEdges: any[] = [];

    edges.forEach(edge => {
      let source = edge.source;
      let target = edge.target;
      const sourceHandle = edge.sourceHandle;

      if (source === startNodeId) source = 'START';
      if (endNodeIds.has(target)) target = 'END';

      const sourceNode = nodes.find(n => n.id === edge.source);
      
      if (sourceNode?.type === 'condition' && sourceHandle) {
        if (!conditionMaps[source]) conditionMaps[source] = {};
        conditionMaps[source][target] = target;
        
        const fluxNode = fluxNodes.find(n => n.id === source);
        if (fluxNode) {
          const branches = fluxNode.config.branches || [];
          const match = sourceHandle.match(/branch_(\d+)/);
          if (match) {
            const idx = parseInt(match[1]);
            if (branches[idx]) {
              branches[idx].target = target;
              fluxNode.config.branches = branches;
            }
          }
        }
      } else {
        if (!conditionMaps[source]) {
          fluxEdges.push({ from: source, to: target });
        }
      }
    });

    Object.entries(conditionMaps).forEach(([source, conditionMap]) => {
      fluxEdges.push({ from: source, condition_map: conditionMap });
    });

    return {
      workflow: { name: exportWorkflowData?.name || 'workflow' },
      nodes: fluxNodes,
      edges: fluxEdges,
    };
  };

  const handleExport = (type: 'full' | 'flux-agent') => {
    const workflow = exportWorkflowData;
    if (!workflow) return;

    let exportData: any;
    let filename: string;

    if (type === 'full') {
      exportData = {
        id: workflow.id,
        name: workflow.name,
        description: workflow.description,
        graph: workflow.graph,
        version: workflow.version,
        status: workflow.status,
        exportedAt: new Date().toISOString(),
      };
      filename = `${workflow.name || 'workflow'}_full.json`;
    } else {
      exportData = convertToFluxAgentConfig(workflow.graph);
      filename = `${workflow.name || 'workflow'}_flux.json`;
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setExportModalVisible(false);
    message.success('导出成功');
  };

  const handleImportWorkflow = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.graph) {
        message.error('无效的工作流文件，缺少 graph 字段');
        return;
      }
      
      const workflow = await workflowApi.create({
        name: data.name || file.name.replace('.json', ''),
        description: data.description || '',
        graph: data.graph,
      });
      
      message.success('导入成功');
      loadWorkflows();
      handleEditWorkflow(workflow);
    } catch (error) {
      message.error('导入失败，请检查文件格式');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const menuItems = [
    { key: 'workflows', icon: <ApiOutlined />, label: '工作流' },
    { key: 'agents', icon: <TeamOutlined />, label: 'Agent 助手' },
    { key: 'tools', icon: <ToolOutlined />, label: '工具管理' },
    { key: 'knowledge_bases', icon: <DatabaseOutlined />, label: '知识库' },
  ];

  const handleMenuClick = (key: string) => {
    if (key === 'workflows') {
      setCurrentView('list');
    } else if (key === 'tools') {
      setCurrentView('tools');
    } else if (key === 'knowledge_bases') {
      setCurrentView('knowledge_bases');
    } else if (key === 'agents') {
      setCurrentView('agents');
    }
  };

  const executionColumns = [
    { title: 'ID', dataIndex: 'id', key: 'id', render: (id: string) => <span style={{ color: '#a5b4fc', fontFamily: 'monospace', fontSize: 12 }}>{id.substring(0, 12)}</span> },
    { title: '状态', dataIndex: 'status', key: 'status', render: (s: string) => {
      const statusConfig: Record<string, { bg: string; border: string; color: string }> = {
        pending: { bg: 'rgba(113,113,122,0.15)', border: 'rgba(113,113,122,0.3)', color: '#a1a1aa' },
        running: { bg: 'rgba(59,130,246,0.15)', border: 'rgba(59,130,246,0.3)', color: '#60a5fa' },
        success: { bg: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.3)', color: '#4ade80' },
        failed: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.3)', color: '#f87171' },
        cancelled: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.3)', color: '#facc15' },
      };
      const cfg = statusConfig[s] || statusConfig.pending;
      return <Tag style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>{s}</Tag>;
    }},
    { title: '耗时', dataIndex: 'duration_ms', key: 'duration_ms', render: (v?: number) => <span style={{ color: '#a1a1aa' }}>{v ? `${(v/1000).toFixed(2)}s` : '-'}</span> },
    { title: '创建时间', dataIndex: 'created_at', key: 'created_at', render: (t: string) => <span style={{ color: '#71717a' }}>{new Date(t).toLocaleString('zh-CN')}</span> },
    { title: '操作', key: 'action', render: (_: any, r: Execution) => (
      <Button type="link" size="small" onClick={() => handleViewExecution(r.id)}>查看</Button>
    )},
  ];

  return (
    <Layout style={{ minHeight: '100vh', background: '#0a0a0f' }}>
      {currentView !== 'editor' && (
        <LayoutSider width={220} style={{ background: 'linear-gradient(180deg, #12121a 0%, #0a0a0f 100%)', borderRight: '1px solid rgba(255,255,255,0.06)' }} collapsible collapsed={collapsed} trigger={null}>
          <div style={{ padding: '24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {!collapsed && <div style={{ color: '#f0f0f5', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}><span style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Flux</span>Workflow</div>}
            <Button type="text" icon={collapsed ? <ApiOutlined /> : <ApiOutlined />} onClick={() => setCollapsed(!collapsed)} style={{ color: '#71717a' }} />
          </div>
          <Menu 
            mode="inline" 
            selectedKeys={[currentView]} 
            style={{ background: 'transparent', borderRight: 'none', marginTop: 12, color: '#a1a1aa' }} 
            items={menuItems}
            onClick={(e) => handleMenuClick(e.key)}
          />
        </LayoutSider>
      )}

      <Layout>
        <Header style={{ background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(20px)', padding: '0 24px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>
          {currentView === 'editor' ? (
            <Button type="text" icon={<LeftOutlined />} onClick={handleBackToList} style={{ color: '#a1a1aa', fontSize: 14 }}>返回列表</Button>
          ) : <div />}
          <Button type="text" icon={<SettingOutlined />} style={{ color: '#71717a' }}>设置</Button>
        </Header>

        <Content style={{ background: '#0a0a0f', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>
          {currentView === 'list' ? (
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#f0f0f5', fontSize: 16 }}>工作流列表</span>
                <Space>
                  <Button icon={<UploadOutlined />} onClick={handleImportWorkflow} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8', borderRadius: 8 }}>导入</Button>
                  <Button type="primary" icon={<PlusOutlined />} onClick={() => handleCreateWorkflow()} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: 8 }}>新建工作流</Button>
                </Space>
              </div>
              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />
              <Table 
                dataSource={workflows} 
                rowKey="id"
                columns={[
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
                  { title: '操作', key: 'action', width: 200, render: (_: any, r: Workflow) => (
                    <Space>
                      <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleEditWorkflow(r)}>编辑</Button>
                      <Button type="link" size="small" icon={<ExportOutlined />} onClick={() => handleOpenExportModal(r)}>导出</Button>
                      <Popconfirm title="确认删除?" onConfirm={() => handleDeleteWorkflow(r.id)}>
                        <Button type="text" size="small" danger>删除</Button>
                      </Popconfirm>
                    </Space>
                  )},
                ]}
              />
            </div>
          ) : currentView === 'tools' ? (
            <ToolsPage />
          ) : currentView === 'knowledge_bases' ? (
            <KnowledgeBasesPage />
          ) : currentView === 'agents' ? (
            chattingAgentId ? (
              <AgentChatPage 
                agentId={chattingAgentId} 
                onBack={() => setChattingAgentId(null)} 
              />
            ) : (
              <AgentsPage onChat={(agentId) => setChattingAgentId(agentId)} />
            )
          ) : (
            <div style={{ display: 'flex', height: 'calc(100vh - 56px)', background: 'radial-gradient(ellipse at 50% 0%, rgba(99,102,241,0.08) 0%, transparent 60%)' }}>
              <NodePalette onAddNode={handleAddNode} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <Space>
                    <span style={{ color: '#f0f0f5', fontSize: 16, fontWeight: 500 }}>{currentWorkflow?.name}</span>
                    <Tag style={{ background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', borderRadius: 6, padding: '2px 10px' }}>v{currentWorkflow?.version}</Tag>
                  </Space>
                  <Space>
                    <Button onClick={handleSaveWorkflow} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8', borderRadius: 8 }}><SaveOutlined /> 保存</Button>
                    <Button onClick={() => handleOpenExportModal()} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8', borderRadius: 8 }}><DownloadOutlined /> 导出</Button>
                    <Button onClick={handlePublishWorkflow} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8', borderRadius: 8 }}>发布</Button>
                    {isExecuting ? (
                      <Button danger onClick={handleStopExecution} style={{ borderRadius: 8 }}>停止</Button>
                    ) : (
                      <Button type="primary" onClick={handleExecuteWorkflow} disabled={currentWorkflow?.status !== 'published'} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: 8, boxShadow: '0 4px 14px rgba(99,102,241,0.25)' }}>执行</Button>
                    )}
                    <Button 
                      icon={<HistoryOutlined />} 
                      onClick={() => { 
                        setShowExecutionHistory(true);
                        setTraceDrawerVisible(true); 
                      }}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8', borderRadius: 8 }}
                    >
                      记录
                    </Button>
                  </Space>
                </div>
                <div style={{ flex: 1 }}><WorkflowCanvas onNodeSelect={handleNodeSelect} /></div>
              </div>
            </div>
          )}
        </Content>
      </Layout>

      <NodeConfigPanel visible={nodeConfigVisible} node={selectedNode} onClose={() => { setNodeConfigVisible(false); setSelectedNode(null); }} />

      <Modal
        title={<span style={{ color: '#f0f0f5' }}>执行工作流</span>}
        open={executeModalVisible}
        onCancel={() => setExecuteModalVisible(false)}
        onOk={handleConfirmExecute}
        okText="执行"
        cancelText="取消"
        styles={{
          content: { background: 'rgba(18,18,26,0.95)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          body: { padding: 16 },
        }}
      >
        <div style={{ marginBottom: 12, color: '#a1a1aa', fontSize: 13 }}>
          输入初始数据（JSON 格式），节点可通过 <code style={{ color: '#a5b4fc' }}>{"${data.xxx}"}</code> 引用
        </div>
        <TextArea
          rows={10}
          value={executeInputData}
          onChange={(e) => setExecuteInputData(e.target.value)}
          placeholder='{"input": "你好", "user_id": "123"}'
          style={{ fontFamily: 'monospace', fontSize: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
        />
      </Modal>

      <Drawer 
        title={<span style={{ color: '#f0f0f5' }}>执行详情</span>}
        placement="right" 
        width={600} 
        open={traceDrawerVisible} 
        onClose={() => setTraceDrawerVisible(false)}
        styles={{
          content: { background: 'rgba(18,18,26,0.95)', backdropFilter: 'blur(20px)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          body: { padding: 0 },
        }}
      >
        {!showExecutionHistory && selectedExecutionId && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Button type="link" onClick={() => setShowExecutionHistory(true)} style={{ color: '#a1a1aa', padding: 0 }}>
              ← 返回执行历史
            </Button>
          </div>
        )}
        {showExecutionHistory ? (
          <Table dataSource={executions} rowKey="id" columns={executionColumns} size="small" pagination={false} />
        ) : (
          <ExecutionDetail executionId={selectedExecutionId} />
        )}
      </Drawer>

      <Modal
        title={<span style={{ color: '#f0f0f5' }}>导出工作流</span>}
        open={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        footer={null}
        styles={{
          content: { background: 'rgba(18,18,26,0.95)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          body: { padding: 16 },
        }}
      >
        <div style={{ marginBottom: 16, color: '#a1a1aa', fontSize: 13 }}>
          选择导出格式：
        </div>
        <Space direction="vertical" style={{ width: '100%' }} size={12}>
          <div 
            onClick={() => handleExport('full')}
            style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: 8, 
              padding: 16,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.1)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <div style={{ color: '#f0f0f5', fontWeight: 500, marginBottom: 4 }}>完整工作流 JSON</div>
            <div style={{ color: '#71717a', fontSize: 12 }}>包含工作流名称、描述、版本、状态、画布节点和连线等完整信息，可用于备份和导入</div>
          </div>
          <div 
            onClick={() => handleExport('flux-agent')}
            style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.1)', 
              borderRadius: 8, 
              padding: 16,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,0.1)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.3)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.1)';
            }}
          >
            <div style={{ color: '#f0f0f5', fontWeight: 500, marginBottom: 4 }}>Flux-Agent 执行 JSON</div>
            <div style={{ color: '#71717a', fontSize: 12 }}>仅包含 flux-agent 执行所需的配置，可直接用于 WorkflowRunner 执行</div>
          </div>
        </Space>
      </Modal>
    </Layout>
  );
};

export default App;