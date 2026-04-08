import uuid
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class ChatMessage:
    role: str
    content: str
    timestamp: datetime = field(default_factory=datetime.utcnow)


class SessionManager:
    """Agent 会话管理器"""

    _sessions: Dict[str, List[ChatMessage]] = {}

    @classmethod
    def create_session(cls) -> str:
        """创建新会话"""
        session_id = f"session_{uuid.uuid4().hex[:16]}"
        cls._sessions[session_id] = []
        return session_id

    @classmethod
    def get_session(cls, session_id: str) -> Optional[List[ChatMessage]]:
        """获取会话历史"""
        return cls._sessions.get(session_id)

    @classmethod
    def add_message(cls, session_id: str, role: str, content: str) -> None:
        """添加消息到会话"""
        if session_id not in cls._sessions:
            cls._sessions[session_id] = []
        cls._sessions[session_id].append(ChatMessage(role=role, content=content))

    @classmethod
    def get_history(cls, session_id: str) -> List[dict]:
        """获取历史消息格式（给 flux_agent 用）"""
        session = cls._sessions.get(session_id, [])
        return [{"role": m.role, "content": m.content} for m in session]

    @classmethod
    def clear_session(cls, session_id: str) -> None:
        """清除会话"""
        if session_id in cls._sessions:
            del cls._sessions[session_id]

    @classmethod
    def delete_session(cls, session_id: str) -> bool:
        """删除会话"""
        if session_id in cls._sessions:
            del cls._sessions[session_id]
            return True
        return False
