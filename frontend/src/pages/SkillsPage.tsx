import React, { useState, useEffect } from 'react';
import {
  Button, Space, Table, Tag, Modal, Form, Input, Switch, message,
  Drawer, Upload, Typography, Divider, Popconfirm,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  RocketOutlined, InboxOutlined,
} from '@ant-design/icons';
import type { UploadFile } from 'antd/es/upload/interface';
import Editor from '@monaco-editor/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { skillsApi } from '../services/api';
import type { SkillSummary, SkillDetail, SkillCreateRequest } from '../types/skills';

const { Dragger } = Upload;
const { Title, Text } = Typography;

const SkillsPage: React.FC = () => {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editDrawerVisible, setEditDrawerVisible] = useState(false);
  const [detailDrawerVisible, setDetailDrawerVisible] = useState(false);
  const [currentSkill, setCurrentSkill] = useState<SkillDetail | null>(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const [skillContent, setSkillContent] = useState('');
  const [editSkillContent, setEditSkillContent] = useState('');

  useEffect(() => {
    loadSkills();
  }, []);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const data = await skillsApi.list();
      setSkills(data);
    } catch (error) {
      message.error('加载 Skill 列表失败');
    } finally {
      setLoading(false);
    }
  };

  // ---- Create ----
  const handleCreate = () => {
    form.resetFields();
    setSkillContent('');
    setCreateModalVisible(true);
  };

  const handleCreateSubmit = async () => {
    try {
      const values = await form.validateFields();
      const data: SkillCreateRequest = {
        ...values,
        content: skillContent,
      };
      await skillsApi.create(data);
      message.success(`Skill '${values.name}' 创建成功`);
      setCreateModalVisible(false);
      loadSkills();
    } catch (error: any) {
      if (error.response?.status === 409) {
        message.error(error.response.data.detail || 'Skill 已存在');
      } else {
        message.error('创建失败');
      }
    }
  };

  // ---- Detail ----
  const handleViewDetail = async (name: string) => {
    try {
      const data = await skillsApi.get(name);
      setCurrentSkill(data);
      setDetailDrawerVisible(true);
    } catch {
      message.error('获取 Skill 详情失败');
    }
  };

  // ---- Edit ----
  const handleEdit = async (name: string) => {
    try {
      const data = await skillsApi.get(name);
      setCurrentSkill(data);
      editForm.setFieldsValue({
        description: data.description,
        disable_model_invocation: data.disable_model_invocation,
        user_invocable: data.user_invocable,
        allowed_tools: data.allowed_tools.join(', '),
        argument_hint: data.argument_hint,
      });
      setEditSkillContent(data.content);
      setEditDrawerVisible(true);
    } catch {
      message.error('获取 Skill 信息失败');
    }
  };

  const handleEditSubmit = async () => {
    if (!currentSkill) return;
    try {
      const values = await editForm.validateFields();
      const updateData: Partial<SkillCreateRequest> = {
        description: values.description,
        content: editSkillContent,
        disable_model_invocation: values.disable_model_invocation,
        user_invocable: values.user_invocable,
        argument_hint: values.argument_hint,
        allowed_tools: values.allowed_tools
          ? values.allowed_tools.split(',').map((s: string) => s.trim()).filter(Boolean)
          : undefined,
      };
      await skillsApi.update(currentSkill.name, updateData);
      message.success('更新成功');
      setEditDrawerVisible(false);
      loadSkills();
    } catch {
      message.error('更新失败');
    }
  };

  // ---- Delete ----
  const handleDelete = async (name: string) => {
    try {
      const preview = await skillsApi.deletePreview(name);
      if (preview.bound_agents && preview.bound_agents.length > 0) {
        Modal.confirm({
          title: '确认删除',
          content: (
            <div>
              <p>Skill '{name}' 已被以下 Agent 绑定，删除后将自动解绑：</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
                {preview.bound_agents.map((a: any) => (
                  <Tag key={a.id} color="blue">{a.name}</Tag>
                ))}
              </div>
            </div>
          ),
          okText: '确认删除',
          okType: 'danger',
          cancelText: '取消',
          onOk: async () => {
            await skillsApi.deleteConfirm(name);
            message.success(`Skill '${name}' 已删除`);
            loadSkills();
          },
        });
      } else {
        Modal.confirm({
          title: '确认删除',
          content: `确定要删除 Skill '${name}' 吗？此操作不可撤销。`,
          okText: '确认删除',
          okType: 'danger',
          cancelText: '取消',
          onOk: async () => {
            await skillsApi.deleteConfirm(name);
            message.success(`Skill '${name}' 已删除`);
            loadSkills();
          },
        });
      }
    } catch {
      message.error('获取删除预检信息失败');
    }
  };

  // ---- ZIP Upload ----
  const handleUploadChange = async (info: { file: UploadFile; file_list?: UploadFile[] }) => {
    if (info.file.status === 'done') {
      message.success('上传成功');
      loadSkills();
    } else if (info.file.status === 'error') {
      const errDetail = (info.file as any).response?.detail || '上传失败';
      if (typeof errDetail === 'string' && errDetail.includes('overwrite')) {
        Modal.confirm({
          title: 'Skill 已存在',
          content: `同名 Skill 已存在，是否覆盖？`,
          okText: '覆盖',
          okType: 'danger',
          cancelText: '取消',
          onOk: async () => {
            try {
              const file = info.file.originFileObj;
              if (file) {
                await skillsApi.upload(file, true);
                message.success('覆盖上传成功');
                loadSkills();
              }
            } catch {
              message.error('上传失败');
            }
          },
        });
      } else {
        message.error(errDetail);
      }
    }
  };

  const beforeUpload = (file: File) => {
    if (!file.name.endsWith('.zip')) {
      message.error('只支持 .zip 格式文件');
      return false;
    }
    if (file.size > 10 * 1024 * 1024) {
      message.error('文件大小不能超过 10MB');
      return false;
    }
    return true;
  };

  // ---- Columns ----
  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => (
        <Space>
          <RocketOutlined style={{ color: '#10b981' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'disable_model_invocation',
      key: 'disable_model_invocation',
      render: (val: boolean) => (
        val
          ? <Tag color="orange">手动触发</Tag>
          : <Tag color="green">自动触发</Tag>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: SkillSummary) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewDetail(record.name)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record.name)}>
            编辑
          </Button>
          <Popconfirm
            title="确认删除"
            description="删除后不可恢复"
            onConfirm={() => handleDelete(record.name)}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="skills-page" style={{ padding: 24, color: '#f0f0f5', height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        .skills-page .ant-table,
        .skills-page .ant-table-thead > tr > th,
        .skills-page .ant-table-tbody > tr > td,
        .skills-page .ant-table-cell,
        .skills-page .ant-table-title,
        .skills-page .ant-table-header,
        .skills-page .ant-table-pagination,
        .skills-page .ant-empty-description,
        .skills-page .ant-form-item-label > label,
        .skills-page .ant-modal-header,
        .skills-page .ant-modal-title,
        .skills-page .ant-drawer-header,
        .skills-page .ant-drawer-title,
        .skills-page .ant-descriptions-header,
        .skills-page .ant-descriptions-item-label,
        .skills-page .ant-descriptions-item-content,
        .skills-page .ant-divider-inner-text,
        .skills-page .ant-input,
        .skills-page .ant-input::placeholder,
        .skills-page .ant-select-selection-item,
        .skills-page .ant-switch-inner,
        .skills-page .ant-modal-content,
        .skills-page .ant-drawer-content,
        .skills-page .ant-btn,
        .skills-page .ant-typography,
        .skills-page .ant-typography-text {
          color: #d4d4d8 !important;
        }
        .skills-page .ant-table-thead > tr > th {
          color: #a1a1aa !important;
        }
        .skills-page .ant-input,
        .skills-page .ant-input-password {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
        .skills-page .ant-modal-content,
        .skills-page .ant-drawer-content {
          background: rgba(18,18,26,0.98) !important;
        }
        .skills-page .ant-descriptions-bordered .ant-descriptions-view {
          border-color: rgba(255,255,255,0.08) !important;
        }
        .skills-page .ant-descriptions-bordered .ant-descriptions-item-label,
        .skills-page .ant-descriptions-bordered .ant-descriptions-item-content {
          border-color: rgba(255,255,255,0.08) !important;
        }
        .skills-page .ant-divider {
          border-color: rgba(255,255,255,0.08) !important;
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0, color: '#f0f0f5' }}>
          <RocketOutlined style={{ marginRight: 8 }} />
          Skill 管理
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          创建 Skill
        </Button>
      </div>

      {/* ZIP Upload Area */}
      <Dragger
        accept=".zip"
        showUploadList={false}
        beforeUpload={beforeUpload}
        onChange={handleUploadChange}
        customRequest={({ file, onSuccess, onError }) => {
          const actualFile = (file as any).originFileObj || file;
          skillsApi.upload(actualFile as File)
            .then(() => onSuccess?.(null))
            .catch((err: any) => onError?.(err));
        }}
        style={{ marginBottom: 16, background: 'rgba(255,255,255,0.02)' }}
      >
        <p style={{ margin: '12px 0' }}>
          <InboxOutlined style={{ fontSize: 32, color: '#1677ff' }} />
        </p>
        <Text style={{ color: '#d4d4d8' }}>拖拽 ZIP 文件到此处，或 <span style={{ color: '#1677ff', cursor: 'pointer' }}>点击上传</span></Text>
        <div style={{ color: '#71717a', fontSize: 12, marginTop: 4 }}>
          支持 .zip 格式，最大 10MB
        </div>
      </Dragger>

      {/* Skills Table - scrollable */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <Table
          columns={columns}
          dataSource={skills}
          rowKey="name"
          loading={loading}
          pagination={{ pageSize: 20 }}
          locale={{
            emptyText: <span style={{ color: '#71717a' }}>暂无 Skill，请先创建或上传</span>,
          }}
        />
      </div>

      {/* Create Modal */}
      <Modal
        title={<span style={{ color: '#f0f0f5' }}>创建 Skill</span>}
        open={createModalVisible}
        onOk={handleCreateSubmit}
        onCancel={() => setCreateModalVisible(false)}
        width={700}
        okText="创建"
        cancelText="取消"
        styles={{
          content: { background: 'rgba(18,18,26,0.98)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
        }}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label={<span style={{ color: '#d4d4d8' }}>名称</span>}
            rules={[
              { required: true, message: '请输入 Skill 名称' },
              { pattern: /^[a-z][a-z0-9-]*$/, message: '仅允许小写字母、数字、连字符，必须以字母开头' },
            ]}
          >
            <Input placeholder="例如: code-review" maxLength={50} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item
            name="description"
            label={<span style={{ color: '#d4d4d8' }}>描述</span>}
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <Input placeholder="简要描述此 Skill 的用途" maxLength={200} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item label={<span style={{ color: '#d4d4d8' }}>内容 (SKILL.md 正文)</span>}>
            <Editor
              height={200}
              language="markdown"
              theme="vs-dark"
              value={skillContent}
              onChange={(v) => setSkillContent(v || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'off',
                wordWrap: 'on',
              }}
            />
          </Form.Item>
          <Form.Item name="disable_model_invocation" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Switch checkedChildren="手动触发" unCheckedChildren="自动触发" />
            <Text style={{ marginLeft: 8, fontSize: 12, color: '#71717a' }}>
              手动触发 = 禁止 Agent 自动选择此 Skill
            </Text>
          </Form.Item>
          <Form.Item name="user_invocable" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Switch checkedChildren="用户可调用" unCheckedChildren="用户不可调用" defaultChecked />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Drawer */}
      <Drawer
        title={<span style={{ color: '#f0f0f5' }}>Skill 详情: {currentSkill?.name || ''}</span>}
        open={detailDrawerVisible}
        onClose={() => setDetailDrawerVisible(false)}
        width={700}
        styles={{
          content: { background: 'rgba(18,18,26,0.98)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
        }}
      >
        {currentSkill && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
              {[
                ['名称', currentSkill.name],
                ['描述', currentSkill.description],
                ['自动触发', currentSkill.disable_model_invocation ? '否' : '是'],
                ['用户可调用', currentSkill.user_invocable ? '是' : '否'],
                ['预授权工具', currentSkill.allowed_tools.length > 0 ? currentSkill.allowed_tools.map(t => <Tag key={t}>{t}</Tag>) : <span style={{ color: '#71717a' }}>无</span>],
                ['参数提示', <span style={{ color: '#f0f0f5' }}>{currentSkill.argument_hint || '无'}</span>],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <div style={{ color: '#71717a', fontSize: 12, marginBottom: 4 }}>{label as string}</div>
                  <div style={{ color: '#f0f0f5', fontSize: 14 }}>{value as React.ReactNode}</div>
                </div>
              ))}
            </div>

            <Divider orientation="left" style={{ color: '#d4d4d8' }}>SKILL.md 内容</Divider>
            <div style={{
              background: '#1e1e2e',
              padding: 16,
              borderRadius: 6,
              maxHeight: 400,
              overflow: 'auto',
              color: '#d4d4d8',
            }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {currentSkill.content}
              </ReactMarkdown>
            </div>

            {currentSkill.scripts.length > 0 && (
              <>
                <Divider orientation="left" style={{ color: '#d4d4d8' }}>Scripts</Divider>
                {currentSkill.scripts.map(s => <Tag key={s}>{s}</Tag>)}
              </>
            )}

            {currentSkill.references.length > 0 && (
              <>
                <Divider orientation="left" style={{ color: '#d4d4d8' }}>References</Divider>
                {currentSkill.references.map(r => <Tag key={r}>{r}</Tag>)}
              </>
            )}

            {currentSkill.assets.length > 0 && (
              <>
                <Divider orientation="left" style={{ color: '#d4d4d8' }}>Assets</Divider>
                {currentSkill.assets.map(a => <Tag key={a}>{a}</Tag>)}
              </>
            )}
          </>
        )}
      </Drawer>

      {/* Edit Drawer */}
      <Drawer
        title={<span style={{ color: '#f0f0f5' }}>编辑 Skill: {currentSkill?.name || ''}</span>}
        open={editDrawerVisible}
        onClose={() => setEditDrawerVisible(false)}
        width={700}
        styles={{
          content: { background: 'rgba(18,18,26,0.98)' },
          header: { background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.06)' },
        }}
      >
        <Form form={editForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="description"
            label={<span style={{ color: '#d4d4d8' }}>描述</span>}
            rules={[{ required: true, message: '请输入描述' }]}
          >
            <Input placeholder="简要描述此 Skill 的用途" maxLength={200} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item label={<span style={{ color: '#d4d4d8' }}>内容 (SKILL.md 正文)</span>}>
            <Editor
              height={300}
              language="markdown"
              theme="vs-dark"
              value={editSkillContent}
              onChange={(v) => setEditSkillContent(v || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'off',
                wordWrap: 'on',
              }}
            />
          </Form.Item>
          <Form.Item name="disable_model_invocation" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Switch checkedChildren="手动触发" unCheckedChildren="自动触发" />
          </Form.Item>
          <Form.Item name="user_invocable" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Switch checkedChildren="用户可调用" unCheckedChildren="用户不可调用" />
          </Form.Item>
          <Form.Item name="allowed_tools" label={<span style={{ color: '#d4d4d8' }}>预授权工具（逗号分隔）</span>}>
            <Input placeholder="例如: web_fetch, calculator" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
          <Form.Item name="argument_hint" label={<span style={{ color: '#d4d4d8' }}>参数提示</span>}>
            <Input placeholder="参数使用说明" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#f0f0f5' }} />
          </Form.Item>
        </Form>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <Button onClick={() => setEditDrawerVisible(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#d4d4d8' }}>取消</Button>
          <Button type="primary" onClick={handleEditSubmit}>保存</Button>
        </div>
      </Drawer>
    </div>
  );
};

export default SkillsPage;
