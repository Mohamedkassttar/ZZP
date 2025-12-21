import { Users, User } from 'lucide-react';

interface PersonalPartnerStepProps {
  hasFiscalPartner: boolean;
  onHasFiscalPartnerChange: (value: boolean) => void;
  partnerName: string;
  onPartnerNameChange: (value: string) => void;
  partnerBsn: string;
  onPartnerBsnChange: (value: string) => void;
  childrenCount: number;
  onChildrenCountChange: (value: number) => void;
}

export function PersonalPartnerStep({
  hasFiscalPartner,
  onHasFiscalPartnerChange,
  partnerName,
  onPartnerNameChange,
  partnerBsn,
  onPartnerBsnChange,
  childrenCount,
  onChildrenCountChange,
}: PersonalPartnerStepProps) {
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Users className="w-6 h-6 text-blue-600" />
          <h3 className="text-xl font-bold text-slate-900">Persoonlijke Situatie</h3>
        </div>

        <div className="space-y-6">
          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasFiscalPartner}
                onChange={(e) => onHasFiscalPartnerChange(e.target.checked)}
                className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-slate-700">
                Ik heb een fiscaal partner
              </span>
            </label>
            <p className="mt-2 ml-8 text-sm text-slate-500">
              Een fiscaal partner is iemand waarmee je getrouwd bent of een geregistreerd
              partnerschap hebt, of waarmee je een notarieel samenlevingscontract hebt.
            </p>
          </div>

          {hasFiscalPartner && (
            <div className="pl-8 space-y-4 border-l-2 border-blue-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Naam Partner
                </label>
                <input
                  type="text"
                  value={partnerName}
                  onChange={(e) => onPartnerNameChange(e.target.value)}
                  placeholder="Bijv. Jan de Vries"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  BSN Partner
                </label>
                <input
                  type="text"
                  value={partnerBsn}
                  onChange={(e) => onPartnerBsnChange(e.target.value)}
                  placeholder="123456789"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Aantal Kinderen
            </label>
            <input
              type="number"
              min="0"
              value={childrenCount}
              onChange={(e) => onChildrenCountChange(parseInt(e.target.value) || 0)}
              className="w-32 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <p className="mt-2 text-sm text-slate-500">
              Kinderen onder de 18 jaar die op 1 januari bij jou ingeschreven stonden.
            </p>
          </div>
        </div>
      </div>

      {hasFiscalPartner && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <User className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-800">
              <strong>Let op:</strong> Vanaf nu zie je twee kolommen in de wizard: "Jij" en
              "Partner". Vul de gegevens in voor beide personen.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
