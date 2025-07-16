// 此文件由 Supabase MCP 自动生成，请勿手动修改
// 生成时间: 2024-12-15
// 使用命令: mcp_supabase_generate_typescript_types

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      candidate_job_matches: {
        Row: {
          ai_score: number | null
          candidate_id: string | null
          created_at: string | null
          id: string
          job_id: string | null
          manual_score: number | null
          notes: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_score?: number | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          manual_score?: number | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_score?: number | null
          candidate_id?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          manual_score?: number | null
          notes?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_job_matches_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_job_matches_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          candidate_id: string | null
          completed_at: string | null
          content: string | null
          created_at: string | null
          id: string
          job_id: string | null
          metadata: Json | null
          scheduled_at: string | null
          subject: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          candidate_id?: string | null
          completed_at?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          scheduled_at?: string | null
          subject?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          candidate_id?: string | null
          completed_at?: string | null
          content?: string | null
          created_at?: string | null
          id?: string
          job_id?: string | null
          metadata?: Json | null
          scheduled_at?: string | null
          subject?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          benefits: string | null
          company: string
          created_at: string | null
          currency: string | null
          department: string | null
          description: string | null
          education_required: string | null
          embedding: string | null
          employment_type: string | null
          experience_required: number | null
          fts_document: unknown | null
          id: string
          industry: string | null
          location: string | null
          owner_id: string
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          skills_required: string[] | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          benefits?: string | null
          company: string
          created_at?: string | null
          currency?: string | null
          department?: string | null
          description?: string | null
          education_required?: string | null
          embedding?: string | null
          employment_type?: string | null
          experience_required?: number | null
          fts_document?: unknown | null
          id?: string
          industry?: string | null
          location?: string | null
          owner_id: string
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          skills_required?: string[] | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          benefits?: string | null
          company?: string
          created_at?: string | null
          currency?: string | null
          department?: string | null
          description?: string | null
          education_required?: string | null
          embedding?: string | null
          employment_type?: string | null
          experience_required?: number | null
          fts_document?: unknown | null
          id?: string
          industry?: string | null
          location?: string | null
          owner_id?: string
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          skills_required?: string[] | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string | null
          updated_at: string | null
          user_id: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
          username?: string | null
        }
        Relationships: []
      }
      resumes: {
        Row: {
          certifications: Json | null
          created_at: string | null
          current_company: string | null
          current_title: string | null
          education: Json | null
          email: string | null
          embedding: string | null
          expected_salary_max: number | null
          expected_salary_min: number | null
          experience: Json | null
          file_name: string | null
          file_type: string | null
          file_url: string | null
          fts_document: unknown | null
          id: string
          languages: Json | null
          location: string | null
          name: string
          owner_id: string
          phone: string | null
          raw_data: Json | null
          skills: string[] | null
          status: string | null
          updated_at: string | null
          years_of_experience: number | null
        }
        Insert: {
          certifications?: Json | null
          created_at?: string | null
          current_company?: string | null
          current_title?: string | null
          education?: Json | null
          email?: string | null
          embedding?: string | null
          expected_salary_max?: number | null
          expected_salary_min?: number | null
          experience?: Json | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          fts_document?: unknown | null
          id?: string
          languages?: Json | null
          location?: string | null
          name: string
          owner_id: string
          phone?: string | null
          raw_data?: Json | null
          skills?: string[] | null
          status?: string | null
          updated_at?: string | null
          years_of_experience?: number | null
        }
        Update: {
          certifications?: Json | null
          created_at?: string | null
          current_company?: string | null
          current_title?: string | null
          education?: Json | null
          email?: string | null
          embedding?: string | null
          expected_salary_max?: number | null
          expected_salary_min?: number | null
          experience?: Json | null
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          fts_document?: unknown | null
          id?: string
          languages?: Json | null
          location?: string | null
          name?: string
          owner_id?: string
          phone?: string | null
          raw_data?: Json | null
          skills?: string[] | null
          status?: string | null
          updated_at?: string | null
          years_of_experience?: number | null
        }
        Relationships: []
      }
      search_history: {
        Row: {
          created_at: string | null
          filters: Json | null
          id: string
          query: string
          results_count: number | null
          search_type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          query: string
          results_count?: number | null
          search_type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          filters?: Json | null
          id?: string
          query?: string
          results_count?: number | null
          search_type?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      binary_quantize: {
        Args: { "": string } | { "": unknown }
        Returns: unknown
      }
      cleanup_duplicate_candidates: {
        Args: { target_owner_id?: string }
        Returns: {
          action: string
          candidate_name: string
          duplicate_count: number
          kept_id: string
          removed_ids: string[]
        }[]
      }
      confirm_user_email: {
        Args: { user_email: string }
        Returns: undefined
      }
      create_user_profile: {
        Args: {
          p_user_id: string
          p_full_name: string
          p_username: string
          p_role?: string
        }
        Returns: string
      }
      search_candidates_rpc: {
        Args: {
          query_embedding: string
          query_text: string
          similarity_threshold?: number
          match_count?: number
          location_filter?: string
          experience_min?: number
          experience_max?: number
          salary_min?: number
          salary_max?: number
          skills_filter?: string[]
          status_filter?: string
          user_id_param?: string
          fts_weight?: number
          vector_weight?: number
        }
        Returns: {
          id: string
          name: string
          email: string
          phone: string
          current_title: string
          current_company: string
          location: string
          years_of_experience: number
          expected_salary_min: number
          expected_salary_max: number
          skills: string[]
          education: Json
          experience: Json
          certifications: Json
          languages: Json
          status: string
          similarity: number
          fts_rank: number
          combined_score: number
        }[]
      }
      search_jobs_rpc: {
        Args: {
          query_embedding: string
          query_text: string
          similarity_threshold?: number
          match_count?: number
          location_filter?: string
          experience_min?: number
          experience_max?: number
          salary_min_filter?: number
          salary_max_filter?: number
          skills_filter?: string[]
          status_filter?: string
          user_id_param?: string
          fts_weight?: number
          vector_weight?: number
        }
        Returns: {
          id: string
          title: string
          company: string
          location: string
          employment_type: string
          salary_min: number
          salary_max: number
          currency: string
          description: string
          requirements: string
          benefits: string
          skills_required: string[]
          experience_required: number
          education_required: string
          industry: string
          department: string
          status: string
          similarity: number
          fts_rank: number
          combined_score: number
        }[]
      }
      insert_candidate_with_embedding: {
        Args: {
          p_owner_id: string
          p_name: string
          p_email: string
          p_phone: string
          p_current_title: string
          p_current_company: string
          p_location: string
          p_years_of_experience: number
          p_expected_salary_min: number
          p_expected_salary_max: number
          p_skills: string[]
          p_education: Json
          p_experience: Json
          p_certifications: Json
          p_languages: Json
          p_raw_data: Json
          p_status: string
          p_embedding: string
        }
        Returns: string
      }
      insert_job_with_embedding: {
        Args: {
          p_owner_id: string
          p_title: string
          p_company: string
          p_location: string
          p_employment_type: string
          p_salary_min: number
          p_salary_max: number
          p_currency: string
          p_description: string
          p_requirements: string
          p_benefits: string
          p_skills_required: string[]
          p_experience_required: number
          p_education_required: string
          p_industry: string
          p_department: string
          p_status: string
          p_embedding: string
        }
        Returns: string
      }
      normalize_search_query: {
        Args: { query_text: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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

// 常用类型别名
export type Resume = Tables<'resumes'>
export type Job = Tables<'jobs'>
export type Profile = Tables<'profiles'>
export type Interaction = Tables<'interactions'>
export type CandidateJobMatch = Tables<'candidate_job_matches'>
export type SearchHistory = Tables<'search_history'>

// 插入类型
export type ResumeInsert = TablesInsert<'resumes'>
export type JobInsert = TablesInsert<'jobs'>
export type ProfileInsert = TablesInsert<'profiles'>

// 更新类型
export type ResumeUpdate = TablesUpdate<'resumes'>
export type JobUpdate = TablesUpdate<'jobs'>
export type ProfileUpdate = TablesUpdate<'profiles'>

// 数据库函数返回类型
export type SearchCandidatesResult = Database['public']['Functions']['search_candidates_rpc']['Returns'][0]
export type SearchJobsResult = Database['public']['Functions']['search_jobs_rpc']['Returns'][0]
export type CleanupDuplicatesResult = Database['public']['Functions']['cleanup_duplicate_candidates']['Returns'][0] 