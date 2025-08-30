"""
Enhanced Conversational Memory System for UML RAG

This module provides a more robust and feature-rich conversational memory system.
It includes features like max buffer size, time-based expiration, session management,
and easy serialization.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from collections import deque

# Configure logger for this module
logger = logging.getLogger(__name__)

class ConversationMessage:
    """Represents a single, timestamped message in a conversation."""
    def __init__(self, role: str, content: str, timestamp: Optional[datetime] = None, metadata: Optional[Dict[str, Any]] = None):
        if role not in ['user', 'assistant']:
            raise ValueError("Role must be either 'user' or 'assistant'")
        self.role = role
        self.content = content
        self.timestamp = timestamp or datetime.utcnow()
        self.metadata = metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the message to a dictionary."""
        return {
            'role': self.role,
            'content': self.content,
            'timestamp': self.timestamp.isoformat(),
            'metadata': self.metadata
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ConversationMessage':
        """Deserialize a message from a dictionary."""
        return cls(
            role=data['role'],
            content=data['content'],
            timestamp=datetime.fromisoformat(data['timestamp']),
            metadata=data.get('metadata')
        )

    def __repr__(self) -> str:
        return f"ConversationMessage(role='{self.role}', content='{self.content[:50]}...', timestamp='{self.timestamp}')"

class ConversationBufferMemory:
    """Manages a buffer of conversation messages for a specific session."""
    def __init__(self, session_id: str, max_size: int = 20, ttl_seconds: Optional[int] = 3600):
        self.session_id = session_id
        self.max_size = max_size
        self.ttl = timedelta(seconds=ttl_seconds) if ttl_seconds else None
        self.buffer: deque[ConversationMessage] = deque(maxlen=max_size)
        logger.info(f"Initialized memory for session '{session_id}' with max_size={max_size} and ttl={ttl_seconds}s")

    def add_message(self, role: str, content: str, metadata: Optional[Dict[str, Any]] = None):
        """Add a new message to the conversation buffer."""
        message = ConversationMessage(role=role, content=content, metadata=metadata)
        self.buffer.append(message)
        logger.debug(f"Session '{self.session_id}': Added message from '{role}'")

    def get_messages(self, since: Optional[datetime] = None) -> List[ConversationMessage]:
        """Retrieve messages, optionally filtering out old ones based on TTL or a specific timestamp."""
        self._prune_old_messages()
        if since:
            return [msg for msg in self.buffer if msg.timestamp >= since]
        return list(self.buffer)

    def get_formatted_history(self) -> str:
        """Return the conversation history as a single formatted string."""
        messages = self.get_messages()
        return "\n".join([f"{msg.role.capitalize()}: {msg.content}" for msg in messages])

    def clear(self):
        """Clear all messages from the buffer."""
        self.buffer.clear()
        logger.info(f"Cleared memory for session '{self.session_id}'")

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the entire memory buffer to a dictionary."""
        return {
            'session_id': self.session_id,
            'messages': [msg.to_dict() for msg in self.buffer]
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any], max_size: int = 20, ttl_seconds: Optional[int] = 3600) -> 'ConversationBufferMemory':
        """Deserialize a memory buffer from a dictionary."""
        session_id = data.get('session_id', 'deserialized-session')
        memory = cls(session_id, max_size, ttl_seconds)
        messages = [ConversationMessage.from_dict(msg_data) for msg_data in data.get('messages', [])]
        memory.buffer.extend(messages)
        return memory

    def _prune_old_messages(self):
        """Internal method to remove messages older than the TTL."""
        if not self.ttl:
            return

        cutoff_time = datetime.utcnow() - self.ttl
        # Efficiently remove old items from the left of the deque
        while self.buffer and self.buffer[0].timestamp < cutoff_time:
            self.buffer.popleft()




class ConversationBufferWindowMemory:
    """
    Buffer memory with a sliding window that only keeps the most recent k interactions.
    Similar to LangChain's ConversationBufferWindowMemory.
    """
    
    def __init__(self, k: int = 5):
        self.k = k  # Number of recent interactions to keep
        self.messages: deque = deque(maxlen=k * 2)  # k interactions = k*2 messages
    
    def add_message(self, role: str, content: str, metadata: Optional[Dict[str, Any]] = None):
        """Add a new message to the conversation window"""
        message = ConversationMessage(
            role=role,
            content=content,
            timestamp=datetime.now(),
            metadata=metadata or {}
        )
        self.messages.append(message)
    
    def get_conversation_history(self) -> str:
        """Get formatted conversation history string for the window"""
        history_parts = []
        for msg in self.messages:
            history_parts.append(f"{msg.role.capitalize()}: {msg.content}")
        
        return "\n".join(history_parts)
    
    def get_messages(self) -> List[ConversationMessage]:
        """Get list of messages in the current window"""
        return list(self.messages)

class ConversationSummaryMemory:
    """
    Memory that summarizes older conversations while keeping recent ones.
    Inspired by LangChain's ConversationSummaryMemory.
    """
    
    def __init__(self, max_recent_messages: int = 10, summary_threshold: int = 20):
        self.recent_messages: List[ConversationMessage] = []
        self.summary: str = ""
        self.max_recent_messages = max_recent_messages
        self.summary_threshold = summary_threshold
        self.all_messages: List[ConversationMessage] = []
    
    def add_message(self, role: str, content: str, metadata: Optional[Dict[str, Any]] = None):
        """Add a new message and manage summarization"""
        message = ConversationMessage(
            role=role,
            content=content,
            timestamp=datetime.now(),
            metadata=metadata or {}
        )
        
        self.recent_messages.append(message)
        self.all_messages.append(message)
        
        # Check if we need to summarize
        if len(self.recent_messages) > self.summary_threshold:
            self._create_summary()
    
    def _create_summary(self):
        """Create a summary of older messages"""
        # Keep only the most recent messages
        messages_to_summarize = self.recent_messages[:-self.max_recent_messages]
        self.recent_messages = self.recent_messages[-self.max_recent_messages:]
        
        if messages_to_summarize:
            # Create a simple summary
            summary_parts = []
            
            # Count different types of interactions
            uml_requests = 0
            questions = 0
            
            for msg in messages_to_summarize:
                if msg.role == 'user':
                    if any(keyword in msg.content.lower() for keyword in ['diagram', 'uml', 'class', 'sequence']):
                        uml_requests += 1
                    elif any(keyword in msg.content.lower() for keyword in ['what', 'how', 'why', 'explain']):
                        questions += 1
            
            if uml_requests > 0:
                summary_parts.append(f"User requested {uml_requests} UML diagram(s)")
            if questions > 0:
                summary_parts.append(f"User asked {questions} question(s) about UML concepts")
            
            new_summary = "Previous conversation: " + "; ".join(summary_parts)
            
            if self.summary:
                self.summary = f"{self.summary}; {new_summary}"
            else:
                self.summary = new_summary
    
    def get_conversation_history(self) -> str:
        """Get formatted conversation history including summary"""
        parts = []
        
        if self.summary:
            parts.append(f"Summary: {self.summary}")
        
        # Add recent messages
        for msg in self.recent_messages:
            parts.append(f"{msg.role.capitalize()}: {msg.content}")
        
        return "\n".join(parts)
    
    def get_messages(self) -> List[ConversationMessage]:
        """Get recent messages"""
        return self.recent_messages.copy()

class UMLConversationManager:
    """
    Main conversation manager for the UML RAG system.
    Handles different memory strategies and provides context-aware responses.
    """
    
    def __init__(self, memory_type: str = "buffer_window", **kwargs):
        self.sessions: Dict[str, Any] = {}  # session_id -> memory instance
        self.memory_type = memory_type
        self.memory_kwargs = kwargs
        
        # Default conversation context for UML domain
        self.system_context = """You are an expert UML diagram assistant. You help users create professional UML diagrams and understand software design concepts. You remember the conversation history and provide contextual responses."""
    
    def get_or_create_session(self, session_id: str = "default"):
        """Get or create a conversation session"""
        if session_id not in self.sessions:
            if self.memory_type == "buffer":
                self.sessions[session_id] = ConversationBufferMemory(**self.memory_kwargs)
            elif self.memory_type == "buffer_window":
                self.sessions[session_id] = ConversationBufferWindowMemory(**self.memory_kwargs)
            elif self.memory_type == "summary":
                self.sessions[session_id] = ConversationSummaryMemory(**self.memory_kwargs)
            else:
                # Default to buffer window
                self.sessions[session_id] = ConversationBufferWindowMemory(k=5)
        
        return self.sessions[session_id]
    
    def add_user_message(self, message: str, session_id: str = "default", metadata: Optional[Dict[str, Any]] = None):
        """Add a user message to the conversation"""
        memory = self.get_or_create_session(session_id)
        memory.add_message("user", message, metadata)
    
    def add_assistant_message(self, message: str, session_id: str = "default", metadata: Optional[Dict[str, Any]] = None):
        """Add an assistant message to the conversation"""
        memory = self.get_or_create_session(session_id)
        memory.add_message("assistant", message, metadata)
    
    def get_conversation_context(self, session_id: str = "default", include_system: bool = True) -> str:
        """Get full conversation context for AI prompting"""
        memory = self.get_or_create_session(session_id)
        
        parts = []
        if include_system:
            parts.append(f"System: {self.system_context}")
        
        conversation_history = memory.get_conversation_history()
        if conversation_history:
            parts.append(conversation_history)
        
        return "\n".join(parts)
    
    def analyze_conversation_intent(self, session_id: str = "default") -> Dict[str, Any]:
        """Analyze the conversation to understand user intent and context"""
        memory = self.get_or_create_session(session_id)
        messages = memory.get_messages()
        
        if not messages:
            return {"intent": "greeting", "context": "new_conversation"}
        
        # Get the last few messages for intent analysis
        recent_messages = messages[-5:] if len(messages) >= 5 else messages
        
        # Analyze patterns
        user_messages = [msg.content.lower() for msg in recent_messages if msg.role == "user"]
        
        intent_analysis = {
            "intent": "general",
            "diagram_type": None,
            "domain": None,
            "is_follow_up": len(messages) > 2,
            "conversation_length": len(messages),
            "recent_topics": []
        }
        
        if user_messages:
            last_message = user_messages[-1]
            
            # Detect diagram requests
            diagram_keywords = {
                "class": "class_diagram",
                "sequence": "sequence_diagram", 
                "activity": "activity_diagram",
                "use case": "usecase_diagram",
                "component": "component_diagram",
                "deployment": "deployment_diagram"
            }
            
            for keyword, diagram_type in diagram_keywords.items():
                if keyword in last_message:
                    intent_analysis["intent"] = "diagram_request"
                    intent_analysis["diagram_type"] = diagram_type
                    break
            
            # Detect questions
            if any(word in last_message for word in ["what", "how", "why", "explain", "difference"]):
                intent_analysis["intent"] = "question"
            
            # Detect domain
            domain_keywords = {
                "e-commerce": "ecommerce",
                "hospital": "healthcare",
                "bank": "finance",
                "school": "education",
                "inventory": "warehouse"
            }
            
            for keyword, domain in domain_keywords.items():
                if keyword in last_message:
                    intent_analysis["domain"] = domain
                    break
        
        return intent_analysis
    
    def generate_contextual_response(self, user_message: str, session_id: str = "default") -> str:
        """Generate a contextual response based on conversation history"""
        # Add user message to memory
        self.add_user_message(user_message, session_id)
        
        # Analyze intent
        intent_analysis = self.analyze_conversation_intent(session_id)
        
        # Generate response based on context
        if intent_analysis["intent"] == "diagram_request":
            if intent_analysis["is_follow_up"]:
                response = f"I see you'd like another diagram! Based on our conversation, I'll create a {intent_analysis.get('diagram_type', 'UML')} diagram for you."
            else:
                response = f"Perfect! I'll help you create a {intent_analysis.get('diagram_type', 'UML')} diagram."
            
            if intent_analysis["domain"]:
                response += f" Since this is for {intent_analysis['domain']}, I'll include domain-specific best practices."
            
            response += " [GENERATE_UML]"
            
        elif intent_analysis["intent"] == "question":
            response = "That's a great question! Let me explain that concept and show you how it applies to UML design."
            
        elif intent_analysis["conversation_length"] == 1:
            # First message - greeting
            response = """Hello! 👋 Welcome to your intelligent UML diagram assistant! 

I'm here to help you create professional UML diagrams and understand software design concepts. I remember our conversation, so feel free to ask follow-up questions or request modifications to diagrams we create together.

What would you like to work on today?"""
            
        else:
            # General follow-up
            response = "I understand! Let me help you with that. Based on what we've discussed, I can provide more specific guidance."
        
        # Add assistant response to memory
        self.add_assistant_message(response, session_id)
        
        return response
    
    def clear_session(self, session_id: str = "default"):
        """Clear a conversation session"""
        if session_id in self.sessions:
            del self.sessions[session_id]

# Global conversation manager instance
conversation_manager = UMLConversationManager(
    memory_type="buffer_window",  # Use sliding window by default
    k=6  # Keep last 6 interactions (12 messages)
) 