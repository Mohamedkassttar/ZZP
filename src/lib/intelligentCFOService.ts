/**
 * Intelligent CFO Service
 *
 * Makes the virtual CFO smarter by:
 * 1. Detecting vague questions and asking for details
 * 2. Using external sources (Tavily) for Dutch tax & financial regulations
 * 3. Always using specific financial data in analyses
 */

import { AI_CONFIG } from './aiConfig';
import type { FinancialContext } from './financialReportService';

export interface CFOQueryContext {
  question: string;
  financialData: FinancialContext;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface CFOResponse {
  response: string;
  needsClarification: boolean;
  usedExternalSources: boolean;
  sources?: string[];
}

/**
 * Analyze if a question is too vague and needs clarification
 */
export function isQuestionVague(question: string): { isVague: boolean; clarificationNeeded: string } {
  const lowerQuestion = question.toLowerCase();

  // Very generic questions without context
  const vaguePhrases = [
    'hoe gaat het',
    'wat vind je',
    'geef advies',
    'wat moet ik doen',
    'wat denk je',
    'is dit goed',
    'moet ik',
  ];

  const isVeryVague = vaguePhrases.some(phrase => {
    const regex = new RegExp(`^${phrase}(?:\\s|\\?|$)`, 'i');
    return regex.test(lowerQuestion);
  });

  if (isVeryVague && lowerQuestion.length < 30) {
    return {
      isVague: true,
      clarificationNeeded: 'Deze vraag is te breed. Waar wil je specifiek advies over? Bijvoorbeeld: investeringen, liquiditeit, kostenbesparingen, omzetgroei, belastingen?',
    };
  }

  // Check for questions about specific investments without amounts
  if ((lowerQuestion.includes('kopen') || lowerQuestion.includes('aanschaffen') || lowerQuestion.includes('investeren')) &&
      !(/€\s*\d+|\d+\s*euro/i.test(lowerQuestion))) {
    return {
      isVague: true,
      clarificationNeeded: 'Om goed advies te geven over deze aanschaf, heb ik meer details nodig:\n• Wat is het bedrag?\n• Is het een eenmalige of terugkerende uitgave?\n• Voor welk doel (zakelijk/privé)?',
    };
  }

  return { isVague: false, clarificationNeeded: '' };
}

/**
 * Detect if question needs external sources (Dutch tax law, regulations, expert advice)
 */
export function needsExternalSources(question: string): { needs: boolean; topics: string[] } {
  const lowerQuestion = question.toLowerCase();
  const topics: string[] = [];

  // Tax-related keywords
  const taxKeywords = [
    'btw', 'vat', 'belasting', 'fiscaal', 'fiscale',
    'aftrekbaar', 'aftrek', 'aftrekken',
    'vpb', 'vennootschapsbelasting',
    'ib', 'inkomstenbelasting',
    'eigenwoningforfait', 'hypotheekrenteaftrek',
    'kleinschaligheidsinvestering', 'kia',
    'willekeurige afschrijving',
    'btw-aangifte', 'belastingaangifte',
  ];

  // Regulatory/legal keywords
  const regulatoryKeywords = [
    'wet', 'regelgeving', 'compliance',
    'arbeidsrecht', 'cao',
    'minimaal', 'maximaal',
    'wettelijk', 'verplicht',
  ];

  // Financial regulations
  const financialRegKeywords = [
    'rente aftrek', 'renteaftrek',
    'krediet', 'lening', 'financiering',
    'pensioen', 'lijfrente',
    'wft', 'wwft',
  ];

  if (taxKeywords.some(kw => lowerQuestion.includes(kw))) {
    topics.push('Nederlandse belastingwetgeving');
  }

  if (regulatoryKeywords.some(kw => lowerQuestion.includes(kw))) {
    topics.push('Nederlandse wet- en regelgeving');
  }

  if (financialRegKeywords.some(kw => lowerQuestion.includes(kw))) {
    topics.push('Financiële regelgeving Nederland');
  }

  return {
    needs: topics.length > 0,
    topics,
  };
}

/**
 * Search for Dutch tax and financial regulations using Tavily
 */
export async function searchDutchRegulations(query: string, topics: string[]): Promise<{ summary: string; sources: string[] }> {
  const tavilyApiKey = import.meta.env.VITE_TAVILY_API_KEY;

  if (!tavilyApiKey) {
    console.log('⚠ No Tavily API key, skipping external search');
    return { summary: '', sources: [] };
  }

  try {
    // Build context-aware search query for Dutch regulations
    const searchQuery = `${query} Nederland ${new Date().getFullYear()} officiele regelgeving belastingdienst rijksoverheid`;

    console.log(`🔍 [CFO TAVILY] Searching regulations: "${searchQuery}"`);

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: tavilyApiKey,
        query: searchQuery,
        search_depth: 'advanced',
        max_results: 5,
        include_answer: true,
        include_domains: [
          'belastingdienst.nl',
          'rijksoverheid.nl',
          'kvk.nl',
          'afm.nl',
          'dnb.nl',
        ],
      }),
    });

    if (!response.ok) {
      console.error('❌ Tavily search failed:', response.status);
      return { summary: '', sources: [] };
    }

    const data = await response.json();
    console.log('✅ [CFO TAVILY] Got response');

    // Extract answer and sources
    const summary = data.answer || '';
    const sources = (data.results || [])
      .map((r: any) => r.url)
      .filter((url: string) => url)
      .slice(0, 3);

    return { summary, sources };
  } catch (error) {
    console.error('❌ Error searching regulations:', error);
    return { summary: '', sources: [] };
  }
}

