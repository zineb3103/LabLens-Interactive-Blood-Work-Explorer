import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Activity, Send, Loader2, Sparkles, Database, FileText,
  TrendingUp, Users, Copy, Check, RotateCcw, MessageSquare,
  Brain, Code, AlertCircle, Lightbulb, Edit3
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  sql?: string;
  data?: any[];
  error?: string;
}

export default function AssistantPage() {
  const router = useRouter();
  const { file_id } = router.query;
  const resolvedFileId = Array.isArray(file_id) ? file_id[0] : file_id ?? '';
  
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handleEditMessage = (message: Message) => {
    if (message.role !== 'user') return;
    setInputMessage(message.content);
    // Focus sur l'input pour que l'utilisateur modifie directement
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  // Exemples de requêtes
  const exampleQueries = [
    "Combien de patients ont plus de 50 ans ?",
    "Quels sont les 5 tests les plus fréquents ?",
    "Affiche la distribution par sexe",
    "Quel est l'âge moyen des patients ?",
    "Trouve les patients avec tests répétés",
    "Quels tests sont souvent ordonnés ensemble ?"
  ];

  useEffect(() => {
    // Message de bienvenue
    if (messages.length === 0) {
      setMessages([{
        id: '0',
        role: 'system',
        content: resolvedFileId 
          ? `🎯 Assistant IA prêt ! Je peux vous aider à analyser le fichier **${resolvedFileId}**.\n\nPosez-moi des questions en langage naturel, je les traduirai en requêtes SQL.`
          : `👋 Bienvenue ! Veuillez d'abord uploader un fichier sur la page Upload, puis revenez ici pour l'analyser avec l'IA.`,
        timestamp: new Date()
      }]);
    }
  }, [resolvedFileId, messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSendMessage = async () => {
    const trimmedMessage = inputMessage.trim();
    if (!trimmedMessage || !resolvedFileId) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedMessage,
      timestamp: new Date()
    };
    
    const conversationHistory = [...messages, userMessage]
      .slice(-5)
      .map(m => ({
        role: m.role,
        content: m.content
      }));

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Appel à l'API LLM (à implémenter côté backend)
      const response = await fetch('http://localhost:8000/api/llm/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: resolvedFileId,
          query: trimmedMessage,
          conversation_history: conversationHistory
        })
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la requête');
      }

      const result = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result.response || result.explanation || 'Réponse reçue.',
        timestamp: new Date(),
        sql: result.success ? result.sql_query : undefined,
        data: result.success ? result.data : undefined,
        error: result.success ? undefined : (result.error || 'La génération SQL a échoué.')
      };
      
      setMessages(prev => [...prev, assistantMessage]);
      
    } catch (error: any) {
      // Fallback: génération locale simple
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateFallbackResponse(trimmedMessage),
        timestamp: new Date(),
        error: 'Backend LLM non disponible - Réponse générée localement'
      };
      
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateFallbackResponse = (query: string): string => {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('age') || lowerQuery.includes('âge')) {
      return `Pour obtenir des statistiques sur l'âge, vous pouvez :\n\n1. Aller dans l'Explorer\n2. Consulter l'onglet "Vue d'ensemble"\n3. Voir la section "Statistiques d'Âge"\n\n**Requête SQL équivalente :**\n\`\`\`sql\nSELECT AVG(edad), MIN(edad), MAX(edad) \nFROM results WHERE file_id = '${resolvedFileId || '...'}'\n\`\`\``;
    }
    
    if (lowerQuery.includes('test') && (lowerQuery.includes('fréquent') || lowerQuery.includes('plus'))) {
      return `Pour voir les tests les plus fréquents :\n\n**Requête SQL :**\n\`\`\`sql\nSELECT nombre, COUNT(*) as count \nFROM results \nWHERE file_id = '${resolvedFileId || '...'}' \nGROUP BY nombre \nORDER BY count DESC \nLIMIT 10\n\`\`\`\n\nVous pouvez aussi consulter l'onglet **Panels** dans l'Explorer.`;
    }
    
    if (lowerQuery.includes('patient') || lowerQuery.includes('combien')) {
      return `Pour compter les patients :\n\n**Requête SQL :**\n\`\`\`sql\nSELECT COUNT(DISTINCT numorden) as total_patients \nFROM results \nWHERE file_id = '${resolvedFileId || '...'}'\n\`\`\`\n\nRendez-vous dans l'Explorer pour voir les statistiques détaillées.`;
    }
    
    return `Je ne peux pas traiter cette requête pour le moment (backend LLM non connecté).\n\n**Suggestions :**\n- Utilisez la page **Explorer** pour filtrer et analyser vos données\n- Consultez les onglets Panels, Repeats et Co-Order\n- Essayez de reformuler votre question\n\n**Requête détectée :** "${query}"`;
  };

  const handleExampleClick = (example: string) => {
    setInputMessage(example);
    inputRef.current?.focus();
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearConversation = () => {
    setMessages([{
      id: '0',
      role: 'system',
      content: `🔄 Conversation réinitialisée. Comment puis-je vous aider ?`,
      timestamp: new Date()
    }]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-cyan-50 flex flex-col">
      {/* Header aligné sur index.tsx */}
      <header className="border-b border-gray-100 bg-white sticky top-0 z-50 shadow-sm">
        <div className="max-w-screen-3xl mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-16 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Activity className="w-9 h-9 sm:w-10 sm:h-10 text-cyan-500" />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent">
                LabLens
              </h1>
            </div>

            <nav className="flex items-center space-x-8 text-sm sm:text-base lg:text-lg">
              <Link
                href="/"
                className="relative px-4 py-2 text-gray-700 font-medium transition-all duration-300"
                onMouseEnter={() => setHoveredNav('Home')}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  transform: hoveredNav === 'Home' ? 'translateY(-2px)' : 'translateY(0)',
                  color: hoveredNav === 'Home' ? '#06b6d4' : '#374151'
                }}
              >
                Home
                {hoveredNav === 'Home' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" />
                )}
              </Link>
              <Link
                href="/upload"
                className="relative px-4 py-2 text-gray-700 font-medium transition-all duration-300"
                onMouseEnter={() => setHoveredNav('Upload')}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  transform: hoveredNav === 'Upload' ? 'translateY(-2px)' : 'translateY(0)',
                  color: hoveredNav === 'Upload' ? '#06b6d4' : '#374151'
                }}
              >
                Upload
                {hoveredNav === 'Upload' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" />
                )}
              </Link>
              <Link
                href="/explorer"
                className="relative px-4 py-2 text-gray-700 font-medium transition-all duration-300"
                onMouseEnter={() => setHoveredNav('Explorer')}
                onMouseLeave={() => setHoveredNav(null)}
                style={{
                  transform: hoveredNav === 'Explorer' ? 'translateY(-2px)' : 'translateY(0)',
                  color: hoveredNav === 'Explorer' ? '#06b6d4' : '#374151'
                }}
              >
                Explorer
                {hoveredNav === 'Explorer' && (
                  <span className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full" />
                )}
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col max-w-screen-3xl w-full mx-auto px-4 sm:px-6 lg:px-12 xl:px-16 py-8">
        {/* Title */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent flex items-center space-x-3">
              <Brain className="w-10 h-10 text-cyan-500" />
              <span>Assistant IA</span>
            </h1>
            <p className="text-gray-600 text-base sm:text-lg md:text-xl">
              Interrogez vos données en langage naturel
            </p>
          </div>
          
          {messages.length > 1 && (
            <button
              onClick={clearConversation}
              className="flex items-center space-x-2 px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Réinitialiser</span>
            </button>
          )}
        </div>

        {/* Chat Container */}
        <div className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-3xl ${message.role === 'user' ? 'ml-12' : 'mr-12'}`}>
                  {/* Avatar & Role */}
                  <div className="flex items-center space-x-2 mb-2">
                    {message.role === 'assistant' && (
                      <>
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-sm font-semibold text-gray-700">Assistant IA</span>
                      </>
                    )}
                    {message.role === 'user' && (
                      <>
                        <span className="text-sm font-semibold text-gray-700">Vous</span>
                        <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-600 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleEditMessage(message)}
                          className="ml-2 inline-flex items-center space-x-1 text-xs text-gray-400 hover:text-cyan-600 transition-colors"
                          title="Éditer ce message"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Éditer</span>
                        </button>
                      </>
                    )}
                    {message.role === 'system' && (
                      <>
                        <MessageSquare className="w-6 h-6 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-500">Système</span>
                      </>
                    )}
                  </div>

                  {/* Message Content */}
                  <div
                    className={`rounded-2xl p-4 ${
                      message.role === 'user'
                        ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white'
                        : message.role === 'system'
                        ? 'bg-gray-100 text-gray-700 border-2 border-gray-200'
                        : 'bg-gray-50 text-gray-800'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>

                    {/* SQL Query Display */}
                    {message.sql && (
                      <div className="mt-4 p-3 bg-gray-800 rounded-lg relative">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Code className="w-4 h-4 text-green-400" />
                            <span className="text-xs text-green-400 font-semibold">Requête SQL générée</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(message.sql!, message.id)}
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            {copiedId === message.id ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <pre className="text-xs text-green-400 overflow-x-auto">
                          {message.sql}
                        </pre>
                      </div>
                    )}

                    {/* Data Preview */}
                    {message.data && message.data.length > 0 && (
                      <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-2 mb-2">
                          <Database className="w-4 h-4 text-cyan-500" />
                          <span className="text-xs text-gray-700 font-semibold">
                            Résultats ({message.data.length} lignes)
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-xs">
                            <thead className="bg-gray-50">
                              <tr>
                                {Object.keys(message.data[0]).map(key => (
                                  <th key={key} className="px-3 py-2 text-left text-gray-700 font-semibold">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {message.data.slice(0, 5).map((row, idx) => (
                                <tr key={idx} className="border-t border-gray-100">
                                  {Object.values(row).map((val: any, i) => (
                                    <td key={i} className="px-3 py-2 text-gray-600">
                                      {String(val)}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {message.data.length > 5 && (
                            <p className="text-xs text-gray-500 mt-2 text-center">
                              ... et {message.data.length - 5} autres lignes
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Error Display */}
                    {message.error && (
                      <div className="mt-4 p-3 bg-amber-50 border-l-4 border-amber-500 rounded">
                        <div className="flex items-start space-x-2">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-amber-800">{message.error}</p>
                        </div>
                      </div>
                    )}

                    <p className="text-xs opacity-60 mt-2">
                      {message.timestamp.toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="max-w-3xl mr-12">
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-sm font-semibold text-gray-700">Assistant IA</span>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4">
                    <div className="flex items-center space-x-3">
                      <Loader2 className="w-5 h-5 text-cyan-500 animate-spin" />
                      <span className="text-gray-600">Analyse en cours...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Example Queries */}
          {messages.length <= 1 && !isLoading && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-2 mb-3">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-gray-700">Exemples de questions :</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {exampleQueries.map((query, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(query)}
                    className="text-left px-4 py-2 bg-white border border-gray-200 rounded-lg hover:border-cyan-500 hover:bg-cyan-50 transition-all text-sm text-gray-700 hover:text-cyan-600"
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Input Area */}
          <div className="p-6 border-t border-gray-200 bg-white">
            {!resolvedFileId ? (
              <div className="text-center py-4">
                <p className="text-gray-500 mb-4">
                  Aucun fichier sélectionné. Uploadez d'abord un fichier pour utiliser l'assistant.
                </p>
                <button
                  onClick={() => router.push('/upload')}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-full hover:scale-105 transition-transform"
                >
                  Aller à l'Upload
                </button>
              </div>
            ) : (
              <div className="flex items-end space-x-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Posez votre question en langage naturel..."
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none"
                    rows={3}
                    disabled={isLoading}
                  />
                  <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                    Shift+Enter pour nouvelle ligne
                  </div>
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="p-4 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {isLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Send className="w-6 h-6" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer aligné sur index.tsx */}
      <footer className="bg-gradient-to-r from-cyan-500 to-blue-600 py-12">
        <div className="max-w-screen-3xl mx-auto w-full px-4 sm:px-6 lg:px-12 xl:px-16">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <Activity className="w-9 h-9 sm:w-10 sm:h-10 text-white" />
              <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">LabLens</h3>
            </div>
            <p className="text-white/90 mb-6 text-base sm:text-lg md:text-xl">
              IDSCC 5 — Artificial Intelligence, ENSAO
            </p>
            <p className="text-white/90 mb-2 text-base sm:text-lg md:text-xl">
              Prof. Abdelmounaim Kerkri
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm sm:text-base md:text-lg text-white/80">
              <span>Farah</span>
              <span>•</span>
              <span>Zineb</span>
              <span>•</span>
              <span>Toufali</span>
              <span>•</span>
              <span>Oumaima</span>
              <span>•</span>
              <span>Qritel</span>
              <span>•</span>
              <span>Salima</span>
            </div>
            <div className="mt-6 pt-6 border-t border-white/20">
              <p className="text-white/70 text-sm sm:text-base">
                © 2025 LabLens. Tous droits réservés.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}