import { supabase } from './supabase';

export interface PrivateTaxData {
  id?: string;
  fiscal_year_id?: string;
  has_fiscal_partner: boolean;
  children_count: number;
  wage_income: number;
  other_income: number;
  woz_value: number;
  mortgage_interest_paid: number;
  notional_rental_value: number;
  savings: number;
  investments: number;
  debts: number;
  partner_data: {
    wage_income?: number;
    other_income?: number;
    savings?: number;
    investments?: number;
    debts?: number;
  };
  deduction_split_percentage: number;
  partner_name?: string;
  partner_bsn?: string;
}

export interface PersonTaxResult {
  box1Income: number;
  box1Deductions: number;
  box1TaxableIncome: number;
  box1Tax: number;
  box3Assets: number;
  box3Debts: number;
  box3TaxableBase: number;
  box3Tax: number;
  totalTax: number;
}

export interface TaxOptimizationResult {
  userTax: PersonTaxResult;
  partnerTax: PersonTaxResult;
  combinedTax: number;
  splitPercentage: number;
}

const TAX_BRACKETS_2024 = [
  { limit: 75518, rate: 0.3693 },
  { limit: Infinity, rate: 0.495 },
];

const BOX3_EXEMPT_AMOUNT = 57000;
const BOX3_TAX_RATE = 0.36;
const EIGENWONINGFORFAIT_RATE = 0.0035;

export function calculateEigenwoningforfait(wozValue: number): number {
  return wozValue * EIGENWONINGFORFAIT_RATE;
}

export function calculateBox1Tax(taxableIncome: number): number {
  if (taxableIncome <= 0) return 0;

  let tax = 0;
  let remainingIncome = taxableIncome;
  let previousLimit = 0;

  for (const bracket of TAX_BRACKETS_2024) {
    const bracketSize = bracket.limit - previousLimit;
    const taxableInBracket = Math.min(remainingIncome, bracketSize);

    tax += taxableInBracket * bracket.rate;
    remainingIncome -= taxableInBracket;

    if (remainingIncome <= 0) break;
    previousLimit = bracket.limit;
  }

  return Math.round(tax * 100) / 100;
}

export function calculateBox3Tax(
  savings: number,
  investments: number,
  debts: number,
  exemptAmount: number = BOX3_EXEMPT_AMOUNT
): { taxableBase: number; tax: number } {
  const totalAssets = savings + investments;
  const netAssets = totalAssets - debts;
  const taxableBase = Math.max(0, netAssets - exemptAmount);

  const fictitiousReturn = taxableBase * BOX3_TAX_RATE;
  const tax = fictitiousReturn * 0.32;

  return {
    taxableBase: Math.round(taxableBase * 100) / 100,
    tax: Math.round(tax * 100) / 100,
  };
}

export function calculatePersonTax(
  box1Income: number,
  box1Deductions: number,
  savings: number,
  investments: number,
  debts: number,
  box3ExemptAmount: number = BOX3_EXEMPT_AMOUNT
): PersonTaxResult {
  const box1TaxableIncome = Math.max(0, box1Income - box1Deductions);
  const box1Tax = calculateBox1Tax(box1TaxableIncome);

  const box3Result = calculateBox3Tax(savings, investments, debts, box3ExemptAmount);

  return {
    box1Income,
    box1Deductions,
    box1TaxableIncome,
    box1Tax,
    box3Assets: savings + investments,
    box3Debts: debts,
    box3TaxableBase: box3Result.taxableBase,
    box3Tax: box3Result.tax,
    totalTax: box1Tax + box3Result.tax,
  };
}

