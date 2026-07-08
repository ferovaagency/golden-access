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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      business_assistant_messages: {
        Row: {
          content: string | null
          created_at: string
          id: string
          parts: Json
          role: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          parts?: Json
          role: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          parts?: Json
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_bot_config: {
        Row: {
          bot_enabled: boolean
          custom_prompt: string | null
          id: boolean
          instance_name: string
          updated_at: string
        }
        Insert: {
          bot_enabled?: boolean
          custom_prompt?: string | null
          id?: boolean
          instance_name?: string
          updated_at?: string
        }
        Update: {
          bot_enabled?: boolean
          custom_prompt?: string | null
          id?: boolean
          instance_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_bot_knowledge: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          source: string | null
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          source?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          source?: string | null
        }
        Relationships: []
      }
      crm_citas_diagnostico: {
        Row: {
          calendar_event_id: string | null
          created_at: string
          duracion_min: number
          email_prospecto: string | null
          es_pagada: boolean
          estado: string
          fecha_hora: string
          id: string
          meet_link: string | null
          moneda: string | null
          monto: number | null
          nombre_prospecto: string
          notas: string | null
          oportunidad_id: string | null
          telefono_prospecto: string | null
        }
        Insert: {
          calendar_event_id?: string | null
          created_at?: string
          duracion_min?: number
          email_prospecto?: string | null
          es_pagada?: boolean
          estado?: string
          fecha_hora: string
          id?: string
          meet_link?: string | null
          moneda?: string | null
          monto?: number | null
          nombre_prospecto: string
          notas?: string | null
          oportunidad_id?: string | null
          telefono_prospecto?: string | null
        }
        Update: {
          calendar_event_id?: string | null
          created_at?: string
          duracion_min?: number
          email_prospecto?: string | null
          es_pagada?: boolean
          estado?: string
          fecha_hora?: string
          id?: string
          meet_link?: string | null
          moneda?: string | null
          monto?: number | null
          nombre_prospecto?: string
          notas?: string | null
          oportunidad_id?: string | null
          telefono_prospecto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_citas_diagnostico_oportunidad_id_fkey"
            columns: ["oportunidad_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contenido_potencial: {
        Row: {
          autor: string | null
          comentario_sugerido: string | null
          detectado_en: string
          estado: string
          id: string
          plataforma: string
          razon: string | null
          resumen: string | null
          score_potencial: number | null
          url_publicacion: string
        }
        Insert: {
          autor?: string | null
          comentario_sugerido?: string | null
          detectado_en?: string
          estado?: string
          id?: string
          plataforma?: string
          razon?: string | null
          resumen?: string | null
          score_potencial?: number | null
          url_publicacion: string
        }
        Update: {
          autor?: string | null
          comentario_sugerido?: string | null
          detectado_en?: string
          estado?: string
          id?: string
          plataforma?: string
          razon?: string | null
          resumen?: string | null
          score_potencial?: number | null
          url_publicacion?: string
        }
        Relationships: []
      }
      crm_interacciones: {
        Row: {
          canal: string
          contenido: string | null
          created_by: string | null
          enlace: string | null
          id: string
          ocurrido_en: string
          oportunidad_id: string
          tipo: string
        }
        Insert: {
          canal: string
          contenido?: string | null
          created_by?: string | null
          enlace?: string | null
          id?: string
          ocurrido_en?: string
          oportunidad_id: string
          tipo: string
        }
        Update: {
          canal?: string
          contenido?: string | null
          created_by?: string | null
          enlace?: string | null
          id?: string
          ocurrido_en?: string
          oportunidad_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_interacciones_oportunidad_id_fkey"
            columns: ["oportunidad_id"]
            isOneToOne: false
            referencedRelation: "crm_oportunidades"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_oportunidades: {
        Row: {
          apollo_data: Json | null
          apollo_enriched_at: string | null
          canal_origen: string
          closed_at: string | null
          created_at: string
          email: string | null
          empresa: string | null
          estado: string
          fecha_siguiente_accion: string | null
          fuente_url: string | null
          id: string
          moneda: string | null
          nombre_contacto: string
          notas: string | null
          playbook_email: string | null
          playbook_generated_at: string | null
          playbook_linkedin_conectar: boolean | null
          playbook_linkedin_mensaje: string | null
          playbook_linkedin_nota: string | null
          playbook_whatsapp_mensaje: string | null
          probabilidad: number | null
          servicio_id: string | null
          siguiente_accion: string | null
          telefono: string | null
          updated_at: string
          valor_estimado: number | null
        }
        Insert: {
          apollo_data?: Json | null
          apollo_enriched_at?: string | null
          canal_origen?: string
          closed_at?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          estado?: string
          fecha_siguiente_accion?: string | null
          fuente_url?: string | null
          id?: string
          moneda?: string | null
          nombre_contacto: string
          notas?: string | null
          playbook_email?: string | null
          playbook_generated_at?: string | null
          playbook_linkedin_conectar?: boolean | null
          playbook_linkedin_mensaje?: string | null
          playbook_linkedin_nota?: string | null
          playbook_whatsapp_mensaje?: string | null
          probabilidad?: number | null
          servicio_id?: string | null
          siguiente_accion?: string | null
          telefono?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Update: {
          apollo_data?: Json | null
          apollo_enriched_at?: string | null
          canal_origen?: string
          closed_at?: string | null
          created_at?: string
          email?: string | null
          empresa?: string | null
          estado?: string
          fecha_siguiente_accion?: string | null
          fuente_url?: string | null
          id?: string
          moneda?: string | null
          nombre_contacto?: string
          notas?: string | null
          playbook_email?: string | null
          playbook_generated_at?: string | null
          playbook_linkedin_conectar?: boolean | null
          playbook_linkedin_mensaje?: string | null
          playbook_linkedin_nota?: string | null
          playbook_whatsapp_mensaje?: string | null
          probabilidad?: number | null
          servicio_id?: string | null
          siguiente_accion?: string | null
          telefono?: string | null
          updated_at?: string
          valor_estimado?: number | null
        }
        Relationships: []
      }
      crm_resenas: {
        Row: {
          calificacion: number | null
          created_at: string
          detectada_en: string
          email_from: string | null
          email_message_id: string | null
          email_subject: string | null
          id: string
          link: string | null
          plataforma: string
          resenador: string | null
          respondida: boolean
          texto: string | null
          updated_at: string
        }
        Insert: {
          calificacion?: number | null
          created_at?: string
          detectada_en?: string
          email_from?: string | null
          email_message_id?: string | null
          email_subject?: string | null
          id?: string
          link?: string | null
          plataforma: string
          resenador?: string | null
          respondida?: boolean
          texto?: string | null
          updated_at?: string
        }
        Update: {
          calificacion?: number | null
          created_at?: string
          detectada_en?: string
          email_from?: string | null
          email_message_id?: string | null
          email_subject?: string | null
          id?: string
          link?: string | null
          plataforma?: string
          resenador?: string | null
          respondida?: boolean
          texto?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      crm_review_sources: {
        Row: {
          created_at: string
          enabled: boolean
          gmail_query: string | null
          id: string
          last_scanned_at: string | null
          nombre: string
          plataforma: string
          profile_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          gmail_query?: string | null
          id?: string
          last_scanned_at?: string | null
          nombre: string
          plataforma: string
          profile_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          gmail_query?: string | null
          id?: string
          last_scanned_at?: string | null
          nombre?: string
          plataforma?: string
          profile_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_team_members: {
        Row: {
          created_at: string
          email: string
          nombre: string | null
          rol: string
        }
        Insert: {
          created_at?: string
          email: string
          nombre?: string | null
          rol?: string
        }
        Update: {
          created_at?: string
          email?: string
          nombre?: string | null
          rol?: string
        }
        Relationships: []
      }
      finance_abonos: {
        Row: {
          fecha: string
          id: string
          monto: number
          notas: string | null
          tipo_pago: string | null
          user_id: string
          venta_id: string
        }
        Insert: {
          fecha: string
          id?: string
          monto?: number
          notas?: string | null
          tipo_pago?: string | null
          user_id: string
          venta_id: string
        }
        Update: {
          fecha?: string
          id?: string
          monto?: number
          notas?: string | null
          tipo_pago?: string | null
          user_id?: string
          venta_id?: string
        }
        Relationships: []
      }
      finance_clientes: {
        Row: {
          activo: boolean
          declarante: boolean
          entregables: string | null
          fecha_creacion: string
          id: string
          kpis: string | null
          marca_info: string | null
          nombre: string
          notas: string | null
          objetivos: string | null
          progreso: number | null
          responsable: string | null
          tipo: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          declarante?: boolean
          entregables?: string | null
          fecha_creacion: string
          id: string
          kpis?: string | null
          marca_info?: string | null
          nombre: string
          notas?: string | null
          objetivos?: string | null
          progreso?: number | null
          responsable?: string | null
          tipo: string
          user_id: string
        }
        Update: {
          activo?: boolean
          declarante?: boolean
          entregables?: string | null
          fecha_creacion?: string
          id?: string
          kpis?: string | null
          marca_info?: string | null
          nombre?: string
          notas?: string | null
          objetivos?: string | null
          progreso?: number | null
          responsable?: string | null
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_config: {
        Row: {
          horas_objetivo_mes: number
          ibc_porcentaje: number
          meta_ventas_mensual: number
          retencion_servicio_min_uvt: number
          salario_propuesto: number
          smmlv: number
          tarifa_iva: number
          tarifa_pension: number
          tarifa_ret_declarante: number
          tarifa_ret_no_declarante: number
          tarifa_salud: number
          tope_no_declarante_uvt: number
          tope_no_paga_renta_uvt: number
          tope_responsable_iva_uvt: number
          trm: number
          updated_at: string
          user_id: string
          uvt: number
        }
        Insert: {
          horas_objetivo_mes?: number
          ibc_porcentaje?: number
          meta_ventas_mensual?: number
          retencion_servicio_min_uvt?: number
          salario_propuesto?: number
          smmlv?: number
          tarifa_iva?: number
          tarifa_pension?: number
          tarifa_ret_declarante?: number
          tarifa_ret_no_declarante?: number
          tarifa_salud?: number
          tope_no_declarante_uvt?: number
          tope_no_paga_renta_uvt?: number
          tope_responsable_iva_uvt?: number
          trm?: number
          updated_at?: string
          user_id: string
          uvt?: number
        }
        Update: {
          horas_objetivo_mes?: number
          ibc_porcentaje?: number
          meta_ventas_mensual?: number
          retencion_servicio_min_uvt?: number
          salario_propuesto?: number
          smmlv?: number
          tarifa_iva?: number
          tarifa_pension?: number
          tarifa_ret_declarante?: number
          tarifa_ret_no_declarante?: number
          tarifa_salud?: number
          tope_no_declarante_uvt?: number
          tope_no_paga_renta_uvt?: number
          tope_responsable_iva_uvt?: number
          trm?: number
          updated_at?: string
          user_id?: string
          uvt?: number
        }
        Relationships: []
      }
      finance_herramienta_servicios: {
        Row: {
          herramienta_id: string
          servicio_id: string
          user_id: string
        }
        Insert: {
          herramienta_id: string
          servicio_id: string
          user_id: string
        }
        Update: {
          herramienta_id?: string
          servicio_id?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_herramientas: {
        Row: {
          id: string
          moneda: string
          monto: number
          nombre: string
          notas: string | null
          tipo_cobro: string
          user_id: string
        }
        Insert: {
          id: string
          moneda?: string
          monto?: number
          nombre: string
          notas?: string | null
          tipo_cobro?: string
          user_id: string
        }
        Update: {
          id?: string
          moneda?: string
          monto?: number
          nombre?: string
          notas?: string | null
          tipo_cobro?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_horas: {
        Row: {
          cliente_id: string
          descripcion: string | null
          fecha: string
          horas: number
          id: string
          servicio_id: string
          user_id: string
        }
        Insert: {
          cliente_id: string
          descripcion?: string | null
          fecha: string
          horas?: number
          id: string
          servicio_id: string
          user_id: string
        }
        Update: {
          cliente_id?: string
          descripcion?: string | null
          fecha?: string
          horas?: number
          id?: string
          servicio_id?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_otros_gastos: {
        Row: {
          categoria: string
          id: string
          moneda: string
          monto: number
          nombre: string
          user_id: string
        }
        Insert: {
          categoria?: string
          id: string
          moneda?: string
          monto?: number
          nombre: string
          user_id: string
        }
        Update: {
          categoria?: string
          id?: string
          moneda?: string
          monto?: number
          nombre?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_pagos_egresos: {
        Row: {
          categoria: string
          concepto: string
          fecha: string
          id: string
          metodo_pago: string | null
          moneda: string
          monto: number
          notas: string | null
          user_id: string
        }
        Insert: {
          categoria: string
          concepto: string
          fecha: string
          id: string
          metodo_pago?: string | null
          moneda?: string
          monto?: number
          notas?: string | null
          user_id: string
        }
        Update: {
          categoria?: string
          concepto?: string
          fecha?: string
          id?: string
          metodo_pago?: string | null
          moneda?: string
          monto?: number
          notas?: string | null
          user_id?: string
        }
        Relationships: []
      }
      finance_servicios: {
        Row: {
          costo_unitario: number
          descripcion: string | null
          id: string
          nombre: string
          user_id: string
        }
        Insert: {
          costo_unitario?: number
          descripcion?: string | null
          id: string
          nombre: string
          user_id: string
        }
        Update: {
          costo_unitario?: number
          descripcion?: string | null
          id?: string
          nombre?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_ventas: {
        Row: {
          adelanto: number
          cantidad: number
          cliente_id: string
          costo_unitario: number
          estado_pago: string
          fecha: string
          id: string
          moneda: string
          notas: string | null
          precio_venta_unitario: number
          servicio_id: string
          tipo: string
          user_id: string
        }
        Insert: {
          adelanto?: number
          cantidad?: number
          cliente_id: string
          costo_unitario?: number
          estado_pago?: string
          fecha: string
          id: string
          moneda?: string
          notas?: string | null
          precio_venta_unitario?: number
          servicio_id: string
          tipo?: string
          user_id: string
        }
        Update: {
          adelanto?: number
          cantidad?: number
          cliente_id?: string
          costo_unitario?: number
          estado_pago?: string
          fecha?: string
          id?: string
          moneda?: string
          notas?: string | null
          precio_venta_unitario?: number
          servicio_id?: string
          tipo?: string
          user_id?: string
        }
        Relationships: []
      }
      google_workspace_connections: {
        Row: {
          access_token: string | null
          connected: boolean
          connected_email: string | null
          created_at: string
          expires_at: string | null
          last_error: string | null
          scopes: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          connected?: boolean
          connected_email?: string | null
          created_at?: string
          expires_at?: string | null
          last_error?: string | null
          scopes?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          connected?: boolean
          connected_email?: string | null
          created_at?: string
          expires_at?: string | null
          last_error?: string | null
          scopes?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          amount_usd: number | null
          created_at: string
          expires_at: string | null
          id: string
          provider: string
          provider_order_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount_usd?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string
          provider_order_id?: string | null
          status: string
          user_id: string
        }
        Update: {
          amount_usd?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          provider?: string
          provider_order_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      business_overview: {
        Row: {
          clientes_activos: number | null
          egresos_pagados: number | null
          gastos_operativos: number | null
          margen_directo_total: number | null
          meta_ventas_mensual: number | null
          oportunidades_total: number | null
          pipeline_estimado: number | null
          resenas_sin_responder: number | null
          trm: number | null
          user_id: string | null
          ventas_totales: number | null
        }
        Insert: {
          clientes_activos?: never
          egresos_pagados?: never
          gastos_operativos?: never
          margen_directo_total?: never
          meta_ventas_mensual?: number | null
          oportunidades_total?: never
          pipeline_estimado?: never
          resenas_sin_responder?: never
          trm?: number | null
          user_id?: string | null
          ventas_totales?: never
        }
        Update: {
          clientes_activos?: never
          egresos_pagados?: never
          gastos_operativos?: never
          margen_directo_total?: never
          meta_ventas_mensual?: number | null
          oportunidades_total?: never
          pipeline_estimado?: never
          resenas_sin_responder?: never
          trm?: number | null
          user_id?: string | null
          ventas_totales?: never
        }
        Relationships: []
      }
      crm_growth_overview: {
        Row: {
          citas_activas: number | null
          contenidos_analizados: number | null
          oportunidades_abiertas: number | null
          oportunidades_ganadas: number | null
          oportunidades_total: number | null
          pipeline_estimado: number | null
          resenas_sin_responder: number | null
        }
        Relationships: []
      }
      finance_service_profitability: {
        Row: {
          costos_directos: number | null
          horas_registradas: number | null
          ingresos_brutos: number | null
          margen_bruto: number | null
          servicio_id: string | null
          servicio_nombre: string | null
          user_id: string | null
          ventas_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      is_team_member: { Args: never; Returns: boolean }
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
