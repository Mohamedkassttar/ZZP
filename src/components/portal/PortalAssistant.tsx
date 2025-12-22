import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SYSTEM_PROMPT = `Je bent een strikte Nederlandse belastingassistent voor ZZP'ers en kleine ondernemers.

REGELS:
- Baseer je antwoorden UITSLUITEND op informatie van belastingdienst.nl, kvk.nl of rijksoverheid.nl
- Geef extreem korte, bondige antwoorden
- Gebruik bulletpoints waar mogelijk
- Maximaal 3-4 zinnen per antwoord
- Voeg ALTIJD toe: "⚠️ Check dit bij je boekhouder"
- Als je het niet zeker weet, zeg dan eerlijk: "Ik weet het niet zeker"
- Geen lappen tekst, direct to the point

VOORBEELDEN:
User: "Mag ik mijn telefoon aftrekken?"
Assistent: "Ja, als je deze zakelijk gebruikt:
• 100% zakelijk = volledig aftrekbaar
• Ook privé = 80% aftrekbaar (zakelijk deel)
• BTW kan je terugvragen

⚠️ Check dit bij je boekhouder"

User: "Wat is de BTW-vrijstelling?"
Assistent: "€20.000 omzet in het jaar.
• Daaronder = vrijstelling mogelijk
• Voordeel: geen BTW berekenen
• Nadeel: geen BTW terugvragen

⚠️ Check dit bij je boekhouder"`;

export function PortalAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Hoi! Ik help je met Nederlandse belastingvragen. Stel je vraag!',
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
      const tavilyApiKey = import.meta.env.VITE_TAVILY_API_KEY;
      let context = '';

      if (tavilyApiKey) {
        try {
          const searchQuery = `${userMessage.content} Nederlands belasting ZZP`;
          const tavilyResponse = await fetch('https://api.tavily.com/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              api_key: tavilyApiKey,
              query: searchQuery,
              search_depth: 'basic',
              max_results: 3,
              include_answer: true,
              include_domains: ['belastingdienst.nl', 'kvk.nl', 'rijksoverheid.nl'],
            }),
          });

          if (tavilyResponse.ok) {
            const tavilyData = await tavilyResponse.json();
            context = tavilyData.answer || tavilyData.results?.map((r: any) => r.content).join('\n') || '';
          }
        } catch (error) {
          console.warn('Tavily search failed, proceeding without context');
        }
      }

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Context van betrouwbare bronnen:\n${context}\n\nVraag: ${userMessage.content}`,
            },
          ],
          temperature: 0.7,
          max_tokens: 300,
        }),
      });

      if (!response.ok) throw new Error('API request failed');

      const data = await response.json();
      const assistantContent = data.choices[0]?.message?.content || 'Sorry, ik kon geen antwoord genereren.';

      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: assistantContent,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Assistant error:', error);
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, er ging iets fout. Probeer het opnieuw.',
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

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-2xl mx-auto">
      <div className="bg-white rounded-t-3xl shadow-lg p-4 border border-gray-100 border-b-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Fiscale AI Assistent</h2>
            <p className="text-xs text-gray-500">Belastingdienst.nl informatie</p>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white border-x border-gray-100 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-gray-600 to-gray-700'
                  : 'bg-gradient-to-br from-blue-500 to-blue-600'
              }`}
            >
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : (
                <Bot className="w-4 h-4 text-white" />
              )}
            </div>

            <div
              className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-gray-700 to-gray-800 text-white'
                  : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
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
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-gray-600">Zoekt informatie...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="bg-white rounded-b-3xl shadow-lg p-4 border border-gray-100 border-t-0">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Stel je belastingvraag..."
            rows={1}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:outline-none resize-none"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-blue-600 text-white p-3 rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Antwoorden zijn gebaseerd op officiële bronnen. Altijd dubbelchecken bij je boekhouder!
        </p>
      </div>
    </div>
  );
}
