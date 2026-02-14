// src/pages/Budget/components/AddTransactionModal.tsx
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { BudgetCategory, TransactionType, CreateBudgetTransactionInput } from '@/types/budget';

interface AddTransactionModalProps {
  categories: BudgetCategory[];
  onClose: () => void;
  onSave: (transaction: CreateBudgetTransactionInput) => void;
  initialData?: Partial<CreateBudgetTransactionInput>;
}

export const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  categories,
  onClose,
  onSave,
  initialData,
}) => {
  const [formData, setFormData] = useState<CreateBudgetTransactionInput>({
    type: initialData?.type || 'expense',
    categoryId: initialData?.categoryId || '',
    amount: initialData?.amount || 0,
    description: initialData?.description || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || '',
    isRecurring: initialData?.isRecurring || false,
    tags: initialData?.tags || [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredCategoriess = categories.filter(c => c.type === formData.type && c.isActive);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Descrizione obbligatoria';
    }
    if (!formData.categoryId) {
      newErrors.categoryId = 'Seleziona una categoria';
    }
    if (formData.amount <= 0) {
      newErrors.amount = 'L\'importo deve essere maggiore di 0';
    }
    if (!formData.date) {
      newErrors.date = 'Data obbligatoria';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  const updateField = <K extends keyof CreateBudgetTransactionInput>(
    field: K,
    value: CreateBudgetTransactionInput[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {initialData ? 'Modifica Transazione' : 'New Transaction'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Type Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tipo
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateField('type', 'income')}
                  className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                    formData.type === 'income'
                      ? 'border-green-600 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  💰 Entrata
                </button>
                <button
                  type="button"
                  onClick={() => updateField('type', 'expense')}
                  className={`px-4 py-3 rounded-lg border-2 font-medium transition-colors ${
                    formData.type === 'expense'
                      ? 'border-red-600 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'
                      : 'border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  💸 Uscita
                </button>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descrizione *
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
                placeholder="es. Spesa al supermercato"
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Categoria *
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => updateField('categoryId', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.categoryId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                }`}
              >
                <option value="">Seleziona categoria</option>
                {filteredCategoriess.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="mt-1 text-sm text-red-600">{errors.categoryId}</p>
              )}
            </div>

            {/* Amount and Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Importo (€) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount || ''}
                  onChange={(e) => updateField('amount', parseFloat(e.target.value) || 0)}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="0.00"
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Data *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                  }`}
                />
                {errors.date && (
                  <p className="mt-1 text-sm text-red-600">{errors.date}</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Note
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Informazioni aggiuntive..."
              />
            </div>

            {/* Recurring */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="recurring"
                checked={formData.isRecurring}
                onChange={(e) => updateField('isRecurring', e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="recurring" className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                Transazione ricorrente
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
              >
                Annulla
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Salva
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
