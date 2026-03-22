'use client';

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import type { GTMPlan, RevenueBreakdown, SeasonalityWeights, RampConfig, ExistingPipeline, ChannelConfig, StrategicBet } from '@/lib/types';
import { createDefaultPlan } from '@/lib/defaults';
import { savePlan, loadPlan } from '@/lib/storage';

// ── Actions ───────────────────────────────────────────────────

type Action =
  | { type: 'SET_PLAN_META'; payload: { name?: string; planYear?: number; startingARR?: number; targetARR?: number } }
  | { type: 'SET_EXISTING_PIPELINE'; payload: ExistingPipeline }
  | { type: 'SET_TARGETS'; payload: RevenueBreakdown }
  | { type: 'SET_HISTORICAL'; payload: RevenueBreakdown }
  | { type: 'SET_SEASONALITY'; payload: SeasonalityWeights }
  | { type: 'SET_RAMP'; payload: RampConfig }
  | { type: 'SET_CHANNEL_CONFIG'; payload: ChannelConfig }
  | { type: 'ADD_BET'; payload: StrategicBet }
  | { type: 'UPDATE_BET'; payload: StrategicBet }
  | { type: 'REMOVE_BET'; payload: string }
  | { type: 'TOGGLE_BET'; payload: string }
  | { type: 'LOAD_PLAN'; payload: GTMPlan }
  | { type: 'RESET' };

function reducer(state: GTMPlan, action: Action): GTMPlan {
  switch (action.type) {
    case 'SET_PLAN_META':
      return { ...state, ...action.payload };
    case 'SET_EXISTING_PIPELINE':
      return { ...state, existingPipeline: action.payload };
    case 'SET_TARGETS':
      return { ...state, targets: action.payload };
    case 'SET_HISTORICAL':
      return { ...state, historical: action.payload };
    case 'SET_SEASONALITY':
      return { ...state, seasonality: action.payload };
    case 'SET_RAMP':
      return { ...state, ramp: action.payload };
    case 'SET_CHANNEL_CONFIG':
      return { ...state, channelConfig: action.payload };
    case 'ADD_BET':
      return { ...state, strategicBets: [...state.strategicBets, action.payload] };
    case 'UPDATE_BET':
      return {
        ...state,
        strategicBets: state.strategicBets.map((b) =>
          b.id === action.payload.id ? action.payload : b,
        ),
      };
    case 'REMOVE_BET':
      return {
        ...state,
        strategicBets: state.strategicBets.filter((b) => b.id !== action.payload),
      };
    case 'TOGGLE_BET':
      return {
        ...state,
        strategicBets: state.strategicBets.map((b) =>
          b.id === action.payload ? { ...b, enabled: !b.enabled } : b,
        ),
      };
    case 'LOAD_PLAN':
      return action.payload;
    case 'RESET':
      return createDefaultPlan();
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────

interface GTMPlanContextValue {
  plan: GTMPlan;
  dispatch: React.Dispatch<Action>;
}

const GTMPlanContext = createContext<GTMPlanContextValue | null>(null);

export function GTMPlanProvider({ children }: { children: React.ReactNode }) {
  const [plan, dispatch] = useReducer(reducer, null, () => {
    // Will be hydrated in useEffect to avoid SSR mismatch
    return createDefaultPlan();
  });

  const initialized = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const saved = loadPlan();
    if (saved) {
      dispatch({ type: 'LOAD_PLAN', payload: saved });
    }
  }, []);

  // Auto-save to localStorage (debounced)
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  const debouncedSave = useCallback((p: GTMPlan) => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => savePlan(p), 500);
  }, []);

  useEffect(() => {
    if (initialized.current) {
      debouncedSave(plan);
    }
  }, [plan, debouncedSave]);

  return (
    <GTMPlanContext.Provider value={{ plan, dispatch }}>
      {children}
    </GTMPlanContext.Provider>
  );
}

export function useGTMPlan() {
  const ctx = useContext(GTMPlanContext);
  if (!ctx) throw new Error('useGTMPlan must be used within GTMPlanProvider');
  return ctx;
}