/**
 * Build enhanced CFO system prompt with external knowledge capability
 */
export function buildEnhancedCFOPrompt(hasExternalData: boolean): string {
  const basePrompt = `Je bent de Virtuele CFO en Financial Controller van dit bedrijf.

JOUW EXPERTISE:
• Financiële analyse op basis van concrete cijfers
• Nederlandse fiscaliteit en wet- en regelgeving
• Strategisch advies voor ondernemers en ZZP'ers
• Risicomanagement en cashflow optimalisatie

WERKWIJZE:
1. ANALYSEER EERST: Begrijp de context en de beschikbare data
2. CHECK CIJFERS: Gebruik altijd specifieke bedragen, percentages, ratio's
3. ZOEK PATRONEN: Trends, afwijkingen, risico's
4. EXTERNE KENNIS: ${hasExternalData ? 'Gebruik betrouwbare bronnen (Belastingdienst, etc.)' : 'Baseer je op algemene kennis'}
5. CONCREET ADVIES: Geef uitvoerbare actiepunten

STIJL:
• Zakelijk maar toegankelijk
• To-the-point en geen wollige taal
• Gebruik concrete cijfers (€, %, ratio's)
• Noem altijd de bron bij externe informatie
• Maximaal 6-8 zinnen voor korte vragen, langer voor diepgaande analyses

VOORBEELDEN VAN GOEDE ANTWOORDEN:

Vraag: "Kan ik een laptop van €2000 kopen?"
Antwoord:
"FINANCIËLE POSITIE:
• Banksaldo: €15.400
• Runway: 2,1 maanden (kritiek laag!)
• Openstaande debiteuren: €8.500

ADVIES: Focus eerst op debiteureninning. Met een runway van 2,1 maanden is elke grote uitgave risicovol. De laptop kan wel als investering worden afgeschreven over 3-5 jaar.

FISCAAL: Voor ZZP: maximaal 20% Klein­schaligheids­investerings­aftrek (KIA) mogelijk = €400 extra voordeel."

Vraag: "Is BTW aftrekbaar op representatiekosten?"
Antwoord:
"NEE - BTW op representatiekosten is NIET aftrekbaar (art. 15 Wet OB).

Representatiekosten zijn kosten voor relatiegeschenken, zakendiners, etc. De wetgever heeft dit bewust uitgesloten.

WEL AFTREKBAAR:
• Normale kantinevoorziening personeel
• Kosten voor seminars/opleidingen (incl. lunch)
• Vrijwel alle andere zakelijke kosten

Let op: De kostenpost zelf is WEL aftrekbaar van de winst, alleen de BTW niet.

Bron: Belastingdienst, art. 15 Wet op de omzetbelasting"`;

  return basePrompt;
}

