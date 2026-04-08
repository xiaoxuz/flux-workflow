import React, { useCallback, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, Connection, Edge, Node, NodeTypes, applyNodeChanges, applyEdgeChanges, OnNodesChange, OnEdgesChange } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflowStore } from '../../stores';
import LLMNodeComponent from './nodes/LLMNode';
import AgentNodeComponent from './nodes/AgentNode';
import HttpNodeComponent from './nodes/HttpNode';
import ConditionNodeComponent from './nodes/ConditionNode';
import StartNodeComponent from './nodes/StartNode';
import LoopNodeComponent from './nodes/LoopNode';
import TransformNodeComponent from './nodes/TransformNode';
import JsonNodeComponent from './nodes/JsonNode';
import ToolNodeComponent from './nodes/ToolNode';
import ParallelNodeComponent from './nodes/ParallelNode';
import SubgraphNodeComponent from './nodes/SubgraphNode';
import HumanNodeComponent from './nodes/HumanNode';
import EndNodeComponent from './nodes/EndNode';

const nodeTypes: NodeTypes = {
  llm: LLMNodeComponent,
  agent: AgentNodeComponent,
  http: HttpNodeComponent,
  condition: ConditionNodeComponent,
  start: StartNodeComponent,
  loop: LoopNodeComponent,
  transform: TransformNodeComponent,
  json: JsonNodeComponent,
  tool: ToolNodeComponent,
  parallel: ParallelNodeComponent,
  subgraph: SubgraphNodeComponent,
  human: HumanNodeComponent,
  end: EndNodeComponent,
};

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  type: 'node' | 'edge' | null;
  data: Node | Edge | null;
}

interface WorkflowCanvasProps {
  onNodeSelect?: (node: Node) => void;
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ onNodeSelect }) => {
  const { nodes: storeNodes, edges: storeEdges, setNodes, setEdges, removeNode } = useWorkflowStore();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    type: null,
    data: null,
  });

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    changes.forEach((change) => {
      if (change.type === 'remove') {
        removeNode(change.id);
      }
    });
    const updatedNodes = applyNodeChanges(changes, storeNodes as any);
    setNodes(updatedNodes as any);
  }, [storeNodes, setNodes, removeNode]);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    const updatedEdges = applyEdgeChanges(changes, storeEdges as any);
    setEdges(updatedEdges as any);
  }, [storeEdges, setEdges]);

  const onConnect = useCallback((params: Connection) => {
    const newEdge: Edge = { 
      ...params, 
      id: `e-${params.source}-${params.target}-${Date.now()}`, 
      type: 'smoothstep', 
      animated: true,
      sourceHandle: params.sourceHandle || undefined,
      targetHandle: params.targetHandle || undefined,
    };
    setEdges([...storeEdges, newEdge]);
  }, [storeEdges, setEdges]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { 
    onNodeSelect?.(node);
    hideContextMenu();
  }, [onNodeSelect]);

  const onEdgeClick = useCallback((_event: React.MouseEvent, _edge: Edge) => {
    hideContextMenu();
  }, []);

  const onPaneClick = useCallback(() => {
    hideContextMenu();
  }, []);

  const showContextMenu = useCallback((e: React.MouseEvent, type: 'node' | 'edge', data: Node | Edge) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      type,
      data,
    });
  }, []);

  const hideContextMenu = useCallback(() => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      type: null,
      data: null,
    });
  }, []);

  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    showContextMenu(e, 'node', node);
  }, [showContextMenu]);

  const onEdgeContextMenu = useCallback((e: React.MouseEvent, edge: Edge) => {
    showContextMenu(e, 'edge', edge);
  }, [showContextMenu]);

  const handleDelete = useCallback(() => {
    if (contextMenu.type === 'node' && contextMenu.data) {
      const nodeId = (contextMenu.data as Node).id;
      removeNode(nodeId);
    } else if (contextMenu.type === 'edge' && contextMenu.data) {
      const edgeId = (contextMenu.data as Edge).id;
      setEdges(storeEdges.filter(e => e.id !== edgeId));
    }
    hideContextMenu();
  }, [contextMenu, removeNode, storeEdges, setEdges, hideContextMenu]);

  const handleEdit = useCallback(() => {
    if (contextMenu.type === 'node' && contextMenu.data) {
      onNodeSelect?.(contextMenu.data as Node);
    }
    hideContextMenu();
  }, [contextMenu, onNodeSelect, hideContextMenu]);

  return (
    <div 
      style={{ width: '100%', height: '100%', background: '#0a0a0f', position: 'relative' }} 
      tabIndex={0}
      onClick={hideContextMenu}
    >
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 30% 20%, rgba(99,102,241,0.06) 0%, transparent 50%)', pointerEvents: 'none' }} />
      <ReactFlow
        nodes={storeNodes as any}
        edges={storeEdges as any}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[20, 20]}
        defaultEdgeOptions={{ type: 'smoothstep', animated: true, style: { stroke: '#6366f1', strokeWidth: 2 }}}
      >
        <Background color="rgba(255,255,255,0.04)" gap={24} size={1.5} />
        <Controls style={{ background: 'rgba(18,18,26,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }} />
        <MiniMap 
          nodeColor={(n) => {
            switch(n.type) {
              case 'llm': return '#6366f1';
              case 'http': return '#10b981';
              case 'condition': return '#f59e0b';
              case 'start': return '#ef4444';
              case 'loop': return '#8b5cf6';
              case 'transform': return '#ec4899';
              case 'tool': return '#14b8a6';
              case 'parallel': return '#3b82f6';
              case 'subgraph': return '#f97316';
              case 'human': return '#06b6d4';
              case 'end': return '#6b7280';
              default: return '#52525b';
            }
          }} 
          style={{ background: 'rgba(18,18,26,0.9)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }} 
          maskColor="rgba(10,10,15,0.8)" 
        />
      </ReactFlow>
      
      <div style={{ position: 'absolute', bottom: 16, left: 16, color: '#71717a', fontSize: 11 }}>
        右键点击节点/连线可删除
      </div>

      {contextMenu.visible && (
        <div
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'rgba(18,18,26,0.98)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            padding: '4px 0',
            minWidth: 120,
            zIndex: 1000,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'node' && (
            <div
              onClick={handleEdit}
              style={{
                padding: '8px 16px',
                color: '#f0f0f5',
                fontSize: 13,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLDivElement).style.background = 'rgba(99,102,241,0.15)';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLDivElement).style.background = 'transparent';
              }}
            >
              编辑配置
            </div>
          )}
          <div
            onClick={handleDelete}
            style={{
              padding: '8px 16px',
              color: '#f87171',
              fontSize: 13,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLDivElement).style.background = 'rgba(239,68,68,0.15)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLDivElement).style.background = 'transparent';
            }}
          >
            删除
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowCanvas;