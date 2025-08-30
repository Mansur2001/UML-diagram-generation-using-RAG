'use client';

import { useState, useCallback, useEffect, useRef, MutableRefObject } from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Paper, 
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  useTheme
} from '@mui/material';
import { Send, Clear, AddComment } from '@mui/icons-material';
import { useTambo } from '@tambo-ai/react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { generateDiagram, setCurrentCode, renderDiagramAsync } from '@/store/slices/diagramsSlice';
import { Theme } from '@mui/material/styles';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  renderedComponent?: React.ReactNode;
}

export default function ChatPanel() {
  const dispatch = useAppDispatch();
  const { generating } = useAppSelector((state) => state.diagrams);
  
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => `session_${Date.now()}`);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  
  const examplePrompts = [
    'Create a class diagram for an e-commerce system',
    'Design a sequence diagram for user authentication',
    'Generate an activity diagram for order processing',
    'Create a use case diagram for a banking app',
    'Show a component diagram for microservices',
    'Draw a deployment diagram for a cloud-based app',
    'Build a state diagram for a traffic light system'
  ];

  // Custom hook for auto-scrolling chat
  const useChatScroll = <T,>(dep: T): MutableRefObject<HTMLDivElement | null> => {
    const ref = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
      if (ref.current) {
        ref.current.scrollTop = ref.current.scrollHeight;
      }
    }, [dep]);
    
    return ref as MutableRefObject<HTMLDivElement | null>;
  };
  
  // Use the custom hook with messages as dependency
  const chatRef = useChatScroll(messages);
  
  let tamboHook;
  try {
    tamboHook = useTambo();
  } catch (error) {
    console.warn('Tambo not available:', error);
    tamboHook = null;
  }

  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem(`uml-rag-chat-messages-${sessionId}`);
      if (savedMessages) {
        const parsed = JSON.parse(savedMessages);
        setMessages(parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
          renderedComponent: undefined
        })));
      }
    } catch (error) {
      console.warn('Failed to load chat messages:', error);
    }
  }, [sessionId]);

  useEffect(() => {
    try {
      const messagesToSave = messages.map(msg => ({
        ...msg,
        renderedComponent: undefined
      }));
      localStorage.setItem(`uml-rag-chat-messages-${sessionId}`, JSON.stringify(messagesToSave.slice(-20)));
    } catch (error) {
      console.warn('Failed to save chat messages:', error);
    }
  }, [messages, sessionId]);

  const startNewConversation = useCallback(() => {
    const newSessionId = `session_${Date.now()}`;
    setSessionId(newSessionId);
    setMessages([]);
    setInputValue('');
    
    const welcomeMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'assistant',
      content: '👋 Hi! I\'m starting a fresh conversation with you. I\'m your UML diagram assistant and I can help you create professional diagrams. What would you like me to design for you today?',
      timestamp: new Date(),
    };
    
    setMessages([welcomeMessage]);
  }, []);

  const callBackendAPI = useCallback(async (userMessageContent: string) => {
    const newUserMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessageContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const history = [...messages, newUserMessage];

      const chatResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-ID': sessionId,
        },
        body: JSON.stringify({
          messages: history.slice(-6).map(msg => ({ role: msg.role, content: msg.content }))
        })
      });

      if (!chatResponse.ok) {
        const errorData = await chatResponse.text();
        throw new Error(`Chat API failed: ${chatResponse.status} ${errorData}`);
      }

      const chatData = await chatResponse.json();

      const assistantMessage: ChatMessage = {
        id: Date.now().toString() + '_assistant',
        role: 'assistant',
        content: chatData.full_response || 'Sorry, I encountered an issue.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      const umlCode = chatData.uml_code;
      if (umlCode) {
        dispatch(setCurrentCode(umlCode));
        dispatch(renderDiagramAsync(umlCode));
      }

    } catch (error) {
      console.error('Backend API error:', error);
      const errorMessage: ChatMessage = {
        id: Date.now().toString() + '_error',
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'An unknown error occurred.'}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, sessionId, dispatch]);

  const handleSendMessage = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputValue.trim() || isLoading || generating) return;
    
    const messageToSend = inputValue.trim();
    setInputValue('');
    await callBackendAPI(messageToSend);
  }, [inputValue, isLoading, generating, callBackendAPI]);

  const handleExampleClick = useCallback(async (example: string) => {
    if (isLoading || generating) return;
    setInputValue(example);
    await callBackendAPI(example);
  }, [isLoading, generating, callBackendAPI]);

  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
      className={isDarkMode ? 'dark-scrollbar' : ''}
    >
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        mb: 1,
        px: 1
      }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Start New Conversation">
            <IconButton onClick={startNewConversation} size="small">
              <AddComment />
            </IconButton>
          </Tooltip>
          <Tooltip title="Clear Current Chat">
            <IconButton 
              onClick={() => setMessages([])} 
              size="small"
              disabled={messages.length === 0}
            >
              <Clear />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box
        className="chat-container"
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1,
          overflow: 'hidden',
          height: '100%',
          maxHeight: '60vh',
        }}
      >
        <Box
          ref={chatRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            p: 2,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minHeight: 'min-content',
          }}
        >
        {messages.length === 0 ? (
          <Box sx={{ 
            textAlign: 'center', 
            py: 4, 
            flex: '1 1 auto', 
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100%',
            width: '100%'
          }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              👋 Hi! I'm your intelligent UML diagram assistant with conversational memory. I can help you create, understand, and modify UML diagrams!
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Click any example above or try these:
              </Typography>
              <Box sx={{ 
                mt: 1, 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: 1, 
                justifyContent: 'center',
                maxHeight: '120px',
                overflowY: 'auto',
                p: 1,
                '&::-webkit-scrollbar': {
                  width: '4px',
                },
                '&::-webkit-scrollbar-track': {
                  background: theme => theme.palette.mode === 'dark' ? '#1E1A2C' : '#EDF2F7',
                  borderRadius: '2px',
                },
                '&::-webkit-scrollbar-thumb': {
                  background: theme => theme.palette.mode === 'dark' ? '#4D2C91' : '#90CDF4',
                  borderRadius: '2px',
                  '&:hover': {
                    background: theme => theme.palette.mode === 'dark' ? '#5A3A9D' : '#63B3ED',
                  }
                }
              }}>
                {examplePrompts.map((example, index) => (
                  <Chip
                    key={index}
                    label={example}
                    variant="outlined"
                    size="small"
                    onClick={() => handleExampleClick(example)}
                    disabled={isLoading || generating}
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(126, 87, 194, 0.12)' : 'rgba(33, 150, 243, 0.12)'
                      },
                      '&.MuiChip-outlined': {
                        borderColor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.23)' : 'rgba(0, 0, 0, 0.23)'
                      }
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        ) : (
          <Box sx={{ width: '100%' }}>
            {messages.map((message) => (
              <Box 
                key={message.id}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: message.role === 'user' ? 'flex-end' : 'flex-start',
                  mb: 2,
                }}
              >
                <Paper
                  sx={{
                    p: 2,
                    maxWidth: '80%',
                    bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                    color: message.role === 'user' ? 'primary.contrastText' : 'text.primary',
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {message.content}
                  </Typography>
                  {message.renderedComponent && (
                    <Box sx={{ mt: 2, p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                      {message.renderedComponent}
                    </Box>
                  )}
                </Paper>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                  {message.role === 'user' ? 'You' : 'AI Assistant'} • {message.timestamp.toLocaleTimeString()}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {(isLoading || generating) && (
          <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
            <CircularProgress size={16} sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              {generating ? 'Generating diagram and updating code editor...' : 'AI is thinking...'}
            </Typography>
          </Box>
        )}
      </Box>

      {!process.env.NEXT_PUBLIC_TAMBO_API_KEY && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Add your Tambo API key to .env.local as NEXT_PUBLIC_TAMBO_API_KEY for enhanced conversational AI
        </Alert>
      )}

      {/* Chat Input */}
      <Paper 
        component="form" 
        onSubmit={handleSendMessage} 
        sx={{ 
          p: 1, 
          display: 'flex', 
          gap: 1,
          backgroundColor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          '&:hover': {
            boxShadow: '0 -2px 4px rgba(0,0,0,0.05)'
          }
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Ask me anything about UML diagrams..."
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={isLoading || generating}
          multiline
          maxRows={3}
        />
        <Button
          type="submit"
          variant="contained"
          color="primary"
          disabled={!inputValue.trim() || isLoading || generating}
          sx={{ minWidth: 'auto', height: '40px' }}
        >
          {isLoading || generating ? <CircularProgress size={20} color="inherit" /> : <Send />}
        </Button>
      </Paper>

      
      {(isLoading || generating) && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
          Processing your request...
        </Typography>
      )}
      </Box>
    </Box>
  );
}
