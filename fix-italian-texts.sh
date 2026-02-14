#!/bin/bash
cd apps/frontend/src/pages/budget

# Sostituzioni nei file
find . -name "*.tsx" -type f -exec sed -i '' \
  -e 's/Entrate/Income/g' \
  -e 's/Uscite/Expenses/g' \
  -e 's/Bilancio/Balance/g' \
  -e 's/Nuova Transazione/New Transaction/g' \
  -e 's/Transazioni/Transactions/g' \
  -e 's/Categorie/Categories/g' \
  -e 's/Ripartizione per Categoria/Category Breakdown/g' \
  -e 's/Nessun dato disponibile/No data available/g' \
  -e 's/transazioni/transactions/g' \
  -e 's/Oggi/Today/g' \
  -e 's/Gestisci le tue entrate e uscite/Manage your income and expenses/g' \
  {} \;

echo "✅ Testi tradotti in inglese!"
