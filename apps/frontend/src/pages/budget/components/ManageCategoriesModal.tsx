// src/pages/Budget/components/ManageCategoriesModal.tsx

import { BudgetCategory } from '@/lib/types/budget';
import { Pencil, Plus, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';

interface ManageCategoriesModalProps {
  categories: BudgetCategory[];
  onClose: () => void;
  onCreate: (category: {
    name: string;
    type: 'income' | 'expense';
    color: string;
    icon?: string;
  }) => Promise<void>;
  onUpdate: (
    id: number,
    data: {
      name?: string;
      type?: 'income' | 'expense';
      color?: string;
      icon?: string;
    }
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e',
];

const PRESET_ICONS = [
  '🍔', '🍕', '🍿', '☕', '🚗', '⛽', '🏠', '💡', '📱', '💻',
  '🎮', '🎬', '📚', '✈️', '🏥', '💊', '👕', '👟', '🎁', '💰',
  '💵', '💳', '📊', '📈', '🏦', '🎯', '⚡', '🔧', '🎨', '🎵',
];

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  categories,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [view, setView] = useState<'list' | 'add' | 'edit'>('list');
  const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    type: 'expense' as 'income' | 'expense',
    color: PRESET_COLORS[0],
    icon: PRESET_ICONS[0],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'expense',
      color: PRESET_COLORS[0],
      icon: PRESET_ICONS[0],
    });
    setErrors({});
    setEditingCategory(null);
  };

  const handleAdd = () => {
    resetForm();
    setView('add');
  };

  const handleEdit = (category: BudgetCategory) => {
    setFormData({
      name: category.name,
      type: category.type as 'income' | 'expense', // ✅ usa type
      color: category.color,
      icon: category.icon || PRESET_ICONS[0],
    });
    setEditingCategory(category);
    setView('edit');
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Name required';
    }
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      if (view === 'add') {
        await onCreate({
          name: formData.name,
          type: formData.type,
          color: formData.color,
          icon: formData.icon,
        });
      } else if (view === 'edit' && editingCategory) {
        await onUpdate(Number(editingCategory.id), {
          name: formData.name,
          type: formData.type, // ✅ ora incluso
          color: formData.color,
          icon: formData.icon,
        });
      }

      resetForm();
      setView('list');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error saving category');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this category? Existing transactions will keep the category name.')) return;
    try {
      await onDelete(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error deleting category');
    }
  };

  const filteredCategories = categories.filter(c => {
    if (filterType === 'all') return true;
    return c.type === filterType; // ✅ usa type
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />

        <div className="relative bg-white dark:bg-gray-900 rounded-2xl max-w-2xl w-full border border-gray-200/50 dark:border-gray-800">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              {view !== 'list' && (
                <button
                  onClick={() => {
                    resetForm();
                    setView('list');
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ←
                </button>
              )}
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {view === 'list'
                  ? 'Manage Categories'
                  : view === 'add'
                  ? 'New Category'
                  : 'Edit Category'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* LIST VIEW */}
          {view === 'list' && (
            <div className="px-6 pb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-2">
                  {(['all', 'income', 'expense'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                        filterType === type
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </button>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredCategories.length === 0 ? (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    No categories
                  </p>
                ) : (
                  filteredCategories.map(cat => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-lg"
                          style={{ backgroundColor: cat.color + '20' }}
                        >
                          {cat.icon || '📦'}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {cat.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {cat.type === 'income' ? 'Income' : 'Expense'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(cat)}
                          className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                        >
                          <Pencil className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                        </button>
                        <button
                          onClick={() => handleDelete(Number(cat.id))}
                          className="p-2 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* FORM VIEW*/}
          {/* FORM VIEW */}
{(view === 'add' || view === 'edit') && (
  <div className="px-6 pb-6 space-y-5">

    {/* Type (solo in add) */}
    {view === 'add' && (
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Type
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, type: 'income' }))}
            className={`px-4 py-3 rounded-xl font-medium ${
              formData.type === 'income'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 ring-2 ring-green-500/20'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            Income
          </button>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, type: 'expense' }))}
            className={`px-4 py-3 rounded-xl font-medium ${
              formData.type === 'expense'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 ring-2 ring-red-500/20'
                : 'bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            Expense
          </button>
        </div>
      </div>
    )}

    {/* Name */}
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
        Name
      </label>
      <input
        type="text"
        value={formData.name}
        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
        className={`w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white ${
          errors.name ? 'ring-2 ring-red-500/50' : ''
        }`}
        placeholder="e.g., Groceries"
      />
      {errors.name && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">
          {errors.name}
        </p>
      )}
    </div>

    {/* Actions */}
    <div className="flex gap-3 pt-2">
      <button
        type="button"
        onClick={() => {
          resetForm();
          setView('list');
        }}
        className="flex-1 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800"
      >
        Cancel
      </button>
      <button
        onClick={handleSave}
        className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white"
      >
        Save
      </button>
    </div>
  </div>
)}
        </div>
      </div>
    </div>
  );
};
