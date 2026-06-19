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

  // Perfect Harvest Methods
  // Insert a Perfect Harvest run score
  async insertPerfectHarvestScore(playerName: string, score: number, perfectCount: number, highestCombo: number) {
    const { data, error } = await this.supabase
      .from('perfect_harvest_scores')
      .insert([
        {
          player_name: playerName,
          score: score,
          perfect_count: perfectCount,
          highest_combo: highestCombo,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Insert perfect harvest score error:', error);
      throw error;
    }
    return data;
  }

  // Get top Perfect Harvest scores (global leaderboard)
  async getPerfectHarvestHighScores(limit: number = 10) {
    const { data, error } = await this.supabase
      .from('perfect_harvest_scores')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Fetch perfect harvest scores error:', error);
      throw error;
    }
    return data;
  }

  // Get a player's best Perfect Harvest score
  async getPlayerBestPerfectHarvestScore(playerName: string) {
    const { data, error } = await this.supabase
      .from('perfect_harvest_scores')
      .select('*')
      .eq('player_name', playerName)
      .order('score', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Fetch player best perfect harvest score error:', error);
      throw error;
    }
    return data && data.length > 0 ? data[0] : null;
  }

  // Animal Safari Match Methods
  // ---------------------------------------------------------------------------
  // The game's player-owned progression lives in localStorage (frontend-only
  // mechanic). Supabase only stores anonymous, append-only events: a row per
  // finished level + a row per animal discovered, which feed the community
  // "Players have discovered N lions" counter. See
  //   supabase/migrations/20260619120000_create_animal_safari_match.sql

  // Log one completed level (anonymous play session).
  async insertSafariSession(session: {
    playerName: string;
    theme: string;
    pairs: number;
    moves: number;
    durationSeconds: number;
    animalsFound: number;
    coinsEarned: number;
  }) {
    const { data, error } = await this.supabase
      .from('safari_sessions')
      .insert([
        {
          player_name: session.playerName,
          theme: session.theme,
          pairs: session.pairs,
          moves: session.moves,
          duration_seconds: session.durationSeconds,
          animals_found: session.animalsFound,
          coins_earned: session.coinsEarned,
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error('Insert safari session error:', error);
      throw error;
    }
    return data;
  }

  // Append one discovery event per animal matched in a run (batched).
  async recordSafariDiscoveries(
    playerName: string,
    discoveries: { animalId: string; rarity: string; isFirst: boolean }[],
  ) {
    if (!discoveries.length) return null;
    const rows = discoveries.map(d => ({
      player_name: playerName,
      animal_id: d.animalId,
      rarity: d.rarity,
      is_first: d.isFirst,
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await this.supabase.from('safari_discoveries').insert(rows);

    if (error) {
      console.error('Insert safari discoveries error:', error);
      throw error;
    }
    return data;
  }

  // Read per-animal community tallies (drives the discovery counter).
  async getSafariCommunityTotals() {
    const { data, error } = await this.supabase
      .from('safari_community_totals')
      .select('*');

    if (error) {
      console.error('Fetch safari community totals error:', error);
      throw error;
    }
    return data as { animal_id: string; total_found: number; total_discoverers: number }[] | null;
  }

  // Total number of anonymous sessions logged (community "games played").
  async getSafariSessionCount() {
    const { count, error } = await this.supabase
      .from('safari_sessions')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Fetch safari session count error:', error);
      throw error;
    }
    return count ?? 0;
  }
}
