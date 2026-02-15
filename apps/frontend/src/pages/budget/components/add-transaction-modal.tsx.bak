// src/pages/Budget/components/AddTransactionModal.tsx
import { BudgetCategory, CreateBudgetTransactionInput } from '@/lib/types/budget';
import { X } from 'lucide-react';
import React, { useState } from 'react';

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
    categoryId: initialData?.categoryId || 0,
    amount: initialData?.amount || 0,
    description: initialData?.description || '',
    date: initialData?.date || new Date().toISOString().split('T')[0],
    notes: initialData?.notes || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredCategories = categories.filter(c => c.type === formData.type && c.isActive);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.description.trim()) {
      newErrors.description = 'Description required';
    }
    if (!formData.categoryId) {
      newErrors.categoryId = 'Please select a category';
    }
    if (formData.amount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    if (!formData.date) {
      newErrors.date = 'Date required';
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
          className="fixed inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative bg-white dark:bg-gray-900 rounded-2xl max-w-md w-full border border-gray-200/50 dark:border-gray-800">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              {initialData ? 'Edit Transaction' : 'New Transaction'}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">
            {/* Type Toggle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateField('type', 'income')}
                  className={`px-4 py-3 rounded-xl font-medium transition-all ${
                    formData.type === 'income'
                      ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-2 ring-green-500/20'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => updateField('type', 'expense')}
                  className={`px-4 py-3 rounded-xl font-medium transition-all ${
                    formData.type === 'expense'
                      ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-2 ring-red-500/20'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Expense
                </button>
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e) => updateField('categoryId', parseInt(e.target.value))}
                className={`w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-0 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all ${
                  errors.categoryId ? 'ring-2 ring-red-500/50' : ''
                }`}
              >
                <option value="0">Select category</option>
                {filteredCategories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.icon} {category.name}
                  </option>
                ))}
              </select>
              {errors.categoryId && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.categoryId}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                className={`w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
                  errors.description ? 'ring-2 ring-red-500/50' : ''
                }`}
                placeholder="e.g., Grocery shopping"
              />
              {errors.description && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.description}</p>
              )}
            </div>

            {/* Amount and Date */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">€</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount || ''}
                    onChange={(e) => updateField('amount', parseFloat(e.target.value) || 0)}
                    className={`w-full pl-8 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 transition-all ${
                      errors.amount ? 'ring-2 ring-red-500/50' : ''
                    }`}
                    placeholder="0.00"
                  />
                </div>
                {errors.amount && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => updateField('date', e.target.value)}
                  className={`w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-0 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500/20 transition-all ${
                    errors.date ? 'ring-2 ring-red-500/50' : ''
                  }`}
                />
                {errors.date && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{errors.date}</p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Notes
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border-0 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500/20 resize-none transition-all"
                placeholder="Additional information..."
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 font-medium transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all shadow-sm shadow-blue-500/20"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
