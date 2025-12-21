import { ChevronRight } from 'lucide-react';

interface Step1GeneralProps {
  year: number;
  onYearChange: (year: number) => void;
  hoursCriterion: boolean;
  onHoursCriterionChange: (value: boolean) => void;
  isStarter: boolean;
  onIsStarterChange: (value: boolean) => void;
  onNext: () => void;
}

export function Step1General({
  year,
  onYearChange,
  hoursCriterion,
  onHoursCriterionChange,
  isStarter,
  onIsStarterChange,
  onNext,
}: Step1GeneralProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 4 }, (_, i) => currentYear - 2 + i);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Algemene Gegevens</h2>
        <p className="text-gray-600">Selecteer het belastingjaar en vul de basisgegevens in.</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Belastingjaar
          </label>
          <select
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <input
            type="checkbox"
            id="hoursCriterion"
            checked={hoursCriterion}
            onChange={(e) => onHoursCriterionChange(e.target.checked)}
            className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <div className="flex-1">
            <label htmlFor="hoursCriterion" className="block text-sm font-medium text-gray-900 cursor-pointer">
              Urencriterium (1.225 uur)
            </label>
            <p className="text-xs text-gray-600 mt-1">
              Vink aan als je minimaal 1.225 uur aan je onderneming hebt besteed.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
          <input
            type="checkbox"
            id="isStarter"
            checked={isStarter}
            onChange={(e) => onIsStarterChange(e.target.checked)}
            className="mt-1 w-4 h-4 text-green-600 rounded focus:ring-green-500"
          />
          <div className="flex-1">
            <label htmlFor="isStarter" className="block text-sm font-medium text-gray-900 cursor-pointer">
              Startersaftrek
            </label>
            <p className="text-xs text-gray-600 mt-1">
              Je komt in aanmerking als dit één van je eerste 3 jaren als ondernemer is.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Volgende
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