export function optimizeTaxDistribution(
  businessProfit: number,
  userData: {
    wageIncome: number;
    otherIncome: number;
    savings: number;
    investments: number;
    debts: number;
  },
  partnerData: {
    wageIncome: number;
    otherIncome: number;
    savings: number;
    investments: number;
    debts: number;
  },
  mortgageInterest: number,
  eigenwoningforfait: number,
  splitPercentage: number
): TaxOptimizationResult {
  const mortgageDeduction = Math.max(0, mortgageInterest - eigenwoningforfait);

  const userMortgageShare = mortgageDeduction * (splitPercentage / 100);
  const partnerMortgageShare = mortgageDeduction * (1 - splitPercentage / 100);

  const userBox1Income = businessProfit + userData.wageIncome + userData.otherIncome;
  const userBox1Deductions = userMortgageShare;

  const partnerBox1Income = partnerData.wageIncome + partnerData.otherIncome;
  const partnerBox1Deductions = partnerMortgageShare;

  const userBox3ExemptAmount = BOX3_EXEMPT_AMOUNT;
  const partnerBox3ExemptAmount = BOX3_EXEMPT_AMOUNT;

  const userTax = calculatePersonTax(
    userBox1Income,
    userBox1Deductions,
    userData.savings,
    userData.investments,
    userData.debts,
    userBox3ExemptAmount
  );

  const partnerTax = calculatePersonTax(
    partnerBox1Income,
    partnerBox1Deductions,
    partnerData.savings,
    partnerData.investments,
    partnerData.debts,
    partnerBox3ExemptAmount
  );

  return {
    userTax,
    partnerTax,
    combinedTax: userTax.totalTax + partnerTax.totalTax,
    splitPercentage,
  };
}

export function findOptimalDistribution(
  businessProfit: number,
  userData: {
    wageIncome: number;
    otherIncome: number;
    savings: number;
    investments: number;
    debts: number;
  },
  partnerData: {
    wageIncome: number;
    otherIncome: number;
    savings: number;
    investments: number;
    debts: number;
  },
  mortgageInterest: number,
  eigenwoningforfait: number
): { optimalSplit: number; minTax: number } {
  let optimalSplit = 50;
  let minTax = Infinity;

  for (let split = 0; split <= 100; split += 1) {
    const result = optimizeTaxDistribution(
      businessProfit,
      userData,
      partnerData,
      mortgageInterest,
      eigenwoningforfait,
      split
    );

    if (result.combinedTax < minTax) {
      minTax = result.combinedTax;
      optimalSplit = split;
    }
  }

  return { optimalSplit, minTax };
}

export async function loadPrivateTaxData(fiscalYearId: string): Promise<PrivateTaxData | null> {
  try {
    const { data, error } = await supabase
      .from('tax_returns_private')
      .select('*')
      .eq('fiscal_year_id', fiscalYearId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      fiscal_year_id: data.fiscal_year_id,
      has_fiscal_partner: data.has_fiscal_partner || false,
      children_count: data.children_count || 0,
      wage_income: Number(data.wage_income) || 0,
      other_income: Number(data.other_income) || 0,
      woz_value: Number(data.woz_value) || 0,
      mortgage_interest_paid: Number(data.mortgage_interest_paid) || 0,
      notional_rental_value: Number(data.notional_rental_value) || 0,
      savings: Number(data.savings) || 0,
      investments: Number(data.investments) || 0,
      debts: Number(data.debts) || 0,
      partner_data: data.partner_data || {},
      deduction_split_percentage: data.deduction_split_percentage || 50,
      partner_name: data.partner_name,
      partner_bsn: data.partner_bsn,
    };
  } catch (error) {
    return null;
  }
}

export async function savePrivateTaxData(
  data: PrivateTaxData
): Promise<{ success: boolean; error?: string; id?: string }> {
  try {
    const notionalRentalValue = calculateEigenwoningforfait(data.woz_value);

    const dataToSave = {
      fiscal_year_id: data.fiscal_year_id,
      has_fiscal_partner: data.has_fiscal_partner,
      children_count: data.children_count,
      wage_income: data.wage_income,
      other_income: data.other_income,
      woz_value: data.woz_value,
      mortgage_interest_paid: data.mortgage_interest_paid,
      notional_rental_value: notionalRentalValue,
      savings: data.savings,
      investments: data.investments,
      debts: data.debts,
      partner_data: data.partner_data,
      deduction_split_percentage: data.deduction_split_percentage,
      partner_name: data.partner_name,
      partner_bsn: data.partner_bsn,
      updated_at: new Date().toISOString(),
    };

    if (data.id) {
      const { error } = await supabase
        .from('tax_returns_private')
        .update(dataToSave)
        .eq('id', data.id);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, id: data.id };
    } else {
      const { data: newData, error } = await supabase
        .from('tax_returns_private')
        .insert(dataToSave)
        .select('id')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, id: newData.id };
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
