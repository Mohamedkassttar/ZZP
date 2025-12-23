import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, TrendingUp, User } from 'lucide-react';
import { getFinancialContext, formatFinancialContextForAI } from '../../lib/financialReportService';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const CFO_SYSTEM_PROMPT = `Je bent de Virtuele CFO en Financial Controller van dit bedrijf.
Je analyseert de financiële gezondheid op basis van boekjaren, trends en ratio's.

JOUW STIJL:
• Zakelijk en to-the-point
• Denk in risico's en kansen
• Geef concrete, uitvoerbare adviezen
• Gebruik financiële termen: YoY groei, winstmarge, runway, cashflow
• Maximaal 5-6 zinnen, tenzij een diepere analyse nodig is

ANALYSE FRAMEWORK:
1. TRENDS: Vergelijk altijd met vorig jaar (Year-over-Year)
   - Is de omzet gestegen of gedaald?
   - Stijgen kosten sneller dan omzet? (= margedruk)

2. LIQUIDITEIT: Check de cashflow positie
   - Runway < 3 maanden = waarschuwing
   - Veel debiteuren = creditmanagement issue
   - Werkkapitaal negatief = gevaar

3. WINSTGEVENDHEID: Analyseer de marges
   - Winstmarge < 10% = te laag voor gezonde groei
   - Bruto marge dalend = prijsdruk of kostenstijging

4. ADVIES: Concrete acties
   - Investeringen? Check of cashflow het toelaat
   - Groei? Kijk of de marge het kan dragen
   - Kostenbesparingen? Focus op grootste kostenposten

VOORBEELDEN:
User: "Kan ik een nieuwe laptop kopen van €2000?"
Assistent: "Op basis van je cijfers:
• Banksaldo: €15.400
• Runway: 2,1 maanden (onder de veilige 3 maanden!)
• Je hebt €8.500 aan openstaande debiteuren

⚠️ ADVIES: Focus eerst op het innen van je debiteuren. Met 2,1 maanden runway is elke uitgave risicovol. Als je de laptop echt nodig hebt, maak er dan een investering van die je afschrijft."

User: "Hoe gaat het met mijn bedrijf?"
Assistent: "FINANCIËLE GEZONDHEID:
• Omzet: +20% YoY - uitstekende groei!
• Kosten: +5% YoY - goed onder controle
• Winstmarge: 29% - zeer gezond

⚠️ AANDACHTSPUNT: Je runway is slechts 2,1 maanden. Bij deze groei wil je minimaal 6 maanden buffer. Prioriteer cashflow management."`;


export function PortalAssistant() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Hoi! Ik ben je Virtuele CFO. Ik analyseer je financiële cijfers en geef advies op basis van trends en ratio\'s. Wat wil je weten?',
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
      const financialContext = await getFinancialContext();
      const formattedContext = formatFinancialContextForAI(financialContext);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: CFO_SYSTEM_PROMPT },
            {
              role: 'user',
              content: `${formattedContext}\n\nVRAAG VAN GEBRUIKER:\n${userMessage.content}\n\nGEEF EEN SCHERPE CFO-ANALYSE MET CONCRETE ADVIEZEN.`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
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

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-2xl mx-auto">
      <div className="bg-white rounded-t-3xl shadow-lg p-4 border border-gray-100 border-b-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Virtuele CFO</h2>
            <p className="text-xs text-gray-500">Financiële analyse & advies op basis van je cijfers</p>
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
            <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center flex-shrink-0">
              <TrendingUp className="w-4 h-4 text-white" />
            </div>
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                <span className="text-sm text-gray-600">Analyseer financiële data...</span>
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
            placeholder="Stel je financiële vraag... (bijv. 'Hoe gaat het met mijn bedrijf?')"
            rows={1}
            className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-emerald-500 focus:outline-none resize-none"
            style={{ minHeight: '48px', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-emerald-600 text-white p-3 rounded-2xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Analyse is gebaseerd op je actuele boekhouding met vergelijking YoY
        </p>
      </div>
    </div>
  );
}
