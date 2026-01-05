import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, TrendingUp, User, Sparkles, X, Minimize2, ExternalLink } from 'lucide-react';
import { getFinancialContext } from '../../lib/financialReportService';
import { generateIntelligentCFOResponse } from '../../lib/intelligentCFOService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[];
  usedExternalSources?: boolean;
}


export function PortalAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Hoi! Ik ben je Virtuele CFO.\n\nIk help je met:\n• Financiële analyses op basis van je cijfers\n• Nederlandse belastingwetgeving\n• Strategisch advies over investeringen en groei\n• Cashflow en liquiditeitsmanagement\n\nWat wil je weten?',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  async function handleSend() {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const financialContext = await getFinancialContext();

      const cfoResponse = await generateIntelligentCFOResponse({
        question: userMessage.content,
        financialData: financialContext,
      });

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: cfoResponse.response,
        timestamp: new Date(),
        sources: cfoResponse.sources,
        usedExternalSources: cfoResponse.usedExternalSources,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('CFO Assistant error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, er ging iets fout bij het ophalen van je financiële data. Probeer het opnieuw.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyPress(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-32 right-4 md:bottom-8 md:right-6 w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full shadow-2xl hover:shadow-emerald-500/50 transition-all duration-300 flex items-center justify-center z-50 hover:scale-110 group"
        aria-label="Open AI Assistent"
      >
        <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-white group-hover:rotate-12 transition-transform" />
        <div className="absolute -top-1 -right-1 w-4 h-4 md:w-5 md:h-5 bg-red-500 rounded-full flex items-center justify-center">
          <span className="text-[9px] md:text-xs font-bold text-white">AI</span>
        </div>
      </button>
    );
  }

  return (
    <div className="fixed bottom-32 right-4 md:bottom-8 md:right-6 w-[calc(100vw-2rem)] max-w-[400px] h-[500px] md:h-[600px] flex flex-col bg-white rounded-2xl shadow-2xl z-50 border border-gray-200 animate-in slide-in-from-bottom-8 duration-300">
      <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-t-2xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-white">Virtuele CFO</h2>
            <p className="text-xs text-white/80">Financiële analyse & advies</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 transition-colors flex items-center justify-center"
          aria-label="Minimaliseren"
        >
          <Minimize2 className="w-4 h-4 text-white" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-br from-gray-50 to-white">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-gray-600 to-gray-700'
                  : 'bg-gradient-to-br from-emerald-500 to-teal-600'
              }`}
            >
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <TrendingUp className="w-4 h-4 text-white" />
              )}
            </div>

            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 shadow-sm ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-gray-700 to-gray-800 text-white'
                  : 'bg-white border border-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>

              {message.role === 'assistant' && message.usedExternalSources && message.sources && message.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    Bronnen:
                  </p>
                  <div className="space-y-1">
                    {message.sources.map((source, idx) => (
                      <a
                        key={idx}
                        href={source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-emerald-600 hover:text-emerald-700 hover:underline block"
                      >
                        {new URL(source).hostname}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <p
                className={`text-xs mt-2 ${
                  message.role === 'user' ? 'text-gray-300' : 'text-gray-500'
                }`}
              >
                {message.timestamp.toLocaleTimeString('nl-NL', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span className="text-sm text-gray-600">Analyseer data...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white rounded-b-2xl p-4 border-t border-gray-100">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Bijv: 'Kan ik een laptop kopen?' of 'Is BTW aftrekbaar?'"
            rows={1}
            className="flex-1 px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-emerald-500 focus:outline-none resize-none text-sm"
            style={{ minHeight: '40px', maxHeight: '80px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white px-4 rounded-xl hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Data-gedreven analyses + Nederlandse wet- en regelgeving
        </p>
      </div>
    </div>
  );
}
