import type { GTMPlan } from './types';

const STORAGE_KEY = 'gtm-focus-cycle-plan';

export function savePlan(plan: GTMPlan): void {

  try {

    localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));

  } catch {

    console.error('Failed to save plan to localStorage');

  }

}

export function loadPlan(): GTMPlan | null {

  try {

    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return null;

    const plan = JSON.parse(raw) as GTMPlan;

    // Backfill new channelConfig fields for saved plans that predate them
    if (plan.channelConfig) {
      if (plan.channelConfig.hasExpansion === undefined) plan.channelConfig.hasExpansion = true;
      if (plan.channelConfig.hasChurn === undefined) plan.channelConfig.hasChurn = true;
    }

    // Backfill planning mode fields
    if (!plan.planningMode) plan.planningMode = 'future-year';
    if (!plan.currentMonth) plan.currentMonth = (new Date().getMonth() + 1) as import('./types').Month;
    if (!plan.detailedActuals) plan.detailedActuals = [];

    return plan;

  } catch {

    console.error('Failed to load plan from localStorage');

    return null;

  }

}

export function exportPlanJSON(plan: GTMPlan): void {

  const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json' });

  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');

  a.href = url;

  a.download = `${plan.name.replace(/\s+/g, '-').toLowerCase()}-${plan.planYear}.json`;

  a.click();

  URL.revokeObjectURL(url);

}

export function importPlanJSON(file: File): Promise<GTMPlan> {

  return new Promise((resolve, reject) => {

    const reader = new FileReader();

    reader.onload = () => {

      try {

        const plan = JSON.parse(reader.result as string) as GTMPlan;

        if (!plan.id || !plan.targets || !plan.historical) {

          reject(new Error('Invalid plan file'));

          return;

        }

        resolve(plan);

      } catch {

        reject(new Error('Failed to parse JSON file'));

      }

    };

    reader.onerror = () => reject(new Error('Failed to read file'));

    reader.readAsText(file);

  });

}
