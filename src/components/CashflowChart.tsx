import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp } from 'lucide-react';

interface MonthData {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export function CashflowChart() {
  const [data, setData] = useState<MonthData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCashflowData();
  }, []);

  async function loadCashflowData() {
    try {
      setLoading(true);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: journalEntries, error } = await supabase
        .from('journal_entries')
        .select(`
          id,
          entry_date,
          status,
          journal_lines (
            debit,
            credit,
            account:accounts (
              type
            )
          )
        `)
        .eq('status', 'Final')
        .gte('entry_date', sixMonthsAgo.toISOString().split('T')[0])
        .order('entry_date');

      if (error) throw error;

      const monthlyData: { [key: string]: { income: number; expenses: number } } = {};

      journalEntries?.forEach((entry) => {
        const entryDate = new Date(entry.entry_date);
        const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = { income: 0, expenses: 0 };
        }

        entry.journal_lines?.forEach((line: any) => {
          if (line.account?.type === 'Revenue') {
            monthlyData[monthKey].income += Number(line.credit || 0);
          } else if (line.account?.type === 'Expense') {
            monthlyData[monthKey].expenses += Number(line.debit || 0);
          }
        });
      });

      const chartData: MonthData[] = [];
      const now = new Date();

      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('nl-NL', { month: 'short', year: '2-digit' });

        const monthData = monthlyData[monthKey] || { income: 0, expenses: 0 };

        chartData.push({
          month: monthName,
          income: monthData.income,
          expenses: monthData.expenses,
          net: monthData.income - monthData.expenses,
        });
      }

      setData(chartData);
    } catch (err) {
      console.error('Failed to load cashflow data:', err);
    } finally {
      setLoading(false);
    }
  }

  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const formatCurrency = (value: number) => {
    return `€${(value / 1000).toFixed(1)}k`;
  };

  const maxValue = Math.max(
    ...data.map(d => Math.max(d.income, d.expenses)),
    1
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <TrendingUp className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-bold text-slate-900">Cashflow Overview</h2>
        </div>
        <div className="h-80 flex items-center justify-center text-slate-500">
          Loading chart data...
        </div>
      </div>
    );
  }

  const chartHeight = 320;
  const chartPadding = { top: 20, right: 20, bottom: 50, left: 60 };
  const chartWidth = 800;
  const barWidth = 30;
  const barGap = 5;
  const groupWidth = barWidth * 2 + barGap;
  const groupGap = 40;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <TrendingUp className="w-6 h-6 text-blue-600" />
        <div>
          <h2 className="text-xl font-bold text-slate-900">Cashflow Overview</h2>
          <p className="text-sm text-slate-600">Last 6 months income vs expenses</p>
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="min-w-[600px]"
        >
          {/* Grid lines */}
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const y = chartPadding.top + (chartHeight - chartPadding.top - chartPadding.bottom) * (i / 5);
            return (
              <g key={i}>
                <line
                  x1={chartPadding.left}
                  y1={y}
                  x2={chartWidth - chartPadding.right}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                />
                <text
                  x={chartPadding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="#64748b"
                >
                  {formatCurrency(maxValue * (1 - i / 5))}
                </text>
              </g>
            );
          })}

          {/* Bars and data points */}
          {data.map((item, index) => {
            const x = chartPadding.left + index * (groupWidth + groupGap);
            const availableHeight = chartHeight - chartPadding.top - chartPadding.bottom;

            const incomeHeight = (item.income / maxValue) * availableHeight;
            const expensesHeight = (item.expenses / maxValue) * availableHeight;

            const incomeY = chartHeight - chartPadding.bottom - incomeHeight;
            const expensesY = chartHeight - chartPadding.bottom - expensesHeight;

            return (
              <g
                key={index}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              >
                {/* Income bar */}
                <rect
                  x={x}
                  y={incomeY}
                  width={barWidth}
                  height={incomeHeight}
                  fill="#10b981"
                  opacity={hoveredIndex === index ? 1 : 0.9}
                  rx="4"
                />

                {/* Expenses bar */}
                <rect
                  x={x + barWidth + barGap}
                  y={expensesY}
                  width={barWidth}
                  height={expensesHeight}
                  fill="#ef4444"
                  opacity={hoveredIndex === index ? 1 : 0.9}
                  rx="4"
                />

                {/* Month label */}
                <text
                  x={x + groupWidth / 2}
                  y={chartHeight - chartPadding.bottom + 20}
                  textAnchor="middle"
                  fontSize="12"
                  fill="#64748b"
                >
                  {item.month}
                </text>

                {/* Tooltip */}
                {hoveredIndex === index && (
                  <g>
                    <rect
                      x={x + groupWidth / 2 - 80}
                      y={Math.min(incomeY, expensesY) - 70}
                      width="160"
                      height="60"
                      fill="white"
                      stroke="#e2e8f0"
                      strokeWidth="1"
                      rx="6"
                      filter="drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
                    />
                    <text
                      x={x + groupWidth / 2}
                      y={Math.min(incomeY, expensesY) - 50}
                      textAnchor="middle"
                      fontSize="12"
                      fontWeight="600"
                      fill="#0f172a"
                    >
                      {item.month}
                    </text>
                    <text
                      x={x + groupWidth / 2}
                      y={Math.min(incomeY, expensesY) - 35}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#10b981"
                    >
                      Income: €{item.income.toFixed(2)}
                    </text>
                    <text
                      x={x + groupWidth / 2}
                      y={Math.min(incomeY, expensesY) - 22}
                      textAnchor="middle"
                      fontSize="11"
                      fill="#ef4444"
                    >
                      Expenses: €{item.expenses.toFixed(2)}
                    </text>
                    <text
                      x={x + groupWidth / 2}
                      y={Math.min(incomeY, expensesY) - 9}
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="600"
                      fill="#3b82f6"
                    >
                      Net: €{item.net.toFixed(2)}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Net result line */}
          {data.length > 1 && (
            <>
              <path
                d={data.map((item, index) => {
                  const x = chartPadding.left + index * (groupWidth + groupGap) + groupWidth / 2;
                  const availableHeight = chartHeight - chartPadding.top - chartPadding.bottom;
                  const netPercent = ((item.net + maxValue) / (maxValue * 2));
                  const y = chartHeight - chartPadding.bottom - (netPercent * availableHeight);
                  return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                }).join(' ')}
                stroke="#3b82f6"
                strokeWidth="3"
                fill="none"
              />
              {data.map((item, index) => {
                const x = chartPadding.left + index * (groupWidth + groupGap) + groupWidth / 2;
                const availableHeight = chartHeight - chartPadding.top - chartPadding.bottom;
                const netPercent = ((item.net + maxValue) / (maxValue * 2));
                const y = chartHeight - chartPadding.bottom - (netPercent * availableHeight);
                return (
                  <circle
                    key={index}
                    cx={x}
                    cy={y}
                    r="5"
                    fill="#3b82f6"
                  />
                );
              })}
            </>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-500 rounded"></div>
          <span className="text-sm text-slate-600">Income</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-500 rounded"></div>
          <span className="text-sm text-slate-600">Expenses</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-blue-500"></div>
          <span className="text-sm text-slate-600">Net Result</span>
        </div>
      </div>
    </div>
  );
}
