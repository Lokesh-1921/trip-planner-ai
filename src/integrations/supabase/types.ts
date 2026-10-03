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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      destinations: {
        Row: {
          city: string
          dataset_version: string
          description: string | null
          destination_id: string
          is_synthetic: boolean
          meal_inr_per_person_day: number
          transfer_inr_per_group: number
          valid_from: string
          valid_to: string
        }
        Insert: {
          city: string
          dataset_version: string
          description?: string | null
          destination_id: string
          is_synthetic: boolean
          meal_inr_per_person_day: number
          transfer_inr_per_group: number
          valid_from: string
          valid_to: string
        }
        Update: {
          city?: string
          dataset_version?: string
          description?: string | null
          destination_id?: string
          is_synthetic?: boolean
          meal_inr_per_person_day?: number
          transfer_inr_per_group?: number
          valid_from?: string
          valid_to?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          created_at: string
          event_id: string
          name: string
          owner_id: string
          properties: Json
          trip_id: string | null
        }
        Insert: {
          created_at?: string
          event_id?: string
          name: string
          owner_id?: string
          properties?: Json
          trip_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          name?: string
          owner_id?: string
          properties?: Json
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_trip_id_owner_id_fkey"
            columns: ["trip_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["trip_id", "owner_id"]
          },
        ]
      }
      flights: {
        Row: {
          baggage_kg: number
          cancellation_inr_per_person: number
          dataset_version: string
          destination_id: string
          duration_minutes_each_way: number
          flight_id: string
          is_synthetic: boolean
          label: string
          origin_id: string
          roundtrip_inr_per_person: number
          stops_each_way: number
          taxes_included: boolean
          valid_from: string
          valid_to: string
        }
        Insert: {
          baggage_kg: number
          cancellation_inr_per_person: number
          dataset_version: string
          destination_id: string
          duration_minutes_each_way: number
          flight_id: string
          is_synthetic: boolean
          label: string
          origin_id: string
          roundtrip_inr_per_person: number
          stops_each_way: number
          taxes_included: boolean
          valid_from: string
          valid_to: string
        }
        Update: {
          baggage_kg?: number
          cancellation_inr_per_person?: number
          dataset_version?: string
          destination_id?: string
          duration_minutes_each_way?: number
          flight_id?: string
          is_synthetic?: boolean
          label?: string
          origin_id?: string
          roundtrip_inr_per_person?: number
          stops_each_way?: number
          taxes_included?: boolean
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "flights_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["destination_id"]
          },
          {
            foreignKeyName: "flights_origin_id_fkey"
            columns: ["origin_id"]
            isOneToOne: false
            referencedRelation: "origins"
            referencedColumns: ["origin_id"]
          },
        ]
      }
      hotels: {
        Row: {
          cancellation_terms: string
          dataset_version: string
          destination_id: string
          diet_tags: string
          hotel_id: string
          is_synthetic: boolean
          label: string
          max_guests_per_room: number
          max_rooms: number
          nightly_inr_per_room: number
          quiet: boolean
          refundable: boolean
          step_free: boolean
          taxes_included: boolean
          valid_from: string
          valid_to: string
        }
        Insert: {
          cancellation_terms: string
          dataset_version: string
          destination_id: string
          diet_tags: string
          hotel_id: string
          is_synthetic: boolean
          label: string
          max_guests_per_room: number
          max_rooms: number
          nightly_inr_per_room: number
          quiet: boolean
          refundable: boolean
          step_free: boolean
          taxes_included: boolean
          valid_from: string
          valid_to: string
        }
        Update: {
          cancellation_terms?: string
          dataset_version?: string
          destination_id?: string
          diet_tags?: string
          hotel_id?: string
          is_synthetic?: boolean
          label?: string
          max_guests_per_room?: number
          max_rooms?: number
          nightly_inr_per_room?: number
          quiet?: boolean
          refundable?: boolean
          step_free?: boolean
          taxes_included?: boolean
          valid_from?: string
          valid_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "hotels_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["destination_id"]
          },
        ]
      }
      messages: {
        Row: {
          created_at: string
          idempotency_key: string
          message_id: string
          owner_id: string
          redacted_content: string
          role: string
          trip_id: string
          trip_version: number
          validated_output: Json | null
        }
        Insert: {
          created_at?: string
          idempotency_key: string
          message_id?: string
          owner_id?: string
          redacted_content: string
          role: string
          trip_id: string
          trip_version: number
          validated_output?: Json | null
        }
        Update: {
          created_at?: string
          idempotency_key?: string
          message_id?: string
          owner_id?: string
          redacted_content?: string
          role?: string
          trip_id?: string
          trip_version?: number
          validated_output?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_trip_id_owner_id_fkey"
            columns: ["trip_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["trip_id", "owner_id"]
          },
        ]
      }
      origins: {
        Row: {
          city: string
          is_synthetic: boolean
          origin_id: string
        }
        Insert: {
          city: string
          is_synthetic: boolean
          origin_id: string
        }
        Update: {
          city?: string
          is_synthetic?: boolean
          origin_id?: string
        }
        Relationships: []
      }
      retrieval_traces: {
        Row: {
          created_at: string
          dataset_version: string
          error_code: string | null
          filters: Json
          model_id: string | null
          owner_id: string
          record_ids: Json
          result_count: number
          trace_id: string
          trip_id: string
          trip_version: number
        }
        Insert: {
          created_at?: string
          dataset_version: string
          error_code?: string | null
          filters: Json
          model_id?: string | null
          owner_id?: string
          record_ids: Json
          result_count: number
          trace_id?: string
          trip_id: string
          trip_version: number
        }
        Update: {
          created_at?: string
          dataset_version?: string
          error_code?: string | null
          filters?: Json
          model_id?: string | null
          owner_id?: string
          record_ids?: Json
          result_count?: number
          trace_id?: string
          trip_id?: string
          trip_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "retrieval_traces_trip_id_owner_id_fkey"
            columns: ["trip_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["trip_id", "owner_id"]
          },
        ]
      }
      selections: {
        Row: {
          created_at: string
          idempotency_key: string
          option_id: string
          owner_id: string
          selection_id: string
          simulated: boolean
          trip_id: string
          trip_version: number
        }
        Insert: {
          created_at?: string
          idempotency_key: string
          option_id: string
          owner_id?: string
          selection_id?: string
          simulated?: boolean
          trip_id: string
          trip_version: number
        }
        Update: {
          created_at?: string
          idempotency_key?: string
          option_id?: string
          owner_id?: string
          selection_id?: string
          simulated?: boolean
          trip_id?: string
          trip_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "selections_trip_id_owner_id_fkey"
            columns: ["trip_id", "owner_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["trip_id", "owner_id"]
          },
        ]
      }
      trips: {
        Row: {
          confirmed_inputs: Json
          dataset_version: string
          expires_at: string
          owner_id: string
          status: string
          trip_id: string
          trip_version: number
          updated_at: string
        }
        Insert: {
          confirmed_inputs?: Json
          dataset_version: string
          expires_at?: string
          owner_id?: string
          status?: string
          trip_id?: string
          trip_version?: number
          updated_at?: string
        }
        Update: {
          confirmed_inputs?: Json
          dataset_version?: string
          expires_at?: string
          owner_id?: string
          status?: string
          trip_id?: string
          trip_version?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