/**
 * Generate intelligent CFO response
 */
export async function generateIntelligentCFOResponse(context: CFOQueryContext): Promise<CFOResponse> {
  const { question, financialData } = context;

  // Step 1: Check if question is too vague
  const vagueCheck = isQuestionVague(question);
  if (vagueCheck.isVague) {
    return {
      response: vagueCheck.clarificationNeeded,
      needsClarification: true,
      usedExternalSources: false,
    };
  }

  // Step 2: Check if we need external sources
  const externalCheck = needsExternalSources(question);
  let externalKnowledge = '';
  let sources: string[] = [];

  if (externalCheck.needs) {
    console.log(`🔍 Question needs external sources: ${externalCheck.topics.join(', ')}`);
    const regulations = await searchDutchRegulations(question, externalCheck.topics);
    if (regulations.summary) {
      externalKnowledge = `\n\nEXTERNE KENNIS (betrouwbare bronnen):\n${regulations.summary}\n\nBronnen: ${regulations.sources.join(', ')}`;
      sources = regulations.sources;
    }
  }

  // Step 3: Build enhanced prompt
  const systemPrompt = buildEnhancedCFOPrompt(externalKnowledge.length > 0);

  // Step 4: Format financial context
  const financialContext = formatFinancialDataForCFO(financialData);

  // Step 5: Call OpenAI with enhanced context
  try {
    const openaiApiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (!openaiApiKey) {
      return {
        response: 'Sorry, de AI service is niet beschikbaar. Check of VITE_OPENAI_API_KEY is ingesteld.',
        needsClarification: false,
        usedExternalSources: false,
      };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: AI_CONFIG.model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `FINANCIËLE DATA:\n${financialContext}${externalKnowledge}\n\nVRAAG:\n${question}\n\nGEEF EEN SCHERPE, DATAGEDREVEN CFO-ANALYSE met concrete cijfers en actiepunten.`,
          },
        ],
        temperature: AI_CONFIG.temperature,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      throw new Error('OpenAI API call failed');
    }

    const data = await response.json();
    const assistantContent = data.choices[0]?.message?.content || 'Sorry, ik kon geen antwoord genereren.';

    return {
      response: assistantContent,
      needsClarification: false,
      usedExternalSources: externalCheck.needs && sources.length > 0,
      sources: sources.length > 0 ? sources : undefined,
    };
  } catch (error) {
    console.error('❌ Error generating CFO response:', error);
    return {
      response: 'Sorry, er ging iets fout bij het genereren van het antwoord. Probeer het opnieuw.',
      needsClarification: false,
      usedExternalSources: false,
    };
  }
}

/**
 * Format financial data for CFO analysis
 */
function formatFinancialDataForCFO(data: FinancialContext): string {
  const current = data.status;
  const comparison = data.comparison_last_year;
  const ratios = data.ratios;

  return `═══════════════════════════════════════
FINANCIËLE CIJFERS (${data.current_year})
═══════════════════════════════════════

RESULTAAT:
• Omzet YTD: €${current.revenue_ytd.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Kosten YTD: €${current.expenses_ytd.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Nettowinst: €${current.net_profit.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Winstmarge: ${ratios.profit_margin_percent.toFixed(1)}%

YEAR-OVER-YEAR VERGELIJKING:
• Omzetgroei: ${comparison.revenue_growth_percent >= 0 ? '+' : ''}${comparison.revenue_growth_percent.toFixed(1)}%
• Kostengroei: ${comparison.expenses_growth_percent >= 0 ? '+' : ''}${comparison.expenses_growth_percent.toFixed(1)}%
• Margeontwikkeling: ${comparison.margin_growth_percent >= 0 ? '+' : ''}${comparison.margin_growth_percent.toFixed(1)}%

LIQUIDITEIT:
• Banksaldo: €${current.bank_balance.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Debiteuren: €${current.accounts_receivable.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Crediteuren: €${current.accounts_payable.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Werkkapitaal: €${ratios.working_capital.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}
• Runway: ${ratios.runway_months.toFixed(1)} maanden

SIGNALEN:
${data.insights.map(insight => `• ${insight}`).join('\n')}`;
}
