export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      brands: {
        Row: {
          id: string
          name: string
          store_id: string
          supplier_id: string
        }
        Insert: {
          id?: string
          name: string
          store_id: string
          supplier_id: string
        }
        Update: {
          id?: string
          name?: string
          store_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brands_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_cash: {
        Row: {
          cash_date: string
          created_at: string
          id: string
          opening_amount: number
          store_id: string
          updated_at: string
        }
        Insert: {
          cash_date: string
          created_at?: string
          id?: string
          opening_amount: number
          store_id: string
          updated_at?: string
        }
        Update: {
          cash_date?: string
          created_at?: string
          id?: string
          opening_amount?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_cash_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      data_quality_issues: {
        Row: {
          barcode: string | null
          description: string | null
          detected_at: string
          id: string
          issue_code: string
          original_value: string | null
          product_id: string | null
          resolved_at: string | null
          store_id: string
        }
        Insert: {
          barcode?: string | null
          description?: string | null
          detected_at?: string
          id?: string
          issue_code: string
          original_value?: string | null
          product_id?: string | null
          resolved_at?: string | null
          store_id: string
        }
        Update: {
          barcode?: string | null
          description?: string | null
          detected_at?: string
          id?: string
          issue_code?: string
          original_value?: string | null
          product_id?: string | null
          resolved_at?: string | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "data_quality_issues_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "data_quality_issues_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          id: string
          movement_type: string
          occurred_at: string
          product_id: string
          purchase_order_id: string | null
          store_id: string
          units_delta: number
        }
        Insert: {
          id?: string
          movement_type: string
          occurred_at?: string
          product_id: string
          purchase_order_id?: string | null
          store_id: string
          units_delta: number
        }
        Update: {
          id?: string
          movement_type?: string
          occurred_at?: string
          product_id?: string
          purchase_order_id?: string | null
          store_id?: string
          units_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_settings: {
        Row: {
          cost_source: string
          is_estimated: boolean
          max_stock_units: number | null
          pack_size: number
          product_id: string
          store_id: string
          unit_cost: number
          updated_at: string
        }
        Insert: {
          cost_source?: string
          is_estimated?: boolean
          max_stock_units?: number | null
          pack_size?: number
          product_id: string
          store_id: string
          unit_cost?: number
          updated_at?: string
        }
        Update: {
          cost_source?: string
          is_estimated?: boolean
          max_stock_units?: number | null
          pack_size?: number
          product_id?: string
          store_id?: string
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_settings_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string
          brand_id: string | null
          category: string
          created_at: string
          external_id: number | null
          id: string
          is_stock_reliable: boolean
          name: string
          reference: string | null
          sale_price: number
          stock_units: number
          store_id: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          barcode: string
          brand_id?: string | null
          category: string
          created_at?: string
          external_id?: number | null
          id?: string
          is_stock_reliable?: boolean
          name: string
          reference?: string | null
          sale_price?: number
          stock_units?: number
          store_id: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string
          brand_id?: string | null
          category?: string
          created_at?: string
          external_id?: number | null
          id?: string
          is_stock_reliable?: boolean
          name?: string
          reference?: string | null
          sale_price?: number
          stock_units?: number
          store_id?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_lines: {
        Row: {
          id: string
          product_id: string
          purchase_order_id: string
          store_id: string
          unit_cost: number
          units: number
          was_adjusted_by_owner: boolean
        }
        Insert: {
          id?: string
          product_id: string
          purchase_order_id: string
          store_id: string
          unit_cost: number
          units: number
          was_adjusted_by_owner?: boolean
        }
        Update: {
          id?: string
          product_id?: string
          purchase_order_id?: string
          store_id?: string
          unit_cost?: number
          units?: number
          was_adjusted_by_owner?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_lines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_lines_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          available_budget: number | null
          created_at: string
          id: string
          is_settled: boolean
          maximum_order_cost: number
          paid_amount: number
          paid_at: string | null
          pending_amount: number
          received_at: string | null
          sales_report_id: string | null
          status: string
          store_id: string
          supplier_id: string
          total_cost: number
        }
        Insert: {
          available_budget?: number | null
          created_at?: string
          id?: string
          maximum_order_cost: number
          paid_amount?: number
          paid_at?: string | null
          received_at?: string | null
          sales_report_id?: string | null
          status: string
          store_id: string
          supplier_id: string
          total_cost: number
        }
        Update: {
          available_budget?: number | null
          created_at?: string
          id?: string
          maximum_order_cost?: number
          paid_amount?: number
          paid_at?: string | null
          received_at?: string | null
          sales_report_id?: string | null
          status?: string
          store_id?: string
          supplier_id?: string
          total_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_sales_report_id_fkey"
            columns: ["sales_report_id"]
            isOneToOne: false
            referencedRelation: "sales_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_report_lines: {
        Row: {
          barcode: string
          category: string | null
          id: string
          latest_purchase_cost: number | null
          product_name: string | null
          receipt_count: number
          sale_price: number | null
          sales_report_id: string
          store_id: string
          units_sold: number
        }
        Insert: {
          barcode: string
          category?: string | null
          id?: string
          latest_purchase_cost?: number | null
          product_name?: string | null
          receipt_count: number
          sale_price?: number | null
          sales_report_id: string
          store_id: string
          units_sold: number
        }
        Update: {
          barcode?: string
          category?: string | null
          id?: string
          latest_purchase_cost?: number | null
          product_name?: string | null
          receipt_count?: number
          sale_price?: number | null
          sales_report_id?: string
          store_id?: string
          units_sold?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_report_lines_sales_report_id_fkey"
            columns: ["sales_report_id"]
            isOneToOne: false
            referencedRelation: "sales_reports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_report_lines_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_reports: {
        Row: {
          covered_days_override: number | null
          file_name: string
          id: string
          period_ends_at: string
          period_starts_at: string
          replenishment_mode: string
          safety_margin_ratio: number
          store_id: string
          uploaded_at: string
        }
        Insert: {
          covered_days_override?: number | null
          file_name: string
          id?: string
          period_ends_at: string
          period_starts_at: string
          replenishment_mode?: string
          safety_margin_ratio?: number
          store_id: string
          uploaded_at?: string
        }
        Update: {
          covered_days_override?: number | null
          file_name?: string
          id?: string
          period_ends_at?: string
          period_starts_at?: string
          replenishment_mode?: string
          safety_margin_ratio?: number
          store_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_reports_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          admin_name: string | null
          contact_email: string | null
          created_at: string
          id: string
          logo_path: string | null
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          admin_name?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          admin_name?: string | null
          contact_email?: string | null
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          biweekly_anchor_date: string | null
          contact_email: string | null
          created_at: string
          delivery_weekday: number | null
          external_id: number | null
          id: string
          minimum_order_amount: number
          maximum_order_amount: number | null
          name: string
          order_weekday: number | null
          settings_are_estimated: boolean
          store_id: string
          tax_id: string | null
          updated_at: string
          visit_frequency: string | null
        }
        Insert: {
          biweekly_anchor_date?: string | null
          contact_email?: string | null
          created_at?: string
          delivery_weekday?: number | null
          external_id?: number | null
          id?: string
          minimum_order_amount?: number
          maximum_order_amount?: number | null
          name: string
          order_weekday?: number | null
          settings_are_estimated?: boolean
          store_id: string
          tax_id?: string | null
          updated_at?: string
          visit_frequency?: string | null
        }
        Update: {
          biweekly_anchor_date?: string | null
          contact_email?: string | null
          created_at?: string
          delivery_weekday?: number | null
          external_id?: number | null
          id?: string
          minimum_order_amount?: number
          maximum_order_amount?: number | null
          name?: string
          order_weekday?: number | null
          settings_are_estimated?: boolean
          store_id?: string
          tax_id?: string | null
          updated_at?: string
          visit_frequency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      truck_deliveries: {
        Row: {
          delivered_at: string
          id: string
          purchase_order_id: string
          store_id: string
        }
        Insert: {
          delivered_at?: string
          id?: string
          purchase_order_id: string
          store_id: string
        }
        Update: {
          delivered_at?: string
          id?: string
          purchase_order_id?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "truck_deliveries_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "truck_deliveries_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
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
    Enums: {},
  },
} as const

