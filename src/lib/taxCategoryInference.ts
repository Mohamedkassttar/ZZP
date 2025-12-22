import type { DutchTaxCategory } from './database.types';

type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

interface KeywordRule {
  category: DutchTaxCategory;
  keywords: string[];
  allowedTypes: AccountType[];
}

const BALANCE_SHEET_CATEGORIES: DutchTaxCategory[] = [
  'Materiële vaste activa',
  'Immateriële vaste activa',
  'Financiële vaste activa',
  'Voorraden',
  'Vorderingen',
  'Liquide middelen',
  'Kortlopende schulden',
  'Langlopende schulden',
  'Ondernemingsvermogen',
];

const PROFIT_LOSS_CATEGORIES: DutchTaxCategory[] = [
  'Netto Omzet',
  'Inkoopwaarde van de omzet',
  'Afschrijvingen',
  'Huisvestingskosten',
  'Kantoorkosten',
  'Kosten van vervoer',
  'Verkoopkosten',
  'Personeelskosten',
  'Algemene kosten',
  'Rente en bankkosten',
];

export const ALL_TAX_CATEGORIES: DutchTaxCategory[] = [
  ...BALANCE_SHEET_CATEGORIES,
  ...PROFIT_LOSS_CATEGORIES,
];

const KEYWORD_RULES: KeywordRule[] = [
  {
    category: 'Netto Omzet',
    keywords: ['omzet', 'verkoop', 'opbrengst', 'dienstverlening', 'uurtarief', 'factuur', 'sales'],
    allowedTypes: ['REVENUE'],
  },
  {
    category: 'Inkoopwaarde van de omzet',
    keywords: ['inkoop', 'grondstof', 'materiaal', 'cogs'],
    allowedTypes: ['EXPENSE'],
  },
  {
    category: 'Huisvestingskosten',
    keywords: ['huur', 'gas', 'water', 'licht', 'energie', 'pand', 'schoonmaak', 'elektra', 'stroom', 'huisvesting'],
    allowedTypes: ['EXPENSE'],
  },
  {
    category: 'Kosten van vervoer',
    keywords: ['brandstof', 'benzine', 'diesel', 'parkeren', 'trein', 'reiskosten', 'km', 'lease', 'vervoer', 'transport', 'ov', 'onderhoud auto'],
    allowedTypes: ['EXPENSE'],
  },
  {
    category: 'Kantoorkosten',
    keywords: ['telefoon', 'internet', 'mobiel', 'software', 'licentie', 'kantoor', 'papier', 'porto', 'drukwerk', 'abonnement', 'subscriptie'],
    allowedTypes: ['EXPENSE'],
  },
  {
    category: 'Verkoopkosten',
    keywords: ['reclame', 'advertentie', 'marketing', 'google', 'facebook', 'relatiegeschenk', 'representatie', 'etentje', 'linkedin', 'social media'],
    allowedTypes: ['EXPENSE'],
  },
  {
    category: 'Algemene kosten',
    keywords: ['verzekering', 'administratie', 'boekhouder', 'advies', 'contributie', 'accountant', 'juridisch', 'algemeen'],
    allowedTypes: ['EXPENSE'],
  },
  {
    category: 'Rente en bankkosten',
    keywords: ['bankkosten', 'rente', 'interest', 'transactiekosten'],
    allowedTypes: ['EXPENSE'],
  },
  {
    category: 'Afschrijvingen',
    keywords: ['afschrijving', 'depreciation', 'afschrijvingskosten'],
    allowedTypes: ['EXPENSE'],
  },
  {
    category: 'Materiële vaste activa',
    keywords: ['inventaris', 'laptop', 'computer', 'machine', 'meubilair', 'apparatuur', 'vaste activa', 'auto', 'bus', 'bedrijfswagen', 'gebouw'],
    allowedTypes: ['ASSET'],
  },
  {
    category: 'Liquide middelen',
    keywords: ['bank', 'kas', 'rabobank', 'ing', 'bunq', 'knab', 'abn', 'liquide', 'betaalrekening', 'spaarrekening', 'giro'],
    allowedTypes: ['ASSET'],
  },
  {
    category: 'Vorderingen',
    keywords: ['debiteuren', 'vordering', 'receivable', 'te ontvangen', 'nog te factureren'],
    allowedTypes: ['ASSET'],
  },
  {
    category: 'Voorraden',
    keywords: ['voorraad', 'inventory', 'stock'],
    allowedTypes: ['ASSET'],
  },
  {
    category: 'Kortlopende schulden',
    keywords: ['crediteuren', 'schuld', 'te betalen', 'payable', 'kort', 'btw', 'loonheffing', 'belasting te betalen'],
    allowedTypes: ['LIABILITY'],
  },
  {
    category: 'Langlopende schulden',
    keywords: ['lening', 'hypotheek', 'langlopend', 'long term'],
    allowedTypes: ['LIABILITY'],
  },
  {
    category: 'Ondernemingsvermogen',
    keywords: ['kapitaal', 'eigen vermogen', 'winst', 'equity', 'privé'],
    allowedTypes: ['EQUITY'],
  },
];

