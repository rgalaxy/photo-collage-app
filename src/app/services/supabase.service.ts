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
}
