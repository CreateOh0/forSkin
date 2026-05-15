export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Locale = 'ko' | 'en' | 'ja'
export type UserRole = 'user' | 'admin'
export type AnalysisStatus = 'pending' | 'validating' | 'processing' | 'completed' | 'failed'
export type CreditTransactionType = 'signup' | 'purchase' | 'rating' | 'streak' | 'referral' | 'analysis' | 'refund'

export interface Database {
  public: {
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          avatar_url: string | null
          preferred_locale: Locale
          role: UserRole
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          avatar_url?: string | null
          preferred_locale?: Locale
          role?: UserRole
          created_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          avatar_url?: string | null
          preferred_locale?: Locale
          role?: UserRole
          created_at?: string
        }
        Relationships: []
      }
      analyses: {
        Row: {
          id: string
          user_id: string | null
          session_token: string | null
          image_url: string | null
          thumbnail_url: string | null
          locale: Locale
          status: AnalysisStatus
          original_expires_at: string | null
          original_deleted_at: string | null
          prompt_version_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          session_token?: string | null
          image_url?: string | null
          thumbnail_url?: string | null
          locale?: Locale
          status?: AnalysisStatus
          original_expires_at?: string | null
          original_deleted_at?: string | null
          prompt_version_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          session_token?: string | null
          image_url?: string | null
          thumbnail_url?: string | null
          locale?: Locale
          status?: AnalysisStatus
          original_expires_at?: string | null
          original_deleted_at?: string | null
          prompt_version_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      analysis_results: {
        Row: {
          id: string
          analysis_id: string
          skin_type: string | null
          concerns: Json
          hydration_level: number | null
          overall_score: number | null
          diagnosis_text: string | null
          recommendations: Json
          comparison_data: Json | null
          feature_points: Json
          raw_response: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          analysis_id: string
          skin_type?: string | null
          concerns?: Json
          hydration_level?: number | null
          overall_score?: number | null
          diagnosis_text?: string | null
          recommendations?: Json
          comparison_data?: Json | null
          feature_points?: Json
          raw_response?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          analysis_id?: string
          skin_type?: string | null
          concerns?: Json
          hydration_level?: number | null
          overall_score?: number | null
          diagnosis_text?: string | null
          recommendations?: Json
          comparison_data?: Json | null
          feature_points?: Json
          raw_response?: Json | null
          created_at?: string
        }
        Relationships: []
      }
      credits: {
        Row: { id: string; user_id: string; balance: number }
        Insert: { id?: string; user_id: string; balance?: number }
        Update: { id?: string; user_id?: string; balance?: number }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          id: string
          user_id: string
          amount: number
          type: CreditTransactionType
          reference_id: string | null
          admin_note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          type: CreditTransactionType
          reference_id?: string | null
          admin_note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          type?: CreditTransactionType
          reference_id?: string | null
          admin_note?: string | null
          created_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          id: string
          name_ko: string
          name_en: string
          name_ja: string
          credits: number
          price: number
          is_active: boolean
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name_ko: string
          name_en: string
          name_ja: string
          credits: number
          price: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name_ko?: string
          name_en?: string
          name_ja?: string
          credits?: number
          price?: number
          is_active?: boolean
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
    }
  }
}