export function inferTaxCategory(
  accountName: string,
  accountCode: string,
  accountType: AccountType
): DutchTaxCategory | null {
  try {
    if (!accountName || !accountCode || !accountType) return null;

    const normalizedName = accountName.toLowerCase().trim();
    const code = parseInt(accountCode, 10);

    if (isNaN(code)) return null;

    if (code >= 8000 && code <= 8999) {
      return accountType === 'REVENUE' ? 'Netto Omzet' : null;
    }

    if (code >= 7000 && code <= 7999) {
      return accountType === 'EXPENSE' ? 'Inkoopwaarde van de omzet' : null;
    }

    if (code >= 0 && code <= 999) {
      if (accountType !== 'ASSET') return null;

      if (normalizedName.includes('immaterieel')) {
        return 'Immateriële vaste activa';
      }
      if (normalizedName.includes('financieel') || normalizedName.includes('deelneming')) {
        return 'Financiële vaste activa';
      }
      return 'Materiële vaste activa';
    }

    if (code >= 1000 && code <= 1999) {
      if (accountType === 'ASSET') {
        if (normalizedName.includes('bank') || normalizedName.includes('kas') || normalizedName.includes('liquide')) {
          return 'Liquide middelen';
        }
        if (normalizedName.includes('voorraad') || normalizedName.includes('inventory')) {
          return 'Voorraden';
        }
        return 'Vorderingen';
      }

      if (accountType === 'LIABILITY') {
        return 'Kortlopende schulden';
      }

      return null;
    }

    if (code >= 9000 && code <= 9999) {
      if (accountType !== 'EXPENSE') return null;

      if (normalizedName.includes('rente') || normalizedName.includes('interest')) {
        return 'Rente en bankkosten';
      }
      return 'Algemene kosten';
    }

    if (code >= 4000 && code <= 4999) {
      return accountType === 'EXPENSE' ? 'Kosten van vervoer' : null;
    }

    if (code >= 6000 && code <= 6999) {
      if (accountType === 'EXPENSE' && normalizedName.includes('afschrijving')) {
        return 'Afschrijvingen';
      }
      return null;
    }

    const isBalanceSheetType = accountType === 'ASSET' || accountType === 'LIABILITY' || accountType === 'EQUITY';
    const isProfitLossType = accountType === 'REVENUE' || accountType === 'EXPENSE';

    for (const rule of KEYWORD_RULES) {
      if (!rule.allowedTypes.includes(accountType)) {
        continue;
      }

      for (const keyword of rule.keywords) {
        if (normalizedName.includes(keyword.toLowerCase())) {
          const categoryIsBalanceSheet = BALANCE_SHEET_CATEGORIES.includes(rule.category);
          const categoryIsProfitLoss = PROFIT_LOSS_CATEGORIES.includes(rule.category);

          if (isBalanceSheetType && categoryIsBalanceSheet) {
            return rule.category;
          }

          if (isProfitLossType && categoryIsProfitLoss) {
            return rule.category;
          }
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error in inferTaxCategory:', error);
    return null;
  }
}

export function inferTaxCategoryWithConfidence(
  accountName: string,
  accountCode: string,
  accountType: AccountType
): { category: DutchTaxCategory | null; confidence: number } {
  const category = inferTaxCategory(accountName, accountCode, accountType);

  if (!category) {
    return { category: null, confidence: 0 };
  }

  const code = parseInt(accountCode, 10);
  const normalizedName = accountName.toLowerCase().trim();

  if (code >= 8000 && code <= 8999) {
    return { category, confidence: 100 };
  }

  if (code >= 7000 && code <= 7999) {
    return { category, confidence: 100 };
  }

  if (code >= 0 && code <= 999) {
    return { category, confidence: 95 };
  }

  let matchCount = 0;
  for (const rule of KEYWORD_RULES) {
    if (rule.category === category) {
      for (const keyword of rule.keywords) {
        if (normalizedName.includes(keyword.toLowerCase())) {
          matchCount++;
        }
      }
      break;
    }
  }

  const confidence = matchCount > 0 ? Math.min(90, 60 + matchCount * 15) : 50;

  return { category, confidence };
}
