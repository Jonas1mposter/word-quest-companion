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
          class_id: string
          class_name: string | null
          created_at: string
          grade: number | null
          id: string
          profile_id: string
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          class_name?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          profile_id: string
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          class_name?: string | null
          created_at?: string
          grade?: number | null
          id?: string
          profile_id?: string
          teacher_id?: string | null
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
          class_id: string
          competition_type: string | null
          created_at: string
          description: string | null
          end_date: string | null
          end_time: string | null
          id: string
          is_active: boolean
          name: string
          reward_data: Json | null
          start_date: string | null
          start_time: string | null
          status: string | null
          target_data: Json | null
          title: string | null
        }
        Insert: {
          class_id: string
          competition_type?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          name: string
          reward_data?: Json | null
          start_date?: string | null
          start_time?: string | null
          status?: string | null
          target_data?: Json | null
          title?: string | null
        }
        Update: {
          class_id?: string
          competition_type?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          id?: string
          is_active?: boolean
          name?: string
          reward_data?: Json | null
          start_date?: string | null
          start_time?: string | null
          status?: string | null
          target_data?: Json | null
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
          id: string
          match_id: string | null
          receiver_id: string
          sender_id: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id?: string | null
          receiver_id: string
          sender_id: string
          status?: string
        }
        Update: {
          created_at?: string
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
          name?: string
          rarity?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
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
          level: number
          losses: number
          max_combo: number
          max_energy: number
          rank_points: number
          rank_stars: number
          rank_tier: string
          streak: number
          total_xp: number
          updated_at: string
          user_id: string
          username: string
          wins: number
          xp: number
          xp_to_next_level: number
        }
        Insert: {
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
          level?: number
          losses?: number
          max_combo?: number
          max_energy?: number
          rank_points?: number
          rank_stars?: number
          rank_tier?: string
          streak?: number
          total_xp?: number
          updated_at?: string
          user_id: string
          username: string
          wins?: number
          xp?: number
          xp_to_next_level?: number
        }
        Update: {
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
          level?: number
          losses?: number
          max_combo?: number
          max_energy?: number
          rank_points?: number
          rank_stars?: number
          rank_tier?: string
          streak?: number
          total_xp?: number
          updated_at?: string
          user_id?: string
          username?: string
          wins?: number
          xp?: number
          xp_to_next_level?: number
        }
        Relationships: []
      }
      ranked_matches: {
        Row: {
          created_at: string
          ended_at: string | null
          grade: number
          id: string
          match_type: string
          player1_id: string | null
          player1_score: number
          player2_id: string | null
          player2_score: number
          started_at: string | null
          status: string
          subject: string | null
          winner_id: string | null
          words: Json | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          grade?: number
          id?: string
          match_type?: string
          player1_id?: string | null
          player1_score?: number
          player2_id?: string | null
          player2_score?: number
          started_at?: string | null
          status?: string
          subject?: string | null
          winner_id?: string | null
          words?: Json | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          grade?: number
          id?: string
          match_type?: string
          player1_id?: string | null
          player1_score?: number
          player2_id?: string | null
          player2_score?: number
          started_at?: string | null
          status?: string
          subject?: string | null
          winner_id?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
