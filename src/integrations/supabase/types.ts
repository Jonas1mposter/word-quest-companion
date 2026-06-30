export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          category: string
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          rarity: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          rarity?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          rarity?: string
        }
        Relationships: []
      }
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocked_users_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocked_users_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenge_rewards: {
        Row: {
          challenge_type: string
          claimed: boolean
          created_at: string
          id: string
          profile_id: string
          rank_achieved: number | null
          reward_type: string
          reward_value: number
          season_id: string
        }
        Insert: {
          challenge_type?: string
          claimed?: boolean
          created_at?: string
          id?: string
          profile_id: string
          rank_achieved?: number | null
          reward_type?: string
          reward_value?: number
          season_id: string
        }
        Update: {
          challenge_type?: string
          claimed?: boolean
          created_at?: string
          id?: string
          profile_id?: string
          rank_achieved?: number | null
          reward_type?: string
          reward_value?: number
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_rewards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_rewards_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      class_assignments: {
        Row: {
          assignment_type: string | null
          class_id: string | null
          class_name: string | null
          created_at: string
          description: string | null
          due_date: string | null
          grade: number | null
          id: string
          is_active: boolean
          profile_id: string | null
          target_data: Json | null
          teacher_id: string | null
          title: string | null
        }
        Insert: {
          assignment_type?: string | null
          class_id?: string | null
          class_name?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          grade?: number | null
          id?: string
          is_active?: boolean
          profile_id?: string | null
          target_data?: Json | null
          teacher_id?: string | null
          title?: string | null
        }
        Update: {
          assignment_type?: string | null
          class_id?: string | null
          class_name?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          grade?: number | null
          id?: string
          is_active?: boolean
          profile_id?: string | null
          target_data?: Json | null
          teacher_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_assignments_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_assignments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_challenges: {
        Row: {
          class_name: string
          composite_score: number
          created_at: string
          grade: number
          id: string
          member_count: number
          rank_position: number | null
          season_id: string
          total_answered: number
          total_correct: number
          total_levels_completed: number
          total_words: number
          total_xp: number
        }
        Insert: {
          class_name: string
          composite_score?: number
          created_at?: string
          grade?: number
          id?: string
          member_count?: number
          rank_position?: number | null
          season_id: string
          total_answered?: number
          total_correct?: number
          total_levels_completed?: number
          total_words?: number
          total_xp?: number
        }
        Update: {
          class_name?: string
          composite_score?: number
          created_at?: string
          grade?: number
          id?: string
          member_count?: number
          rank_position?: number | null
          season_id?: string
          total_answered?: number
          total_correct?: number
          total_levels_completed?: number
          total_words?: number
          total_xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "class_challenges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      class_competitions: {
        Row: {
          class_id: string | null
          class_name: string | null
          competition_type: string | null
          created_at: string
          description: string | null
          end_date: string | null
          end_time: string | null
          grade: number | null
          id: string
          is_active: boolean
          name: string | null
          reward_coins: number
          reward_data: Json | null
          start_date: string | null
          start_time: string | null
          status: string | null
          target_data: Json | null
          teacher_id: string | null
          title: string | null
        }
        Insert: {
          class_id?: string | null
          class_name?: string | null
          competition_type?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          grade?: number | null
          id?: string
          is_active?: boolean
          name?: string | null
          reward_coins?: number
          reward_data?: Json | null
          start_date?: string | null
          start_time?: string | null
          status?: string | null
          target_data?: Json | null
          teacher_id?: string | null
          title?: string | null
        }
        Update: {
          class_id?: string | null
          class_name?: string | null
          competition_type?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          grade?: number | null
          id?: string
          is_active?: boolean
          name?: string | null
          reward_coins?: number
          reward_data?: Json | null
          start_date?: string | null
          start_time?: string | null
          status?: string | null
          target_data?: Json | null
          teacher_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_competitions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "teacher_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_competitions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_records: {
        Row: {
          combo_count: number
          created_at: string
          id: string
          level_name: string | null
          mode: string
          profile_id: string
        }
        Insert: {
          combo_count?: number
          created_at?: string
          id?: string
          level_name?: string | null
          mode?: string
          profile_id: string
        }
        Update: {
          combo_count?: number
          created_at?: string
          id?: string
          level_name?: string | null
          mode?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "combo_records_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_quests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          quest_type: string
          reward_amount: number
          reward_type: string
          target: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          quest_type: string
          reward_amount?: number
          reward_type?: string
          target?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          quest_type?: string
          reward_amount?: number
          reward_type?: string
          target?: number
          title?: string
        }
        Relationships: []
      }
      friend_battle_invites: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          match_id: string | null
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          match_id?: string | null
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          match_id?: string | null
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_battle_invites_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_battle_invites_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          created_at: string
          id: string
          user1_id: string
          user2_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user1_id: string
          user2_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user1_id?: string
          user2_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_challenges: {
        Row: {
          challenge_name: string
          completed: boolean
          composite_score: number
          created_at: string
          current_value: number
          grade: number
          id: string
          member_count: number
          rank_position: number | null
          reward_type: string
          reward_value: number
          season_id: string
          target_value: number
          total_answered: number
          total_correct: number
          total_levels_completed: number
          total_xp: number
        }
        Insert: {
          challenge_name: string
          completed?: boolean
          composite_score?: number
          created_at?: string
          current_value?: number
          grade?: number
          id?: string
          member_count?: number
          rank_position?: number | null
          reward_type?: string
          reward_value?: number
          season_id: string
          target_value?: number
          total_answered?: number
          total_correct?: number
          total_levels_completed?: number
          total_xp?: number
        }
        Update: {
          challenge_name?: string
          completed?: boolean
          composite_score?: number
          created_at?: string
          current_value?: number
          grade?: number
          id?: string
          member_count?: number
          rank_position?: number | null
          reward_type?: string
          reward_value?: number
          season_id?: string
          target_value?: number
          total_answered?: number
          total_correct?: number
          total_levels_completed?: number
          total_xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "grade_challenges_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      kill_sound_packs: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon_url: string | null
          icon_urls: Json | null
          id: string
          is_default: boolean
          name: string
          preview_icon: string | null
          price: number
          rarity: string
          sound_urls: Json
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          icon_urls?: Json | null
          id?: string
          is_default?: boolean
          name: string
          preview_icon?: string | null
          price?: number
          rarity?: string
          sound_urls: Json
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon_url?: string | null
          icon_urls?: Json | null
          id?: string
          is_default?: boolean
          name?: string
          preview_icon?: string | null
          price?: number
          rarity?: string
          sound_urls?: Json
        }
        Relationships: []
      }
      learning_progress: {
        Row: {
          correct_count: number
          created_at: string
          id: string
          incorrect_count: number
          last_reviewed_at: string | null
          mastery_level: number
          profile_id: string
          updated_at: string
          word_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          id?: string
          incorrect_count?: number
          last_reviewed_at?: string | null
          mastery_level?: number
          profile_id: string
          updated_at?: string
          word_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          id?: string
          incorrect_count?: number
          last_reviewed_at?: string | null
          mastery_level?: number
          profile_id?: string
          updated_at?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learning_progress_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "words"
            referencedColumns: ["id"]
          },
        ]
      }
      level_progress: {
        Row: {
          attempts: number
          best_score: number
          completed_at: string | null
          created_at: string
          id: string
          level_id: string
          profile_id: string
          stars: number
          status: string
        }
        Insert: {
          attempts?: number
          best_score?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          level_id: string
          profile_id: string
          stars?: number
          status?: string
        }
        Update: {
          attempts?: number
          best_score?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          level_id?: string
          profile_id?: string
          stars?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "level_progress_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "level_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      levels: {
        Row: {
          created_at: string
          grade: number
          id: string
          name: string
          order_index: number
          unit: number
        }
        Insert: {
          created_at?: string
          grade: number
          id?: string
          name: string
          order_index?: number
          unit: number
        }
        Update: {
          created_at?: string
          grade?: number
          id?: string
          name?: string
          order_index?: number
          unit?: number
        }
        Relationships: []
      }
      match_answers: {
        Row: {
          answer: string | null
          answered_at: string
          id: string
          is_correct: boolean
          match_id: string
          player_id: string
          question_index: number
        }
        Insert: {
          answer?: string | null
          answered_at?: string
          id?: string
          is_correct?: boolean
          match_id: string
          player_id: string
          question_index: number
        }
        Update: {
          answer?: string | null
          answered_at?: string
          id?: string
          is_correct?: boolean
          match_id?: string
          player_id?: string
          question_index?: number
        }
        Relationships: []
      }
      match_parties: {
        Row: {
          created_at: string
          expires_at: string
          grade: number
          id: string
          invited_id: string | null
          leader_id: string
          match_id: string | null
          member_id: string | null
          status: string
          subject: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          grade: number
          id?: string
          invited_id?: string | null
          leader_id: string
          match_id?: string | null
          member_id?: string | null
          status?: string
          subject?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          grade?: number
          id?: string
          invited_id?: string | null
          leader_id?: string
          match_id?: string | null
          member_id?: string | null
          status?: string
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_parties_invited_id_fkey"
            columns: ["invited_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_parties_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_parties_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ranked_matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_parties_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_queue: {
        Row: {
          created_at: string
          elo_rating: number
          grade: number
          id: string
          match_id: string | null
          match_type: string
          mode: string
          party_id: string | null
          party_size: number
          profile_id: string
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          elo_rating?: number
          grade?: number
          id?: string
          match_id?: string | null
          match_type?: string
          mode?: string
          party_id?: string | null
          party_size?: number
          profile_id: string
          status?: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          elo_rating?: number
          grade?: number
          id?: string
          match_id?: string | null
          match_type?: string
          mode?: string
          party_id?: string | null
          party_size?: number
          profile_id?: string
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      math_learning_progress: {
        Row: {
          correct_count: number
          created_at: string
          id: string
          incorrect_count: number
          last_reviewed_at: string | null
          mastery_level: number
          profile_id: string
          updated_at: string
          word_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          id?: string
          incorrect_count?: number
          last_reviewed_at?: string | null
          mastery_level?: number
          profile_id: string
          updated_at?: string
          word_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          id?: string
          incorrect_count?: number
          last_reviewed_at?: string | null
          mastery_level?: number
          profile_id?: string
          updated_at?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "math_learning_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "math_learning_progress_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "math_words"
            referencedColumns: ["id"]
          },
        ]
      }
      math_words: {
        Row: {
          created_at: string
          example: string | null
          id: string
          meaning: string
          phonetic: string | null
          topic: number
          topic_name: string
          word: string
        }
        Insert: {
          created_at?: string
          example?: string | null
          id?: string
          meaning: string
          phonetic?: string | null
          topic?: number
          topic_name?: string
          word: string
        }
        Update: {
          created_at?: string
          example?: string | null
          id?: string
          meaning?: string
          phonetic?: string | null
          topic?: number
          topic_name?: string
          word?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      name_cards: {
        Row: {
          background_gradient: string
          category: string
          created_at: string
          description: string | null
          icon: string
          id: string
          in_gacha_pool: boolean
          name: string
          rarity: string
        }
        Insert: {
          background_gradient: string
          category?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          in_gacha_pool?: boolean
          name: string
          rarity?: string
        }
        Update: {
          background_gradient?: string
          category?: string
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          in_gacha_pool?: boolean
          name?: string
          rarity?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_kill_sound_pack_id: string | null
          avatar_url: string | null
          background_type: string | null
          background_value: string | null
          class: string | null
          coins: number
          created_at: string
          elo_free: number
          elo_rating: number
          energy: number
          free_match_losses: number
          free_match_wins: number
          grade: number
          id: string
          last_energy_restore: string | null
          last_login_date: string | null
          leaderboard_appearances: number
          level: number
          lifetime_coins_earned: number
          losses: number
          max_combo: number
          max_energy: number
          perfect_clears: number
          rank_points: number
          rank_stars: number
          rank_tier: string
          ranked_wins: number
          streak: number
          total_login_days: number
          total_xp: number
          updated_at: string
          user_id: string
          username: string
          wins: number
          xp: number
          xp_to_next_level: number
        }
        Insert: {
          active_kill_sound_pack_id?: string | null
          avatar_url?: string | null
          background_type?: string | null
          background_value?: string | null
          class?: string | null
          coins?: number
          created_at?: string
          elo_free?: number
          elo_rating?: number
          energy?: number
          free_match_losses?: number
          free_match_wins?: number
          grade?: number
          id?: string
          last_energy_restore?: string | null
          last_login_date?: string | null
          leaderboard_appearances?: number
          level?: number
          lifetime_coins_earned?: number
          losses?: number
          max_combo?: number
          max_energy?: number
          perfect_clears?: number
          rank_points?: number
          rank_stars?: number
          rank_tier?: string
          ranked_wins?: number
          streak?: number
          total_login_days?: number
          total_xp?: number
          updated_at?: string
          user_id: string
          username: string
          wins?: number
          xp?: number
          xp_to_next_level?: number
        }
        Update: {
          active_kill_sound_pack_id?: string | null
          avatar_url?: string | null
          background_type?: string | null
          background_value?: string | null
          class?: string | null
          coins?: number
          created_at?: string
          elo_free?: number
          elo_rating?: number
          energy?: number
          free_match_losses?: number
          free_match_wins?: number
          grade?: number
          id?: string
          last_energy_restore?: string | null
          last_login_date?: string | null
          leaderboard_appearances?: number
          level?: number
          lifetime_coins_earned?: number
          losses?: number
          max_combo?: number
          max_energy?: number
          perfect_clears?: number
          rank_points?: number
          rank_stars?: number
          rank_tier?: string
          ranked_wins?: number
          streak?: number
          total_login_days?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
          username?: string
          wins?: number
          xp?: number
          xp_to_next_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_kill_sound_pack_id_fkey"
            columns: ["active_kill_sound_pack_id"]
            isOneToOne: false
            referencedRelation: "kill_sound_packs"
            referencedColumns: ["id"]
          },
        ]
      }
      ranked_matches: {
        Row: {
          created_at: string
          ended_at: string | null
          grade: number
          id: string
          match_type: string
          mode: string
          player1_id: string | null
          player1_score: number
          player2_id: string | null
          player2_score: number
          player3_id: string | null
          player4_id: string | null
          started_at: string | null
          status: string
          subject: string | null
          team1_score: number
          team2_score: number
          winner_id: string | null
          winner_team: number | null
          words: Json | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          grade?: number
          id?: string
          match_type?: string
          mode?: string
          player1_id?: string | null
          player1_score?: number
          player2_id?: string | null
          player2_score?: number
          player3_id?: string | null
          player4_id?: string | null
          started_at?: string | null
          status?: string
          subject?: string | null
          team1_score?: number
          team2_score?: number
          winner_id?: string | null
          winner_team?: number | null
          words?: Json | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          grade?: number
          id?: string
          match_type?: string
          mode?: string
          player1_id?: string | null
          player1_score?: number
          player2_id?: string | null
          player2_score?: number
          player3_id?: string | null
          player4_id?: string | null
          started_at?: string | null
          status?: string
          subject?: string | null
          team1_score?: number
          team2_score?: number
          winner_id?: string | null
          winner_team?: number | null
          words?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ranked_matches_player1_id_fkey"
            columns: ["player1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranked_matches_player2_id_fkey"
            columns: ["player2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranked_matches_player3_id_fkey"
            columns: ["player3_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranked_matches_player4_id_fkey"
            columns: ["player4_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ranked_matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          description: string | null
          id: string
          reason: string
          report_type: string
          reported_user_id: string
          reporter_id: string
          status: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          reason: string
          report_type?: string
          reported_user_id: string
          reporter_id: string
          status?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          reason?: string
          report_type?: string
          reported_user_id?: string
          reporter_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      science_learning_progress: {
        Row: {
          correct_count: number
          created_at: string
          id: string
          incorrect_count: number
          last_reviewed_at: string | null
          mastery_level: number
          profile_id: string
          updated_at: string
          word_id: string
        }
        Insert: {
          correct_count?: number
          created_at?: string
          id?: string
          incorrect_count?: number
          last_reviewed_at?: string | null
          mastery_level?: number
          profile_id: string
          updated_at?: string
          word_id: string
        }
        Update: {
          correct_count?: number
          created_at?: string
          id?: string
          incorrect_count?: number
          last_reviewed_at?: string | null
          mastery_level?: number
          profile_id?: string
          updated_at?: string
          word_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "science_learning_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "science_learning_progress_word_id_fkey"
            columns: ["word_id"]
            isOneToOne: false
            referencedRelation: "science_words"
            referencedColumns: ["id"]
          },
        ]
      }
      science_words: {
        Row: {
          created_at: string
          definition: string | null
          example: string | null
          id: string
          meaning: string
          phonetic: string | null
          subject: string | null
          topic: string | null
          word: string
        }
        Insert: {
          created_at?: string
          definition?: string | null
          example?: string | null
          id?: string
          meaning: string
          phonetic?: string | null
          subject?: string | null
          topic?: string | null
          word: string
        }
        Update: {
          created_at?: string
          definition?: string | null
          example?: string | null
          id?: string
          meaning?: string
          phonetic?: string | null
          subject?: string | null
          topic?: string | null
          word?: string
        }
        Relationships: []
      }
      season_events: {
        Row: {
          bonus_value: number
          created_at: string
          description: string | null
          end_time: string
          event_type: string
          icon: string
          id: string
          is_active: boolean
          name: string
          season_id: string
          start_time: string
        }
        Insert: {
          bonus_value?: number
          created_at?: string
          description?: string | null
          end_time: string
          event_type?: string
          icon?: string
          id?: string
          is_active?: boolean
          name: string
          season_id: string
          start_time: string
        }
        Update: {
          bonus_value?: number
          created_at?: string
          description?: string | null
          end_time?: string
          event_type?: string
          icon?: string
          id?: string
          is_active?: boolean
          name?: string
          season_id?: string
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_events_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_milestones: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          id: string
          is_global: boolean
          name: string
          order_index: number
          reward_type: string
          reward_value: number
          season_id: string
          target_type: string
          target_value: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_global?: boolean
          name: string
          order_index?: number
          reward_type?: string
          reward_value?: number
          season_id: string
          target_type?: string
          target_value?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_global?: boolean
          name?: string
          order_index?: number
          reward_type?: string
          reward_value?: number
          season_id?: string
          target_type?: string
          target_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "season_milestones_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      season_pass_items: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          id: string
          is_premium: boolean
          level: number
          name: string
          reward_meta: Json | null
          reward_type: string
          reward_value: number
          season_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_premium?: boolean
          level?: number
          name?: string
          reward_meta?: Json | null
          reward_type?: string
          reward_value?: number
          season_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          is_premium?: boolean
          level?: number
          name?: string
          reward_meta?: Json | null
          reward_type?: string
          reward_value?: number
          season_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "season_pass_items_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          bonus_multiplier: number | null
          created_at: string
          description: string | null
          end_date: string | null
          grade: number
          icon: string | null
          id: string
          is_active: boolean
          name: string
          primary_color: string | null
          secondary_color: string | null
          start_date: string | null
          theme: string | null
        }
        Insert: {
          bonus_multiplier?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          grade?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          primary_color?: string | null
          secondary_color?: string | null
          start_date?: string | null
          theme?: string | null
        }
        Update: {
          bonus_multiplier?: number | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          grade?: number
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          primary_color?: string | null
          secondary_color?: string | null
          start_date?: string | null
          theme?: string | null
        }
        Relationships: []
      }
      teacher_classes: {
        Row: {
          class_name: string
          created_at: string
          grade: number
          id: string
          teacher_id: string
        }
        Insert: {
          class_name: string
          created_at?: string
          grade?: number
          id?: string
          teacher_id: string
        }
        Update: {
          class_name?: string
          created_at?: string
          grade?: number
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_classes_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_challenge_rewards: {
        Row: {
          coins: number
          created_at: string
          id: string
          profile_id: string
          rank: number
          season_id: string
          team_id: string
        }
        Insert: {
          coins: number
          created_at?: string
          id?: string
          profile_id: string
          rank: number
          season_id: string
          team_id: string
        }
        Update: {
          coins?: number
          created_at?: string
          id?: string
          profile_id?: string
          rank?: number
          season_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_challenge_rewards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_challenge_rewards_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "team_challenge_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_challenge_rewards_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_challenge_scores: {
        Row: {
          id: string
          last_updated: string
          points: number
          season_id: string
          team_id: string
        }
        Insert: {
          id?: string
          last_updated?: string
          points?: number
          season_id: string
          team_id: string
        }
        Update: {
          id?: string
          last_updated?: string
          points?: number
          season_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_challenge_scores_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "team_challenge_seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_challenge_scores_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_challenge_seasons: {
        Row: {
          created_at: string
          description: string | null
          ends_at: string
          finalized_at: string | null
          id: string
          name: string
          reward_tiers: number[]
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_at: string
          finalized_at?: string | null
          id?: string
          name: string
          reward_tiers?: number[]
          starts_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_at?: string
          finalized_at?: string | null
          id?: string
          name?: string
          reward_tiers?: number[]
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      team_join_requests: {
        Row: {
          created_at: string
          id: string
          profile_id: string
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          profile_id: string
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          id?: string
          profile_id?: string
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_join_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          id: string
          joined_at: string
          profile_id: string
          role: string
          team_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          profile_id: string
          role?: string
          team_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          profile_id?: string
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          avatar_url: string | null
          captain_id: string
          created_at: string
          description: string | null
          id: string
          max_members: number
          name: string
          total_wins: number
          total_xp: number
        }
        Insert: {
          avatar_url?: string | null
          captain_id: string
          created_at?: string
          description?: string | null
          id?: string
          max_members?: number
          name: string
          total_wins?: number
          total_xp?: number
        }
        Update: {
          avatar_url?: string | null
          captain_id?: string
          created_at?: string
          description?: string | null
          id?: string
          max_members?: number
          name?: string
          total_wins?: number
          total_xp?: number
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          earned_at: string
          equipped_slot: number | null
          id: string
          profile_id: string
        }
        Insert: {
          badge_id: string
          earned_at?: string
          equipped_slot?: number | null
          id?: string
          profile_id: string
        }
        Update: {
          badge_id?: string
          earned_at?: string
          equipped_slot?: number | null
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_kill_sound_packs: {
        Row: {
          acquired_at: string
          pack_id: string
          profile_id: string
        }
        Insert: {
          acquired_at?: string
          pack_id: string
          profile_id: string
        }
        Update: {
          acquired_at?: string
          pack_id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_kill_sound_packs_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "kill_sound_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_kill_sound_packs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_name_cards: {
        Row: {
          earned_at: string
          id: string
          is_equipped: boolean
          name_card_id: string
          profile_id: string
          rank_position: number | null
        }
        Insert: {
          earned_at?: string
          id?: string
          is_equipped?: boolean
          name_card_id: string
          profile_id: string
          rank_position?: number | null
        }
        Update: {
          earned_at?: string
          id?: string
          is_equipped?: boolean
          name_card_id?: string
          profile_id?: string
          rank_position?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_name_cards_name_card_id_fkey"
            columns: ["name_card_id"]
            isOneToOne: false
            referencedRelation: "name_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_name_cards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_pass_rewards: {
        Row: {
          claimed_at: string
          id: string
          profile_id: string
          season_pass_item_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          profile_id: string
          season_pass_item_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          profile_id?: string
          season_pass_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_pass_rewards_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_pass_rewards_season_pass_item_id_fkey"
            columns: ["season_pass_item_id"]
            isOneToOne: false
            referencedRelation: "season_pass_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_quest_progress: {
        Row: {
          claimed: boolean
          completed: boolean
          created_at: string
          id: string
          profile_id: string
          progress: number
          quest_date: string
          quest_id: string
        }
        Insert: {
          claimed?: boolean
          completed?: boolean
          created_at?: string
          id?: string
          profile_id: string
          progress?: number
          quest_date?: string
          quest_id: string
        }
        Update: {
          claimed?: boolean
          completed?: boolean
          created_at?: string
          id?: string
          profile_id?: string
          progress?: number
          quest_date?: string
          quest_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_quest_progress_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_quest_progress_quest_id_fkey"
            columns: ["quest_id"]
            isOneToOne: false
            referencedRelation: "daily_quests"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_season_milestones: {
        Row: {
          claimed: boolean
          claimed_at: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          milestone_id: string
          profile_id: string
          progress: number
        }
        Insert: {
          claimed?: boolean
          claimed_at?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          milestone_id: string
          profile_id: string
          progress?: number
        }
        Update: {
          claimed?: boolean
          claimed_at?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          milestone_id?: string
          profile_id?: string
          progress?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_season_milestones_milestone_id_fkey"
            columns: ["milestone_id"]
            isOneToOne: false
            referencedRelation: "season_milestones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_season_milestones_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_season_pass: {
        Row: {
          created_at: string
          current_level: number
          current_xp: number
          id: string
          is_premium: boolean
          profile_id: string
          purchased_at: string | null
          season_id: string
          xp_to_next_level: number
        }
        Insert: {
          created_at?: string
          current_level?: number
          current_xp?: number
          id?: string
          is_premium?: boolean
          profile_id: string
          purchased_at?: string | null
          season_id: string
          xp_to_next_level?: number
        }
        Update: {
          created_at?: string
          current_level?: number
          current_xp?: number
          id?: string
          is_premium?: boolean
          profile_id?: string
          purchased_at?: string | null
          season_id?: string
          xp_to_next_level?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_season_pass_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_season_pass_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      words: {
        Row: {
          created_at: string
          example: string | null
          grade: number
          id: string
          meaning: string
          phonetic: string | null
          unit: number | null
          word: string
        }
        Insert: {
          created_at?: string
          example?: string | null
          grade?: number
          id?: string
          meaning: string
          phonetic?: string | null
          unit?: number | null
          word: string
        }
        Update: {
          created_at?: string
          example?: string | null
          grade?: number
          id?: string
          meaning?: string
          phonetic?: string | null
          unit?: number | null
          word?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_badges_for_profile: { Args: { p_id: string }; Returns: number }
      bump_lifetime_coins: {
        Args: { p_amount: number; p_id: string }
        Returns: undefined
      }
      bump_perfect_clear: { Args: { p_id: string }; Returns: undefined }
      bump_ranked_win: { Args: { p_id: string }; Returns: undefined }
      equip_sound_pack: { Args: { p_pack_id: string }; Returns: Json }
      find_match: {
        Args: {
          _elo_rating: number
          _grade: number
          _match_type: string
          _profile_id: string
          _subject?: string
        }
        Returns: string
      }
      find_match_2v2: {
        Args: {
          _elo_rating: number
          _grade: number
          _party_id?: string
          _profile_id: string
          _subject?: string
        }
        Returns: string
      }
      gacha_draw: { Args: { p_count: number }; Returns: Json }
      grant_special_badge: {
        Args: { p_id: string; p_name: string }
        Returns: boolean
      }
      handle_team_join_request: {
        Args: { _accept: boolean; _request_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_team_challenge_score_for_profile: {
        Args: { p_profile_id: string }
        Returns: undefined
      }
      purchase_sound_pack: { Args: { p_pack_id: string }; Returns: Json }
      record_daily_login: { Args: never; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "moderator" | "teacher" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "teacher", "user"],
    },
  },
} as const
