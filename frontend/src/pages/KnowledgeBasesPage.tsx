import React, { useState, useEffect } from 'react';
import { 
  Button, Space, Table, Tag, Popconfirm, Modal, Form, Input, message, Drawer, 
  InputNumber, Upload, Divider, Spin, Empty
} from 'antd';
import { 
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, UploadOutlined, 
  FileTextOutlined, DatabaseOutlined, ClearOutlined
} from '@ant-design/icons';
import { knowledgeBaseApi } from '../services/api';
import type { KnowledgeBase, KnowledgeBaseCreate, KnowledgeBaseSearchResult } from '../types/knowledgeBase';

const { TextArea } = Input;

const KnowledgeBasesPage: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editDrawerVisible, setEditDrawerVisible] = useState(false);
  const [searchDrawerVisible, setSearchDrawerVisible] = useState(false);
  const [currentKB, setCurrentKB] = useState<KnowledgeBase | null>(null);
  const [form] = Form.useForm();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeBaseSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addTextsVisible, setAddTextsVisible] = useState(false);
  const [textsToAdd, setTextsToAdd] = useState('');

  useEffect(() => {
    loadKnowledgeBases();
  }, []);

  const loadKnowledgeBases = async () => {
    setLoading(true);
    try {
      const data = await knowledgeBaseApi.list();
      setKnowledgeBases(data);
    } catch (error) {
      message.error('加载知识库列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setCurrentKB(null);
    form.resetFields();
    setCreateModalVisible(true);
  };

  const handleEdit = (kb: KnowledgeBase) => {
    setCurrentKB(kb);
    form.setFieldsValue({
      display_name: kb.display_name,
      description: kb.description,
      embedding_api_key: '',
      embedding_base_url: '',
    });
    setEditDrawerVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      if (currentKB) {
        await knowledgeBaseApi.update(currentKB.id, values);
        message.success('更新成功');
        setEditDrawerVisible(false);
      } else {
        const data: KnowledgeBaseCreate = {
          name: values.name,
          display_name: values.display_name,
          description: values.description,
          embedding_model: values.embedding_model || 'text-embedding-3-small',
          embedding_api_key: values.embedding_api_key,
          embedding_base_url: values.embedding_base_url,
          chunk_size: values.chunk_size || 1000,
          chunk_overlap: values.chunk_overlap || 200,
        };
        await knowledgeBaseApi.create(data);
        message.success('创建成功');
        setCreateModalVisible(false);
      }
      
      loadKnowledgeBases();
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
      await knowledgeBaseApi.delete(id);
      message.success('删除成功');
      loadKnowledgeBases();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '删除失败');
    }
  };

  const handleUpload = async (kb: KnowledgeBase, files: File[]) => {
    try {
      message.loading({ content: '正在处理文档...', key: 'upload' });
      const result = await knowledgeBaseApi.addDocuments(kb.id, files);
      message.success({ content: result.message, key: 'upload' });
      loadKnowledgeBases();
    } catch (error: any) {
      message.error({ content: error.response?.data?.detail || '上传失败', key: 'upload' });
    }
  };

  const handleAddTexts = async () => {
    if (!currentKB) return;
    
    try {
      const texts = textsToAdd.split('\n').filter(t => t.trim());
      if (texts.length === 0) {
        message.error('请输入文本内容');
        return;
      }
      
      message.loading({ content: '正在处理文本...', key: 'addTexts' });
      const result = await knowledgeBaseApi.addTexts(currentKB.id, { texts });
      message.success({ content: result.message, key: 'addTexts' });
      setAddTextsVisible(false);
      setTextsToAdd('');
      loadKnowledgeBases();
    } catch (error: any) {
      message.error({ content: error.response?.data?.detail || '添加失败', key: 'addTexts' });
    }
  };

  const handleSearch = async (kb: KnowledgeBase) => {
    setCurrentKB(kb);
    setSearchQuery('');
    setSearchResults([]);
    setSearchDrawerVisible(true);
  };

  const runSearch = async () => {
    if (!currentKB || !searchQuery.trim()) return;
    
    setSearchLoading(true);
    try {
      const results = await knowledgeBaseApi.search(currentKB.id, searchQuery);
      setSearchResults(results);
    } catch (error: any) {
      message.error(error.response?.data?.detail || '搜索失败');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleClear = async (kb: KnowledgeBase) => {
    try {
      await knowledgeBaseApi.clear(kb.id);
      message.success('知识库已清空');
      loadKnowledgeBases();
    } catch (error: any) {
      message.error(error.response?.data?.detail || '清空失败');
    }
  };

  const columns = [
    {
      title: '知识库名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <DatabaseOutlined style={{ color: '#6366f1' }} />
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
      title: '文档数',
      dataIndex: 'document_count',
      key: 'document_count',
      render: (count: number) => (
        <Tag style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
          {count}
        </Tag>
      ),
    },
    {
      title: 'Embedding 模型',
      dataIndex: 'embedding_model',
      key: 'embedding_model',
      render: (model: string) => <span style={{ color: '#71717a', fontSize: 12 }}>{model}</span>,
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_: any, record: KnowledgeBase) => (
        <Space wrap>
          <Upload
            accept=".pdf,.docx,.doc,.txt,.md,.html,.xlsx,.xls,.csv,.pptx,.json"
            showUploadList={false}
            beforeUpload={(file) => {
              handleUpload(record, [file]);
              return false;
            }}
            multiple
          >
            <Button type="link" size="small" icon={<UploadOutlined />}>上传文档</Button>
          </Upload>
          <Button 
            type="link" 
            size="small" 
            icon={<FileTextOutlined />}
            onClick={() => {
              setCurrentKB(record);
              setTextsToAdd('');
              setAddTextsVisible(true);
            }}
          >
            添加文本
          </Button>
          <Button type="link" size="small" icon={<SearchOutlined />} onClick={() => handleSearch(record)}>
            搜索
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Popconfirm title="确认清空知识库内容?" onConfirm={() => handleClear(record)}>
            <Button type="link" size="small" icon={<ClearOutlined />} style={{ color: '#fbbf24' }}>
              清空
            </Button>
          </Popconfirm>
          <Popconfirm title="确认删除此知识库?" onConfirm={() => handleDelete(record.id)}>
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
          <div style={{ color: '#f0f0f5', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>知识库管理</div>
          <div style={{ color: '#71717a', fontSize: 13 }}>管理 RAG 知识库，支持文档上传和文本添加</div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none', borderRadius: 8 }}>
          新建知识库
        </Button>
      </div>

      <Table
        dataSource={knowledgeBases}
        rowKey="id"
        columns={columns}
        loading={loading}
        pagination={false}
      />

      {/* 创建知识库弹窗 */}
      <Modal
        title={<span style={{ color: '#f0f0f5' }}>新建知识库</span>}
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleSave}
        okText="创建"
        cancelText="取消"
        width={600}
        styles={{
          content: { background: 'rgba(18,18,26,0.95)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          body: { padding: 16 },
        }}
      >
        <Form form={form} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item
              label="知识库名称"
              name="name"
              rules={[
                { required: true, message: '请输入知识库名称' },
                { pattern: /^[a-z][a-z0-9_]*$/, message: '只能包含小写字母、数字和下划线，且以字母开头' },
              ]}
            >
              <Input placeholder="my_knowledge_base" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
            </Form.Item>
            <Form.Item
              label="显示名称"
              name="display_name"
              rules={[{ required: true, message: '请输入显示名称' }]}
            >
              <Input placeholder="我的知识库" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
            </Form.Item>
          </div>

          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="知识库描述" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>

          <Divider style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />

          <div style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 12 }}>Embedding 配置</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="Embedding 模型" name="embedding_model" initialValue="text-embedding-3-small">
              <Input placeholder="text-embedding-3-small" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
            </Form.Item>
            <Form.Item label="API Base URL" name="embedding_base_url">
              <Input placeholder="留空使用默认" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
            </Form.Item>
          </div>

          <Form.Item label="API Key" name="embedding_api_key">
            <Input.Password placeholder="留空使用环境变量" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>

          <Divider style={{ borderColor: 'rgba(255,255,255,0.06)', margin: '16px 0' }} />

          <div style={{ color: '#a1a1aa', fontSize: 13, marginBottom: 12 }}>文档切分配置</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Form.Item label="文档块大小" name="chunk_size" initialValue={1000}>
              <InputNumber min={100} max={8000} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
            </Form.Item>
            <Form.Item label="文档块重叠" name="chunk_overlap" initialValue={200}>
              <InputNumber min={0} max={1000} style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      {/* 编辑知识库抽屉 */}
      <Drawer
        title={<span style={{ color: '#f0f0f5' }}>编辑知识库: {currentKB?.display_name}</span>}
        placement="right"
        width={500}
        open={editDrawerVisible}
        onClose={() => setEditDrawerVisible(false)}
        styles={{
          content: { background: 'rgba(18,18,26,0.95)', backdropFilter: 'blur(20px)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          body: { padding: 16 },
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
          <Form.Item label="显示名称" name="display_name" rules={[{ required: true, message: '请输入显示名称' }]}>
            <Input placeholder="我的知识库" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <TextArea rows={2} placeholder="知识库描述" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item label="API Base URL" name="embedding_base_url">
            <Input placeholder="留空使用默认" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item label="API Key" name="embedding_api_key">
            <Input.Password placeholder="留空使用环境变量" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
        </Form>
      </Drawer>

      {/* 搜索抽屉 */}
      <Drawer
        title={<span style={{ color: '#f0f0f5' }}>搜索知识库: {currentKB?.display_name}</span>}
        placement="right"
        width={600}
        open={searchDrawerVisible}
        onClose={() => setSearchDrawerVisible(false)}
        styles={{
          content: { background: 'rgba(18,18,26,0.95)', backdropFilter: 'blur(20px)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          body: { padding: 16 },
        }}
      >
        <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="输入搜索内容..."
            onPressEnter={runSearch}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={runSearch} loading={searchLoading} style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)', border: 'none' }}>
            搜索
          </Button>
        </Space.Compact>

        {searchLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : searchResults.length === 0 ? (
          <Empty description="输入关键词搜索知识库内容" style={{ padding: 40, color: '#71717a' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {searchResults.map((result, index) => (
              <div key={index} style={{ 
                background: 'rgba(255,255,255,0.03)', 
                border: '1px solid rgba(255,255,255,0.06)', 
                borderRadius: 8, 
                padding: 12 
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Tag style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
                    #{index + 1}
                  </Tag>
                  {result.score !== undefined && (
                    <span style={{ color: '#71717a', fontSize: 12 }}>相似度: {result.score.toFixed(4)}</span>
                  )}
                </div>
                <div style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 1.6 }}>
                  {result.content}
                </div>
                {Object.keys(result.metadata).length > 0 && (
                  <div style={{ marginTop: 8, color: '#71717a', fontSize: 11 }}>
                    {JSON.stringify(result.metadata)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Drawer>

      {/* 添加文本弹窗 */}
      <Modal
        title={<span style={{ color: '#f0f0f5' }}>添加文本 - {currentKB?.display_name}</span>}
        open={addTextsVisible}
        onCancel={() => setAddTextsVisible(false)}
        onOk={handleAddTexts}
        okText="添加"
        cancelText="取消"
        width={600}
        styles={{
          content: { background: 'rgba(18,18,26,0.95)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
          body: { padding: 16 },
        }}
      >
        <div style={{ color: '#a1a1aa', fontSize: 12, marginBottom: 8 }}>
          每行一条文本，将自动添加到知识库中
        </div>
        <TextArea
          rows={10}
          value={textsToAdd}
          onChange={(e) => setTextsToAdd(e.target.value)}
          placeholder="第一行文本&#10;第二行文本&#10;..."
          style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }}
        />
      </Modal>
    </div>
  );
};

export default KnowledgeBasesPage;
