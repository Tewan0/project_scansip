export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Restaurant = {
  id: string;
  owner_user_id: string;
  name: string;
  promptpay_number: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
};

export type RestaurantInsert = {
  id?: string;
  owner_user_id: string;
  name: string;
  promptpay_number?: string | null;
  logo_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type RestaurantUpdate = {
  id?: string;
  owner_user_id?: string;
  name?: string;
  promptpay_number?: string | null;
  logo_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type Database = {
  public: {
    Tables: {
      restaurants: {
        Row: Restaurant;
        Insert: RestaurantInsert;
        Update: RestaurantUpdate;
        Relationships: [
          {
            foreignKeyName: "restaurants_owner_user_id_fkey";
            columns: ["owner_user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
