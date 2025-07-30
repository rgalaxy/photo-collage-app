import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = 'https://hqnfpjdkdiauzqolrwzn.supabase.co';
    const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhxbmZwamRrZGlhdXpxb2xyd3puIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI1OTgxMzgsImV4cCI6MjA2ODE3NDEzOH0.4ZSbFBjQ9EHYLNyfj0kq9tbD7qhY_YudCuN0s75SZiA';
    
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  // Insert a high score
  async insertHighScore(screenName: string, score: number, itemName: string) {
    const { data, error } = await this.supabase
      .from('high_scores')
      .insert([
        { screen_name: screenName, score: score, item_name: itemName, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      ]);

    if (error) {
      console.error('Insert error:', error);
    }
    return data;
  }

  // Get top 10 highscores
  async getHighScores() {
    const { data, error } = await this.supabase
      .from('high_scores')
      .select('*')
      .order('score', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Fetch error:', error);
    }
    return data;
  }

  // Click The Target Game Methods
  // Insert a click the target game score
  async insertClickTargetScore(playerName: string, scores: number, accuracy: number, maxCombo: number) {
    const { data, error } = await this.supabase
      .from('click_the_target')
      .insert([
        { 
          player_name: playerName, 
          scores: scores, 
          accuracy: accuracy,
          max_combo: maxCombo,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Insert click target score error:', error);
      throw error;
    }
    return data;
  }

  // Get top click the target scores
  async getClickTargetHighScores(limit: number = 10) {
    const { data, error } = await this.supabase
      .from('click_the_target')
      .select('*')
      .order('scores', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Fetch click target scores error:', error);
      throw error;
    }
    return data;
  }

  // Get player's best score
  async getPlayerBestClickTargetScore(playerName: string) {
    const { data, error } = await this.supabase
      .from('click_the_target')
      .select('*')
      .eq('player_name', playerName)
      .order('scores', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Fetch player best score error:', error);
      throw error;
    }
    return data && data.length > 0 ? data[0] : null;
  }
}
