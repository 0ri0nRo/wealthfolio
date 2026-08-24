// Spending Categorization Commands
import type { SpendCategoryOption } from "@wealthfolio/addon-sdk";
import type {
  CategorizationRule,
  NewCategorizationRule,
  UpdateCategorizationRule,
} from "@/features/spending/types/rule";
import type { TaxonomyCategory } from "@/lib/types";

import { invoke, logger } from "./platform";
import { getTaxonomy } from "./taxonomies";

const DEFAULT_SPEND_TAXONOMY_ID = "spending_categories";
const MAX_CATEGORY_PATH_DEPTH = 8;

export const listCategorizationRules = async (): Promise<CategorizationRule[]> => {
  try {
    return await invoke<CategorizationRule[]>("list_categorization_rules");
  } catch (e) {
    logger.error("Error listing categorization rules.");
    throw e;
  }
};

export const createCategorizationRule = async (
  rule: NewCategorizationRule,
): Promise<CategorizationRule> => {
  try {
    return await invoke<CategorizationRule>("create_categorization_rule", { rule });
  } catch (e) {
    logger.error("Error creating categorization rule.");
    throw e;
  }
};

export const updateCategorizationRule = async (
  id: string,
  patch: UpdateCategorizationRule,
): Promise<CategorizationRule> => {
  try {
    return await invoke<CategorizationRule>("update_categorization_rule", { id, patch });
  } catch (e) {
    logger.error("Error updating categorization rule.");
    throw e;
  }
};

export const deleteCategorizationRule = async (id: string): Promise<void> => {
  try {
    await invoke<void>("delete_categorization_rule", { id });
  } catch (e) {
    logger.error("Error deleting categorization rule.");
    throw e;
  }
};

export const rerunCategorizationRules = async (onlyUncategorized: boolean): Promise<number> => {
  try {
    return await invoke<number>("rerun_categorization_rules", { onlyUncategorized });
  } catch (e) {
    logger.error("Error re-running categorization rules.");
    throw e;
  }
};

/** Builds a "Parent / Child" display path for a category, capped at depth to survive accidental cycles. */
function buildCategoryPath(
  category: TaxonomyCategory,
  byId: Map<string, TaxonomyCategory>,
): string {
  const parts = [category.name];
  let parentId = category.parentId ?? null;
  let depth = 0;
  while (parentId && depth < MAX_CATEGORY_PATH_DEPTH) {
    const parent = byId.get(parentId);
    if (!parent) break;
    parts.unshift(parent.name);
    parentId = parent.parentId ?? null;
    depth += 1;
  }
  return parts.join(" / ");
}

/**
 * Lists a taxonomy's categories flattened into addon-facing options with a
 * display path. Defaults to Wealthfolio's built-in "spending_categories"
 * taxonomy. Returns an empty array if the taxonomy doesn't exist.
 */
export const getSpendCategories = async (
  taxonomyId: string = DEFAULT_SPEND_TAXONOMY_ID,
): Promise<SpendCategoryOption[]> => {
  const taxonomy = await getTaxonomy(taxonomyId);
  if (!taxonomy) return [];

  const byId = new Map(taxonomy.categories.map((category) => [category.id, category]));

  return taxonomy.categories.map((category) => ({
    taxonomyId,
    categoryId: category.id,
    key: category.key,
    name: category.name,
    path: buildCategoryPath(category, byId),
  }));
};
