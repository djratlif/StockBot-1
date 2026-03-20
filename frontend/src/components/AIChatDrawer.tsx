import React, { useState, useEffect, useRef } from 'react';
import {
    Drawer,
    Box,
    Typography,
    IconButton,
    TextField,
    Paper,
    Divider,
    CircularProgress
} from '@mui/material';
import {
    Close as CloseIcon,
    Send as SendIcon,
    SmartToy as SmartToyIcon,
    Person as PersonIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

interface AIChatDrawerProps {
    open: boolean;
    onClose: () => void;
}

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000';

const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ open, onClose }) => {
    const { token } = useAuth();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', content: input.trim() };
        const currentHistory = [...messages];

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/chat/ask`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: userMessage.content,
                    chat_history: currentHistory
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get response');
            }

            const data = await response.json();
            setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => [
                ...prev,
                { role: 'assistant', content: 'Connection error: I was unable to connect to our servers.' }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Drawer
            anchor="right"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: { width: { xs: '100%', sm: 400 }, display: 'flex', flexDirection: 'column' }
            }}
        >
            <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <SmartToyIcon />
                    <Typography variant="h6">StockBot AI</Typography>
                </Box>
                <IconButton onClick={onClose} sx={{ color: 'inherit' }}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 2, bgcolor: 'background.default' }}>
                {messages.length === 0 && (
                    <Box sx={{ textAlign: 'center', mt: 4, color: 'text.secondary' }}>
                        <SmartToyIcon sx={{ fontSize: 48, opacity: 0.5, mb: 1 }} />
                        <Typography variant="body1">How can I help you today?</Typography>
                        <Typography variant="body2">Ask me about your portfolio, risk limits, or stock strategy!</Typography>
                    </Box>
                )}

                {messages.map((msg, idx) => (
                    <Box
                        key={idx}
                        sx={{
                            display: 'flex',
                            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                            gap: 1,
                            alignItems: 'flex-end'
                        }}
                    >
                        {msg.role === 'assistant' ? (
                            <SmartToyIcon color="primary" sx={{ fontSize: 20, mb: 0.5 }} />
                        ) : (
                            <PersonIcon color="action" sx={{ fontSize: 20, mb: 0.5 }} />
                        )}
                        <Paper
                            elevation={1}
                            sx={{
                                p: 1.5,
                                maxWidth: '80%',
                                bgcolor: msg.role === 'user' ? 'primary.main' : 'background.paper',
                                color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                                borderRadius: 2,
                                borderBottomRightRadius: msg.role === 'user' ? 4 : 16,
                                borderBottomLeftRadius: msg.role === 'assistant' ? 4 : 16,
                            }}
                        >
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                {msg.content}
                            </Typography>
                        </Paper>
                    </Box>
                ))}
                {isLoading && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        <SmartToyIcon color="primary" sx={{ fontSize: 20 }} />
                        <CircularProgress size={20} />
                    </Box>
                )}
                <div ref={messagesEndRef} />
            </Box>

            <Divider />

            <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
                <TextField
                    fullWidth
                    multiline
                    maxRows={4}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="Ask something..."
                    variant="outlined"
                    sx={{
                        '& .MuiOutlinedInput-root': {
                            borderRadius: 4,
                            pr: 1
                        }
                    }}
                    InputProps={{
                        endAdornment: (
                            <IconButton
                                color="primary"
                                onClick={handleSend}
                                disabled={!input.trim() || isLoading}
                                sx={{ ml: 1 }}
                            >
                                <SendIcon />
                            </IconButton>
                        ),
                    }}
                />
            </Box>
        </Drawer>
    );
};

export default AIChatDrawer;
