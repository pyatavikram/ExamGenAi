import { supabase } from '../lib/supabase';

/**
 * Usage Service: Manages user trial limits securely via Supabase RPC
 * 
 * IMPORTANT: This service calls a Supabase RPC function that MUST be set up
 * on your Supabase backend. See SETUP_INSTRUCTIONS.md for SQL setup.
 */

export interface UsageData {
  user_id: string;
  trial_count: number;
  last_trial_date: string | null;
  created_at: string;
}

const TRIAL_LIMIT = 10;

/**
 * Check if user has remaining trials and atomically increment the count.
 * This uses a Supabase RPC function for atomic operation (prevents race conditions).
 * 
 * @returns { allowed: boolean, remaining: number, message: string }
 */
export const checkAndIncrementTrial = async (userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  message: string;
}> => {
  try {
    // Call the RPC function that atomically checks and increments trial count
    const { data, error } = await supabase.rpc('check_and_increment_trial', {
      p_user_id: userId,
      p_trial_limit: TRIAL_LIMIT,
    });

    if (error) {
      console.error('RPC Error:', error);
      throw error;
    }

    // RPC returns: { allowed: boolean, remaining: number, message: string }
    return {
      allowed: data.allowed,
      remaining: data.remaining,
      message: data.message,
    };
  } catch (e: any) {
    console.error('Error checking trial limit:', e);
    throw new Error('Failed to verify trial limit. Please try again.');
  }
};

/**
 * Get current usage data for a user (read-only)
 */
export const getUserUsage = async (userId: string): Promise<UsageData | null> => {
  try {
    const { data, error } = await supabase
      .from('user_usage')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found (expected for new users)
      throw error;
    }

    return data || null;
  } catch (e: any) {
    console.error('Error fetching user usage:', e);
    return null;
  }
};

/**
 * Reset trial count for a user (admin only - should be called via secure backend)
 * This is provided for reference; in production, implement via a secure backend endpoint
 */
export const resetUserTrials = async (userId: string): Promise<boolean> => {
  try {
    const { error } = await supabase.rpc('reset_user_trials', {
      p_user_id: userId,
    });

    if (error) throw error;
    return true;
  } catch (e: any) {
    console.error('Error resetting trials:', e);
    return false;
  }
};

/**
 * Get remaining trials for a user (convenience function)
 */
export const getRemainingTrials = async (userId: string): Promise<number> => {
  try {
    const usage = await getUserUsage(userId);
    if (!usage) return TRIAL_LIMIT; // New user has all trials
    return Math.max(0, TRIAL_LIMIT - usage.trial_count);
  } catch (e) {
    console.error('Error getting remaining trials:', e);
    return 0; // Fail safe: assume no trials left
  }
};
