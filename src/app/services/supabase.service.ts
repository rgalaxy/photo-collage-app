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

  // Pong Game Methods
  // Insert a pong game score
  async insertPongScore(player1Name: string, player2Name: string, player1Score: number, player2Score: number, winner: string, gameDuration: number) {
    const { data, error } = await this.supabase
      .from('pong_scores')
      .insert([
        { 
          player1_name: player1Name, 
          player2_name: player2Name, 
          player1_score: player1Score,
          player2_score: player2Score,
          winner: winner,
          game_duration: gameDuration,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Insert pong score error:', error);
      throw error;
    }
    return data;
  }

  // Get top pong game scores
  async getPongHighScores(limit: number = 10) {
    const { data, error } = await this.supabase
      .from('pong_scores')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Fetch pong scores error:', error);
      throw error;
    }
    return data;
  }
}
