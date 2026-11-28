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
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      captain_applications: {
        Row: {
          captain_type: Database["public"]["Enums"]["captain_type"]
          created_at: string
          id: string
          merchant_id: string | null
          note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          user_id: string
        }
        Insert: {
          captain_type: Database["public"]["Enums"]["captain_type"]
          created_at?: string
          id?: string
          merchant_id?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          user_id: string
        }
        Update: {
          captain_type?: Database["public"]["Enums"]["captain_type"]
          created_at?: string
          id?: string
          merchant_id?: string | null
          note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "captain_applications_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      captain_profiles: {
        Row: {
          approved_at: string
          approved_by: string | null
          captain_type: Database["public"]["Enums"]["captain_type"]
          created_at: string
          is_active: boolean
          merchant_id: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string
          approved_by?: string | null
          captain_type: Database["public"]["Enums"]["captain_type"]
          created_at?: string
          is_active?: boolean
          merchant_id?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string
          approved_by?: string | null
          captain_type?: Database["public"]["Enums"]["captain_type"]
          created_at?: string
          is_active?: boolean
          merchant_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "captain_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_profiles_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captain_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      commission_settings: {
        Row: {
          commission_rate_bps: number
          fixed_commission_per_unit_iqd: number
          merchant_type: Database["public"]["Enums"]["app_role"]
          platform_delivery_share_iqd: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          commission_rate_bps?: number
          fixed_commission_per_unit_iqd?: number
          merchant_type: Database["public"]["Enums"]["app_role"]
          platform_delivery_share_iqd?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          commission_rate_bps?: number
          fixed_commission_per_unit_iqd?: number
          merchant_type?: Database["public"]["Enums"]["app_role"]
          platform_delivery_share_iqd?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "commission_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_profiles: {
        Row: {
          address: string | null
          approval_status: Database["public"]["Enums"]["record_status"]
          business_name: string
          created_at: string
          description: string | null
          id: string
          merchant_type: Database["public"]["Enums"]["app_role"]
          service_zone_ids: string[] | null
          user_id: string
        }
        Insert: {
          address?: string | null
          approval_status?: Database["public"]["Enums"]["record_status"]
          business_name: string
          created_at?: string
          description?: string | null
          id?: string
          merchant_type: Database["public"]["Enums"]["app_role"]
          service_zone_ids?: string[] | null
          user_id: string
        }
        Update: {
          address?: string | null
          approval_status?: Database["public"]["Enums"]["record_status"]
          business_name?: string
          created_at?: string
          description?: string | null
          id?: string
          merchant_type?: Database["public"]["Enums"]["app_role"]
          service_zone_ids?: string[] | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          cost_price_snapshot_iqd: number | null
          id: string
          line_total_iqd: number
          merchant_commission_line_snapshot_iqd: number
          merchant_commission_per_unit_snapshot_iqd: number
          order_id: string
          product_id: string | null
          product_title_snapshot: string
          quantity: number
          referral_commission_snapshot_iqd: number
          unit_price_iqd: number
          variant_id: string | null
          variant_snapshot: Json
        }
        Insert: {
          cost_price_snapshot_iqd?: number | null
          id?: string
          line_total_iqd: number
          merchant_commission_line_snapshot_iqd?: number
          merchant_commission_per_unit_snapshot_iqd?: number
          order_id: string
          product_id?: string | null
          product_title_snapshot: string
          quantity: number
          referral_commission_snapshot_iqd?: number
          unit_price_iqd: number
          variant_id?: string | null
          variant_snapshot?: Json
        }
        Update: {
          cost_price_snapshot_iqd?: number | null
          id?: string
          line_total_iqd?: number
          merchant_commission_line_snapshot_iqd?: number
          merchant_commission_per_unit_snapshot_iqd?: number
          order_id?: string
          product_id?: string | null
          product_title_snapshot?: string
          quantity?: number
          referral_commission_snapshot_iqd?: number
          unit_price_iqd?: number
          variant_id?: string | null
          variant_snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_live_locations: {
        Row: {
          accuracy_m: number | null
          captain_user_id: string
          latitude: number
          longitude: number
          order_id: string
          updated_at: string
        }
        Insert: {
          accuracy_m?: number | null
          captain_user_id: string
          latitude: number
          longitude: number
          order_id: string
          updated_at?: string
        }
        Update: {
          accuracy_m?: number | null
          captain_user_id?: string
          latitude?: number
          longitude?: number
          order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_live_locations_captain_user_id_fkey"
            columns: ["captain_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_live_locations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor_role: Database["public"]["Enums"]["app_role"]
          changed_by: string | null
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          actor_role: Database["public"]["Enums"]["app_role"]
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          actor_role?: Database["public"]["Enums"]["app_role"]
          changed_by?: string | null
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          captain_delivery_share_iqd: number
          captain_user_id: string | null
          currency: string
          customer_id: string
          delivery_address: string
          delivery_fee_iqd: number
          delivery_latitude: number | null
          delivery_longitude: number | null
          delivery_notes: string | null
          delivery_phone: string
          id: string
          idempotency_key: string | null
          merchant_commission_iqd: number
          merchant_commission_rate_bps: number
          merchant_id: string | null
          merchant_receipt_whatsapp_opened_at: string | null
          merchant_receipt_whatsapp_sent_at: string | null
          merchant_receipt_whatsapp_shared_by: string | null
          placed_at: string
          platform_delivery_share_iqd: number
          reward_amount_iqd: number
          reward_campaign_id: string | null
          service_zone_id: string | null
          settled_at: string | null
          status: string
          subtotal_iqd: number
          total_iqd: number | null
        }
        Insert: {
          captain_delivery_share_iqd?: number
          captain_user_id?: string | null
          currency?: string
          customer_id: string
          delivery_address: string
          delivery_fee_iqd: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_notes?: string | null
          delivery_phone: string
          id?: string
          idempotency_key?: string | null
          merchant_commission_iqd?: number
          merchant_commission_rate_bps?: number
          merchant_id?: string | null
          merchant_receipt_whatsapp_opened_at?: string | null
          merchant_receipt_whatsapp_sent_at?: string | null
          merchant_receipt_whatsapp_shared_by?: string | null
          placed_at?: string
          platform_delivery_share_iqd?: number
          reward_amount_iqd?: number
          reward_campaign_id?: string | null
          service_zone_id?: string | null
          settled_at?: string | null
          status?: string
          subtotal_iqd: number
          total_iqd?: number | null
        }
        Update: {
          captain_delivery_share_iqd?: number
          captain_user_id?: string | null
          currency?: string
          customer_id?: string
          delivery_address?: string
          delivery_fee_iqd?: number
          delivery_latitude?: number | null
          delivery_longitude?: number | null
          delivery_notes?: string | null
          delivery_phone?: string
          id?: string
          idempotency_key?: string | null
          merchant_commission_iqd?: number
          merchant_commission_rate_bps?: number
          merchant_id?: string | null
          merchant_receipt_whatsapp_opened_at?: string | null
          merchant_receipt_whatsapp_sent_at?: string | null
          merchant_receipt_whatsapp_shared_by?: string | null
          placed_at?: string
          platform_delivery_share_iqd?: number
          reward_amount_iqd?: number
          reward_campaign_id?: string | null
          service_zone_id?: string | null
          settled_at?: string | null
          status?: string
          subtotal_iqd?: number
          total_iqd?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_captain_user_id_fkey"
            columns: ["captain_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_merchant_receipt_whatsapp_shared_by_fkey"
            columns: ["merchant_receipt_whatsapp_shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_reward_campaign_id_fkey"
            columns: ["reward_campaign_id"]
            isOneToOne: false
            referencedRelation: "reward_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_zone_id_fkey"
            columns: ["service_zone_id"]
            isOneToOne: false
            referencedRelation: "service_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      payout_requests: {
        Row: {
          admin_note: string | null
          amount_iqd: number
          created_at: string
          id: string
          owner_paid_iqd: number | null
          paid_at: string | null
          payout_method: string
          platform_share_iqd: number | null
          requester_user_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
        }
        Insert: {
          admin_note?: string | null
          amount_iqd: number
          created_at?: string
          id?: string
          owner_paid_iqd?: number | null
          paid_at?: string | null
          payout_method: string
          platform_share_iqd?: number | null
          requester_user_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
        }
        Update: {
          admin_note?: string | null
          amount_iqd?: number
          created_at?: string
          id?: string
          owner_paid_iqd?: number | null
          paid_at?: string | null
          payout_method?: string
          platform_share_iqd?: number | null
          requester_user_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payout_requests_requester_user_id_fkey"
            columns: ["requester_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payout_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_revenue_ledger: {
        Row: {
          amount_iqd: number
          created_at: string
          id: string
          note: string | null
          order_id: string
          revenue_type: string
          source_ledger_id: string
        }
        Insert: {
          amount_iqd: number
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          revenue_type: string
          source_ledger_id: string
        }
        Update: {
          amount_iqd?: number
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          revenue_type?: string
          source_ledger_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_revenue_ledger_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "platform_revenue_ledger_source_ledger_id_fkey"
            columns: ["source_ledger_id"]
            isOneToOne: true
            referencedRelation: "wallet_ledger"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "platform_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: { category_key: string; created_at: string; id: string; is_active: boolean; name: string; sort_order: number; store_type: string; updated_at: string }
        Insert: { category_key: string; created_at?: string; id?: string; is_active?: boolean; name: string; sort_order?: number; store_type: string; updated_at?: string }
        Update: { category_key?: string; created_at?: string; id?: string; is_active?: boolean; name?: string; sort_order?: number; store_type?: string; updated_at?: string }
        Relationships: []
      }
      product_subcategories: {
        Row: { category_id: string; created_at: string; id: string; is_active: boolean; name: string; sort_order: number; subcategory_key: string; updated_at: string }
        Insert: { category_id: string; created_at?: string; id?: string; is_active?: boolean; name: string; sort_order?: number; subcategory_key: string; updated_at?: string }
        Update: { category_id?: string; created_at?: string; id?: string; is_active?: boolean; name?: string; sort_order?: number; subcategory_key?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "product_subcategories_category_id_fkey"; columns: ["category_id"]; isOneToOne: false; referencedRelation: "product_categories"; referencedColumns: ["id"] }]
      }
      product_variants: {
        Row: { color_hex: string | null; color_name: string | null; cost_price_iqd: number | null; created_at: string; id: string; image_path: string | null; is_active: boolean; price_iqd: number; product_id: string; scent: string | null; size_label: string | null; sku: string | null; sort_order: number; stock_quantity: number | null; unit: string | null; updated_at: string; variant_label: string }
        Insert: { color_hex?: string | null; color_name?: string | null; cost_price_iqd?: number | null; created_at?: string; id?: string; image_path?: string | null; is_active?: boolean; price_iqd: number; product_id: string; scent?: string | null; size_label?: string | null; sku?: string | null; sort_order?: number; stock_quantity?: number | null; unit?: string | null; updated_at?: string; variant_label: string }
        Update: { color_hex?: string | null; color_name?: string | null; cost_price_iqd?: number | null; created_at?: string; id?: string; image_path?: string | null; is_active?: boolean; price_iqd?: number; product_id?: string; scent?: string | null; size_label?: string | null; sku?: string | null; sort_order?: number; stock_quantity?: number | null; unit?: string | null; updated_at?: string; variant_label?: string }
        Relationships: [{ foreignKeyName: "product_variants_product_id_fkey"; columns: ["product_id"]; isOneToOne: false; referencedRelation: "products"; referencedColumns: ["id"] }]
      }
      products: {
        Row: {
          approval_status: string
          category_id: string | null
          category_key: string
          subcategory_id: string | null
          cost_price_iqd: number | null
          created_at: string
          description: string | null
          id: string
          image_path: string | null
          is_available: boolean
          is_shakh_store: boolean
          merchant_commission_per_unit_iqd: number
          merchant_id: string | null
          price_iqd: number
          referral_commission_iqd: number
          rejection_reason: string | null
          views_count: number
          reviewed_at: string | null
          reviewed_by: string | null
          stock_quantity: number | null
          title: string
          unit: string
          updated_at: string
        }
        Insert: {
          approval_status?: string
          category_id?: string | null
          category_key: string
          subcategory_id?: string | null
          cost_price_iqd?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_available?: boolean
          is_shakh_store?: boolean
          merchant_commission_per_unit_iqd?: number
          merchant_id?: string | null
          price_iqd: number
          referral_commission_iqd?: number
          rejection_reason?: string | null
          views_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          stock_quantity?: number | null
          title: string
          unit?: string
          updated_at?: string
        }
        Update: {
          approval_status?: string
          category_id?: string | null
          category_key?: string
          subcategory_id?: string | null
          cost_price_iqd?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_path?: string | null
          is_available?: boolean
          is_shakh_store?: boolean
          merchant_commission_per_unit_iqd?: number
          merchant_id?: string | null
          price_iqd?: number
          referral_commission_iqd?: number
          rejection_reason?: string | null
          views_count?: number
          reviewed_at?: string | null
          reviewed_by?: string | null
          stock_quantity?: number | null
          title?: string
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "product_subcategories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_merchant_id_fkey"
            columns: ["merchant_id"]
            isOneToOne: false
            referencedRelation: "merchant_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reward_campaigns: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          owner_user_id: string
          reward_amount_iqd: number
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          owner_user_id: string
          reward_amount_iqd?: number
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          owner_user_id?: string
          reward_amount_iqd?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "reward_campaigns_owner_user_id_fkey"
            columns: ["owner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_zones: {
        Row: {
          boundary_geojson: Json | null
          captain_delivery_share_iqd: number
          circle_center_latitude: number | null
          circle_center_longitude: number | null
          circle_outer_radius_m: number | null
          circle_ring_order: number | null
          created_at: string
          delivery_fee_iqd: number
          description: string | null
          id: string
          is_active: boolean
          name: string
          shakh_delivery_share_iqd: number
          zone_type: string
        }
        Insert: {
          boundary_geojson?: Json | null
          captain_delivery_share_iqd: number
          circle_center_latitude?: number | null
          circle_center_longitude?: number | null
          circle_outer_radius_m?: number | null
          circle_ring_order?: number | null
          created_at?: string
          delivery_fee_iqd?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          shakh_delivery_share_iqd: number
          zone_type?: string
        }
        Update: {
          boundary_geojson?: Json | null
          captain_delivery_share_iqd?: number
          circle_center_latitude?: number | null
          circle_center_longitude?: number | null
          circle_outer_radius_m?: number | null
          circle_ring_order?: number | null
          created_at?: string
          delivery_fee_iqd?: number
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          shakh_delivery_share_iqd?: number
          zone_type?: string
        }
        Relationships: []
      }
      wallet_ledger: {
        Row: {
          amount_iqd: number
          created_at: string
          created_by: string | null
          direction: string
          entry_type: Database["public"]["Enums"]["wallet_entry_type"]
          id: string
          idempotency_key: string | null
          note: string | null
          reference_id: string | null
          reference_type: string | null
          wallet_user_id: string
        }
        Insert: {
          amount_iqd: number
          created_at?: string
          created_by?: string | null
          direction: string
          entry_type: Database["public"]["Enums"]["wallet_entry_type"]
          id?: string
          idempotency_key?: string | null
          note?: string | null
          reference_id?: string | null
          reference_type?: string | null
          wallet_user_id: string
        }
        Update: {
          amount_iqd?: number
          created_at?: string
          created_by?: string | null
          direction?: string
          entry_type?: Database["public"]["Enums"]["wallet_entry_type"]
          id?: string
          idempotency_key?: string | null
          note?: string | null
          reference_id?: string | null
          reference_type?: string | null
          wallet_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_ledger_wallet_user_id_fkey"
            columns: ["wallet_user_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["user_id"]
          },
        ]
      }
      wallet_topup_requests: {
        Row: {
          amount_iqd: number
          created_at: string
          id: string
          note: string | null
          receipt_path: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["record_status"]
          user_id: string
        }
        Insert: {
          amount_iqd: number
          created_at?: string
          id?: string
          note?: string | null
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          user_id: string
        }
        Update: {
          amount_iqd?: number
          created_at?: string
          id?: string
          note?: string | null
          receipt_path?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["record_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_topup_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_topup_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_iqd: number
          referral_balance_iqd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_iqd?: number
          referral_balance_iqd?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_iqd?: number
          referral_balance_iqd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_product_view: {
        Args: { p_product_id: string }
        Returns: number
      }
      admin_assign_captain: {
        Args: { p_captain_user_id: string; p_order_id: string }
        Returns: undefined
      }
      admin_commission_trend: {
        Args: { p_days?: number }
        Returns: {
          day: string
          delivered_order_count: number
          merchant_commission_iqd: number
          merchant_type: string
          order_count: number
          platform_delivery_commission_iqd: number
          sales_iqd: number
        }[]
      }
      admin_credit_own_wallet: {
        Args: { p_amount_iqd: number; p_note?: string }
        Returns: undefined
      }
      admin_mark_payout_paid: {
        Args: { p_admin_note?: string; p_request_id: string }
        Returns: undefined
      }
      admin_platform_revenue_summary: {
        Args: never
        Returns: {
          revenue_type: string
          total_iqd: number
          transactions_count: number
        }[]
      }
      admin_record_order_receipt_share: {
        Args: { p_order_id: string; p_status: string }
        Returns: undefined
      }
      admin_review_merchant: {
        Args: { p_approve: boolean; p_merchant_id: string }
        Returns: undefined
      }
      admin_review_product: {
        Args: {
          p_approve: boolean
          p_product_id: string
          p_rejection_reason?: string
        }
        Returns: undefined
      }
      admin_sales_chart: {
        Args: { p_period?: string }
        Returns: {
          bucket_start: string
          delivered_count: number
          delivery_platform_iqd: number
          orders_count: number
          product_commission_iqd: number
          sales_iqd: number
        }[]
      }
      admin_save_service_zone: {
        Args: {
          p_captain_share_iqd?: number
          p_delivery_fee_iqd?: number
          p_description?: string
          p_is_active?: boolean
          p_name?: string
          p_shakh_share_iqd?: number
          p_zone_id?: string
        }
        Returns: string
      }
      admin_save_service_zone_circle: {
        Args: {
          p_captain_share_iqd?: number
          p_center_latitude?: number
          p_center_longitude?: number
          p_delivery_fee_iqd?: number
          p_description?: string
          p_is_active?: boolean
          p_name?: string
          p_outer_radius_m?: number
          p_shakh_share_iqd?: number
          p_zone_id?: string
        }
        Returns: string
      }
      admin_save_service_zone_boundary: {
        Args: { p_boundary_geojson: Json; p_zone_id: string }
        Returns: undefined
      }
      admin_set_product_commission: {
        Args: { p_amount_iqd: number; p_product_id: string }
        Returns: undefined
      }
      admin_set_product_referral_reward: {
        Args: { p_product_id: string; p_reward_iqd: number }
        Returns: undefined
      }
      admin_set_user_role: {
        Args: {
          p_role: Database["public"]["Enums"]["app_role"]
          p_user_id: string
        }
        Returns: undefined
      }
      admin_shakh_store_profit: {
        Args: never
        Returns: {
          delivered_orders: number
          gross_profit_iqd: number
          purchase_cost_iqd: number
          sales_iqd: number
          units_sold: number
        }[]
      }
      claim_available_delivery: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      clear_captain_live_location: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      create_multi_store_orders_v1: {
        Args: {
          p_delivery_address: string
          p_delivery_notes?: string
          p_delivery_phone: string
          p_groups: Json
          p_idempotency_key?: string
          p_reward_campaign_id?: string
          p_service_zone_id: string
        }
        Returns: string[]
      }
      create_multi_store_orders_with_location_v1: {
        Args: {
          p_delivery_address: string
          p_delivery_latitude?: number
          p_delivery_longitude?: number
          p_delivery_notes?: string
          p_delivery_phone: string
          p_groups: Json
          p_idempotency_key?: string
          p_reward_campaign_id?: string
          p_service_zone_id: string
        }
        Returns: string[]
      }
      create_order: {
        Args: {
          p_items: Json
          p_merchant_id: string
          p_reward_amount_iqd?: number
          p_reward_campaign_id?: string
          p_service_zone_id: string
        }
        Returns: string
      }
      create_order_v2: {
        Args: {
          p_delivery_address: string
          p_delivery_notes?: string
          p_delivery_phone: string
          p_idempotency_key?: string
          p_items: Json
          p_merchant_id: string
          p_reward_amount_iqd?: number
          p_reward_campaign_id?: string
          p_service_zone_id: string
        }
        Returns: string
      }
      create_shakh_store_order: {
        Args: {
          p_items: Json
          p_reward_amount_iqd?: number
          p_reward_campaign_id?: string
          p_service_zone_id: string
        }
        Returns: string
      }
      create_shakh_store_order_v2: {
        Args: {
          p_delivery_address: string
          p_delivery_notes?: string
          p_delivery_phone: string
          p_idempotency_key?: string
          p_items: Json
          p_reward_amount_iqd?: number
          p_reward_campaign_id?: string
          p_service_zone_id: string
        }
        Returns: string
      }
      current_app_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      is_super_admin: { Args: never; Returns: boolean }
      request_captain_application: {
        Args: {
          p_captain_type: Database["public"]["Enums"]["captain_type"]
          p_merchant_id?: string
          p_note?: string
        }
        Returns: string
      }
      request_merchant_account: {
        Args: {
          p_address?: string
          p_business_name: string
          p_description?: string
          p_merchant_type: Database["public"]["Enums"]["app_role"]
        }
        Returns: string
      }
      request_wallet_payout: {
        Args: { p_amount_iqd: number; p_method: string; p_note?: string }
        Returns: string
      }
      request_wallet_topup: {
        Args: { p_amount_iqd: number; p_note?: string; p_receipt_path?: string }
        Returns: string
      }
      review_captain_application: {
        Args: {
          p_admin_note?: string
          p_application_id: string
          p_approve: boolean
        }
        Returns: undefined
      }
      review_wallet_topup: {
        Args: {
          p_admin_note?: string
          p_approve: boolean
          p_request_id: string
        }
        Returns: undefined
      }
      service_zone_contains_point: {
        Args: {
          p_boundary_geojson: Json
          p_latitude: number
          p_longitude: number
        }
        Returns: boolean
      }
      set_fixed_commission_setting: {
        Args: {
          p_fixed_commission_per_unit_iqd: number
          p_merchant_type: Database["public"]["Enums"]["app_role"]
        }
        Returns: undefined
      }
      settle_delivered_order: {
        Args: { p_order_id: string }
        Returns: undefined
      }
      update_captain_live_location: {
        Args: {
          p_accuracy_m?: number
          p_latitude: number
          p_longitude: number
          p_order_id: string
        }
        Returns: undefined
      }
      update_my_profile: {
        Args: { p_full_name: string; p_phone: string }
        Returns: undefined
      }
      update_order_status: {
        Args: { p_order_id: string; p_status: string }
        Returns: undefined
      }
      verify_push_webhook_secret: {
        Args: { p_candidate: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "captain"
        | "customer"
        | "supermarket"
        | "restaurant"
        | "butcher_poultry"
        | "grocery"
      captain_type: "shakh" | "merchant"
      record_status: "pending" | "approved" | "rejected" | "active" | "inactive"
      wallet_entry_type:
        | "topup"
        | "merchant_commission"
        | "captain_delivery"
        | "platform_delivery_share"
        | "reward_credit"
        | "payout_debit"
        | "admin_adjustment"
        | "refund"
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
    Enums: {
      app_role: [
        "super_admin",
        "captain",
        "customer",
        "supermarket",
        "restaurant",
        "butcher_poultry",
        "grocery",
      ],
      captain_type: ["shakh", "merchant"],
      record_status: ["pending", "approved", "rejected", "active", "inactive"],
      wallet_entry_type: [
        "topup",
        "merchant_commission",
        "captain_delivery",
        "platform_delivery_share",
        "reward_credit",
        "payout_debit",
        "admin_adjustment",
        "refund",
      ],
    },
  },
} as const
