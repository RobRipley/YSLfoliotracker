/**
 * Exit Plan Persistence Module
 * 
 * Handles localStorage persistence for exit plans with per-asset state management
 */

const EXIT_PLANS_KEY = 'crypto-portfolio-exit-plans';

export interface CustomRung {
  percent: number;
  multiplier: number;
}

export interface ExitPlanState {
  holdingId: string;
  mode: 'aggressive' | 'conservative' | 'custom';
  customRungs: CustomRung[];
  useBase: boolean;
}

export type ExitPlansMap = Record<string, ExitPlanState>;

/**
 * Save exit plans to localStorage
 */
export function saveExitPlans(plans: Record<string, any>): void {
  try {
    // Extract only the persistent state (mode, customRungs, useBase)
    const persistentPlans: ExitPlansMap = {};
    
    Object.entries(plans).forEach(([holdingId, plan]) => {
      persistentPlans[holdingId] = {
        holdingId: plan.holdingId,
        mode: plan.mode,
        customRungs: plan.customRungs,
        useBase: plan.useBase
      };
    });
    
    localStorage.setItem(EXIT_PLANS_KEY, JSON.stringify(persistentPlans));
  } catch (error) {
    console.error('Failed to save exit plans to localStorage:', error);
  }
}

/**
 * Load exit plans from localStorage
 */
export function loadExitPlans(): ExitPlansMap | null {
  try {
    const stored = localStorage.getItem(EXIT_PLANS_KEY);
    if (!stored) return null;

    const plans: ExitPlansMap = JSON.parse(stored);
    
    // Validate structure
    if (!plans || typeof plans !== 'object') return null;
    
    // Validate each plan
    for (const [holdingId, plan] of Object.entries(plans)) {
      if (!plan.mode || !['aggressive', 'conservative', 'custom'].includes(plan.mode)) {
        console.warn(`Invalid mode for holding ${holdingId}, removing from cache`);
        delete plans[holdingId];
        continue;
      }
      
      if (!Array.isArray(plan.customRungs)) {
        console.warn(`Invalid customRungs for holding ${holdingId}, removing from cache`);
        delete plans[holdingId];
        continue;
      }
      
      if (typeof plan.useBase !== 'boolean') {
        plan.useBase = true; // Default to true if missing
      }
    }
    
    return plans;
  } catch (error) {
    console.error('Failed to load exit plans from localStorage:', error);
    return null;
  }
}

/**
 * Clear all exit plans from localStorage
 */
export function clearExitPlans(): void {
  try {
    localStorage.removeItem(EXIT_PLANS_KEY);
  } catch (error) {
    console.error('Failed to clear exit plans from localStorage:', error);
  }
}

/**
 * Get exit plan for a specific holding
 */
export function getExitPlan(holdingId: string): ExitPlanState | null {
  const plans = loadExitPlans();
  if (!plans) return null;
  return plans[holdingId] || null;
}

/**
 * Save exit plan for a specific holding
 */
export function saveExitPlan(holdingId: string, plan: ExitPlanState): void {
  const plans = loadExitPlans() || {};
  plans[holdingId] = plan;
  saveExitPlans(plans);
}
