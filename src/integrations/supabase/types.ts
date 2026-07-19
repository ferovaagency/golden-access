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
      admin_courtesy_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          notas: string | null
          plan: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notas?: string | null
          plan?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notas?: string | null
          plan?: string
        }
        Relationships: []
      }
      admin_module_overrides: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      biz_crm_contactos: {
        Row: {
          created_at: string
          email: string | null
          empresa: string | null
          estado: string
          fecha_proxima_accion: string | null
          id: string
          moneda: string
          nombre_contacto: string
          notas: string | null
          proxima_accion: string | null
          telefono: string | null
          updated_at: string
          user_id: string
          valor_estimado: number | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa?: string | null
          estado?: string
          fecha_proxima_accion?: string | null
          id: string
          moneda?: string
          nombre_contacto: string
          notas?: string | null
          proxima_accion?: string | null
          telefono?: string | null
          updated_at?: string
          user_id: string
          valor_estimado?: number | null
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa?: string | null
          estado?: string
          fecha_proxima_accion?: string | null
          id?: string
          moneda?: string
          nombre_contacto?: string
          notas?: string | null
          proxima_accion?: string | null
          telefono?: string | null
          updated_at?: string
          user_id?: string
          valor_estimado?: number | null
        }
        Relationships: []
      }
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
      business_blindspots: {
        Row: {
          action: string
          action_route: string | null
          category: Database["public"]["Enums"]["blindspot_category"]
          created_at: string
          detected_at: string
          dismissed_at: string | null
          entity_id: string | null
          entity_type: string | null
          fingerprint: string
          id: string
          impact: string
          metric_label: string | null
          metric_value: number | null
          resolved_at: string | null
          title: string
          updated_at: string
          urgency: Database["public"]["Enums"]["blindspot_urgency"]
          user_id: string
          why: string
        }
        Insert: {
          action: string
          action_route?: string | null
          category: Database["public"]["Enums"]["blindspot_category"]
          created_at?: string
          detected_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fingerprint: string
          id?: string
          impact: string
          metric_label?: string | null
          metric_value?: number | null
          resolved_at?: string | null
          title: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["blindspot_urgency"]
          user_id: string
          why: string
        }
        Update: {
          action?: string
          action_route?: string | null
          category?: Database["public"]["Enums"]["blindspot_category"]
          created_at?: string
          detected_at?: string
          dismissed_at?: string | null
          entity_id?: string | null
          entity_type?: string | null
          fingerprint?: string
          id?: string
          impact?: string
          metric_label?: string | null
          metric_value?: number | null
          resolved_at?: string | null
          title?: string
          updated_at?: string
          urgency?: Database["public"]["Enums"]["blindspot_urgency"]
          user_id?: string
          why?: string
        }
        Relationships: []
      }
      business_health_snapshots: {
        Row: {
          computed_at: string
          created_at: string
          delta: number
          id: string
          narrative: string | null
          previous_score: number | null
          score: number
          snapshot_date: string
          sub_scores: Json
          top_reasons: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          computed_at?: string
          created_at?: string
          delta?: number
          id?: string
          narrative?: string | null
          previous_score?: number | null
          score: number
          snapshot_date?: string
          sub_scores?: Json
          top_reasons?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          computed_at?: string
          created_at?: string
          delta?: number
          id?: string
          narrative?: string | null
          previous_score?: number | null
          score?: number
          snapshot_date?: string
          sub_scores?: Json
          top_reasons?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      business_profile: {
        Row: {
          ciudad: string | null
          created_at: string
          industria: string | null
          nombre_negocio: string | null
          onboarding_completado: boolean
          tamano_equipo: string | null
          telefono_contacto: string | null
          tipo_negocio: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ciudad?: string | null
          created_at?: string
          industria?: string | null
          nombre_negocio?: string | null
          onboarding_completado?: boolean
          tamano_equipo?: string | null
          telefono_contacto?: string | null
          tipo_negocio?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ciudad?: string | null
          created_at?: string
          industria?: string | null
          nombre_negocio?: string | null
          onboarding_completado?: boolean
          tamano_equipo?: string | null
          telefono_contacto?: string | null
          tipo_negocio?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ceo_reports: {
        Row: {
          created_at: string
          headline: string | null
          health_score: number | null
          id: string
          metrics: Json
          period: Database["public"]["Enums"]["ceo_report_period"]
          period_end: string
          period_start: string
          priorities: Json
          risks: Json
          summary_md: string | null
          updated_at: string
          user_id: string
          wins: Json
        }
        Insert: {
          created_at?: string
          headline?: string | null
          health_score?: number | null
          id?: string
          metrics?: Json
          period: Database["public"]["Enums"]["ceo_report_period"]
          period_end: string
          period_start: string
          priorities?: Json
          risks?: Json
          summary_md?: string | null
          updated_at?: string
          user_id: string
          wins?: Json
        }
        Update: {
          created_at?: string
          headline?: string | null
          health_score?: number | null
          id?: string
          metrics?: Json
          period?: Database["public"]["Enums"]["ceo_report_period"]
          period_end?: string
          period_start?: string
          priorities?: Json
          risks?: Json
          summary_md?: string | null
          updated_at?: string
          user_id?: string
          wins?: Json
        }
        Relationships: []
      }
      courtesy_access_grants: {
        Row: {
          created_at: string
          email: string
          granted_by: string | null
          notas: string | null
          plan: string
        }
        Insert: {
          created_at?: string
          email: string
          granted_by?: string | null
          notas?: string | null
          plan?: string
        }
        Update: {
          created_at?: string
          email?: string
          granted_by?: string | null
          notas?: string | null
          plan?: string
        }
        Relationships: []
      }
      crm_acquisition_channels: {
        Row: {
          active: boolean
          color: string
          created_at: string
          id: string
          label: string
          slug: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          label: string
          slug: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          label?: string
          slug?: string
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
          source: string
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
          source?: string
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
          source?: string
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
          metadata: Json
          ocurrido_en: string
          oportunidad_id: string
          tipo: string
          whatsapp_message_id: string | null
        }
        Insert: {
          canal: string
          contenido?: string | null
          created_by?: string | null
          enlace?: string | null
          id?: string
          metadata?: Json
          ocurrido_en?: string
          oportunidad_id: string
          tipo: string
          whatsapp_message_id?: string | null
        }
        Update: {
          canal?: string
          contenido?: string | null
          created_by?: string | null
          enlace?: string | null
          id?: string
          metadata?: Json
          ocurrido_en?: string
          oportunidad_id?: string
          tipo?: string
          whatsapp_message_id?: string | null
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
          comision_porcentaje: number | null
          comision_valor: number | null
          created_at: string
          email: string | null
          email_message_id: string | null
          empresa: string | null
          estado: string
          fecha_siguiente_accion: string | null
          fuente_url: string | null
          id: string
          memoria_resumen: string | null
          memoria_updated_at: string | null
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
          vendedor: string | null
        }
        Insert: {
          apollo_data?: Json | null
          apollo_enriched_at?: string | null
          canal_origen?: string
          closed_at?: string | null
          comision_porcentaje?: number | null
          comision_valor?: number | null
          created_at?: string
          email?: string | null
          email_message_id?: string | null
          empresa?: string | null
          estado?: string
          fecha_siguiente_accion?: string | null
          fuente_url?: string | null
          id?: string
          memoria_resumen?: string | null
          memoria_updated_at?: string | null
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
          vendedor?: string | null
        }
        Update: {
          apollo_data?: Json | null
          apollo_enriched_at?: string | null
          canal_origen?: string
          closed_at?: string | null
          comision_porcentaje?: number | null
          comision_valor?: number | null
          created_at?: string
          email?: string | null
          email_message_id?: string | null
          empresa?: string | null
          estado?: string
          fecha_siguiente_accion?: string | null
          fuente_url?: string | null
          id?: string
          memoria_resumen?: string | null
          memoria_updated_at?: string | null
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
          vendedor?: string | null
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
          telefono_notificaciones: string | null
        }
        Insert: {
          created_at?: string
          email: string
          nombre?: string | null
          rol?: string
          telefono_notificaciones?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          nombre?: string | null
          rol?: string
          telefono_notificaciones?: string | null
        }
        Relationships: []
      }
      crm_whatsapp_instances: {
        Row: {
          connected_at: string | null
          connected_phone: string | null
          created_at: string
          instance_name: string
          last_error: string | null
          pairing_code: string | null
          qr_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connected_at?: string | null
          connected_phone?: string | null
          created_at?: string
          instance_name: string
          last_error?: string | null
          pairing_code?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connected_at?: string | null
          connected_phone?: string | null
          created_at?: string
          instance_name?: string
          last_error?: string | null
          pairing_code?: string | null
          qr_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      decision_simulations: {
        Row: {
          created_at: string
          id: string
          inputs: Json
          question: string
          recommendation: string | null
          result: Json
          scenario_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inputs?: Json
          question: string
          recommendation?: string | null
          result?: Json
          scenario_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inputs?: Json
          question?: string
          recommendation?: string | null
          result?: Json
          scenario_type?: string
          user_id?: string
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
      finance_accounts: {
        Row: {
          activo: boolean
          corte_dia: number | null
          created_at: string
          cupo: number | null
          id: string
          moneda: string
          nombre: string
          notas: string | null
          pago_dia: number | null
          saldo_inicial: number
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          corte_dia?: number | null
          created_at?: string
          cupo?: number | null
          id?: string
          moneda?: string
          nombre: string
          notas?: string | null
          pago_dia?: number | null
          saldo_inicial?: number
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activo?: boolean
          corte_dia?: number | null
          created_at?: string
          cupo?: number | null
          id?: string
          moneda?: string
          nombre?: string
          notas?: string | null
          pago_dia?: number | null
          saldo_inicial?: number
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_budget_monthly: {
        Row: {
          categoria: string
          created_at: string
          id: string
          moneda: string
          monto_presupuestado: number
          notas: string | null
          origen: string
          periodo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          categoria: string
          created_at?: string
          id?: string
          moneda?: string
          monto_presupuestado?: number
          notas?: string | null
          origen?: string
          periodo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          categoria?: string
          created_at?: string
          id?: string
          moneda?: string
          monto_presupuestado?: number
          notas?: string | null
          origen?: string
          periodo?: string
          updated_at?: string
          user_id?: string
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
      finance_debt_payments: {
        Row: {
          created_at: string
          debt_id: string
          fecha: string
          id: string
          monto: number
          notas: string | null
          payment_method_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          debt_id: string
          fecha: string
          id?: string
          monto: number
          notas?: string | null
          payment_method_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          debt_id?: string
          fecha?: string
          id?: string
          monto?: number
          notas?: string | null
          payment_method_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_debt_payments_debt_id_fkey"
            columns: ["debt_id"]
            isOneToOne: false
            referencedRelation: "finance_debts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_debt_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "finance_payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_debts: {
        Row: {
          account_id: string | null
          created_at: string
          cuotas: number | null
          estado: string
          fecha_corte: string | null
          fecha_limite: string | null
          id: string
          moneda: string
          nombre: string
          notas: string | null
          saldo_inicial: number
          tasa: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          cuotas?: number | null
          estado?: string
          fecha_corte?: string | null
          fecha_limite?: string | null
          id?: string
          moneda?: string
          nombre: string
          notas?: string | null
          saldo_inicial: number
          tasa?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          cuotas?: number | null
          estado?: string
          fecha_corte?: string | null
          fecha_limite?: string | null
          id?: string
          moneda?: string
          nombre?: string
          notas?: string | null
          saldo_inicial?: number
          tasa?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_debts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
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
          comprobante_nombre: string | null
          comprobante_url: string | null
          id: string
          moneda: string
          monto: number
          nombre: string
          user_id: string
        }
        Insert: {
          categoria?: string
          comprobante_nombre?: string | null
          comprobante_url?: string | null
          id: string
          moneda?: string
          monto?: number
          nombre: string
          user_id: string
        }
        Update: {
          categoria?: string
          comprobante_nombre?: string | null
          comprobante_url?: string | null
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
          comprobante_nombre: string | null
          comprobante_url: string | null
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
          comprobante_nombre?: string | null
          comprobante_url?: string | null
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
          comprobante_nombre?: string | null
          comprobante_url?: string | null
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
      finance_payables: {
        Row: {
          account_id: string | null
          concepto: string | null
          created_at: string
          documento_nombre: string | null
          documento_url: string | null
          estado: string
          factura: string | null
          fecha_pago_real: string | null
          id: string
          moneda: string
          monto_pagado: number | null
          notas: string | null
          payment_method_id: string | null
          proveedor: string
          updated_at: string
          user_id: string
          valor: number
          vencimiento: string | null
        }
        Insert: {
          account_id?: string | null
          concepto?: string | null
          created_at?: string
          documento_nombre?: string | null
          documento_url?: string | null
          estado?: string
          factura?: string | null
          fecha_pago_real?: string | null
          id?: string
          moneda?: string
          monto_pagado?: number | null
          notas?: string | null
          payment_method_id?: string | null
          proveedor: string
          updated_at?: string
          user_id: string
          valor: number
          vencimiento?: string | null
        }
        Update: {
          account_id?: string | null
          concepto?: string | null
          created_at?: string
          documento_nombre?: string | null
          documento_url?: string | null
          estado?: string
          factura?: string | null
          fecha_pago_real?: string | null
          id?: string
          moneda?: string
          monto_pagado?: number | null
          notas?: string | null
          payment_method_id?: string | null
          proveedor?: string
          updated_at?: string
          user_id?: string
          valor?: number
          vencimiento?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_payables_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payables_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "finance_payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payment_methods: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          notas: string | null
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          notas?: string | null
          tipo: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          notas?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_receivable_payments: {
        Row: {
          account_id: string | null
          created_at: string
          fecha: string
          id: string
          monto: number
          notas: string | null
          payment_method_id: string | null
          receivable_id: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          fecha: string
          id?: string
          monto: number
          notas?: string | null
          payment_method_id?: string | null
          receivable_id: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          fecha?: string
          id?: string
          monto?: number
          notas?: string | null
          payment_method_id?: string | null
          receivable_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_receivable_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_receivable_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "finance_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_receivable_payments_receivable_id_fkey"
            columns: ["receivable_id"]
            isOneToOne: false
            referencedRelation: "finance_receivables"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_receivables: {
        Row: {
          cliente_id: string | null
          concepto: string
          created_at: string
          documento_nombre: string | null
          documento_url: string | null
          estado: string
          factura: string | null
          id: string
          moneda: string
          notas: string | null
          updated_at: string
          user_id: string
          valor: number
          vencimiento: string | null
        }
        Insert: {
          cliente_id?: string | null
          concepto: string
          created_at?: string
          documento_nombre?: string | null
          documento_url?: string | null
          estado?: string
          factura?: string | null
          id?: string
          moneda?: string
          notas?: string | null
          updated_at?: string
          user_id: string
          valor: number
          vencimiento?: string | null
        }
        Update: {
          cliente_id?: string | null
          concepto?: string
          created_at?: string
          documento_nombre?: string | null
          documento_url?: string | null
          estado?: string
          factura?: string | null
          id?: string
          moneda?: string
          notas?: string | null
          updated_at?: string
          user_id?: string
          valor?: number
          vencimiento?: string | null
        }
        Relationships: []
      }
      finance_servicios: {
        Row: {
          costo_entrega_estimado: number | null
          costo_unitario: number
          descripcion: string | null
          id: string
          incluye: string | null
          margen_objetivo: number | null
          market_reference_notes: string | null
          no_incluye: string | null
          nombre: string
          precio_habitual: number | null
          precio_ofrecido: number | null
          user_id: string
        }
        Insert: {
          costo_entrega_estimado?: number | null
          costo_unitario?: number
          descripcion?: string | null
          id: string
          incluye?: string | null
          margen_objetivo?: number | null
          market_reference_notes?: string | null
          no_incluye?: string | null
          nombre: string
          precio_habitual?: number | null
          precio_ofrecido?: number | null
          user_id: string
        }
        Update: {
          costo_entrega_estimado?: number | null
          costo_unitario?: number
          descripcion?: string | null
          id?: string
          incluye?: string | null
          margen_objetivo?: number | null
          market_reference_notes?: string | null
          no_incluye?: string | null
          nombre?: string
          precio_habitual?: number | null
          precio_ofrecido?: number | null
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
      marketing_campaign_metrics: {
        Row: {
          campaign_id: string
          citas: number
          citas_efectivas: number
          clics: number
          comision: number
          costo_entrega: number
          costo_profesional: number
          created_at: string
          id: string
          impresiones: number
          inversion: number
          leads: number
          leads_calificados: number
          ltv: number
          notas: string | null
          periodo: string
          ticket_promedio: number
          updated_at: string
          user_id: string
          ventas: number
        }
        Insert: {
          campaign_id: string
          citas?: number
          citas_efectivas?: number
          clics?: number
          comision?: number
          costo_entrega?: number
          costo_profesional?: number
          created_at?: string
          id?: string
          impresiones?: number
          inversion?: number
          leads?: number
          leads_calificados?: number
          ltv?: number
          notas?: string | null
          periodo: string
          ticket_promedio?: number
          updated_at?: string
          user_id: string
          ventas?: number
        }
        Update: {
          campaign_id?: string
          citas?: number
          citas_efectivas?: number
          clics?: number
          comision?: number
          costo_entrega?: number
          costo_profesional?: number
          created_at?: string
          id?: string
          impresiones?: number
          inversion?: number
          leads?: number
          leads_calificados?: number
          ltv?: number
          notas?: string | null
          periodo?: string
          ticket_promedio?: number
          updated_at?: string
          user_id?: string
          ventas?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaign_metrics_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "marketing_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_campaigns: {
        Row: {
          account_id: string | null
          canal: string | null
          cliente_id: string | null
          created_at: string
          estado: string
          fecha_fin: string | null
          fecha_inicio: string | null
          id: string
          moneda: string
          nombre: string
          notas: string | null
          payment_method_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          canal?: string | null
          cliente_id?: string | null
          created_at?: string
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          moneda?: string
          nombre: string
          notas?: string | null
          payment_method_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          canal?: string | null
          cliente_id?: string | null
          created_at?: string
          estado?: string
          fecha_fin?: string | null
          fecha_inicio?: string | null
          id?: string
          moneda?: string
          nombre?: string
          notas?: string | null
          payment_method_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_campaigns_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketing_campaigns_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "finance_payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_messages: {
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
      paddle_webhook_events: {
        Row: {
          event_id: string
          event_type: string
          payload: Json
          processed_at: string
        }
        Insert: {
          event_id: string
          event_type: string
          payload: Json
          processed_at?: string
        }
        Update: {
          event_id?: string
          event_type?: string
          payload?: Json
          processed_at?: string
        }
        Relationships: []
      }
      planner_behavior: {
        Row: {
          id: string
          metric_key: string
          metric_value: Json
          sample_count: number
          updated_at: string
          user_id: string
          window_days: number
        }
        Insert: {
          id?: string
          metric_key: string
          metric_value: Json
          sample_count?: number
          updated_at?: string
          user_id: string
          window_days?: number
        }
        Update: {
          id?: string
          metric_key?: string
          metric_value?: Json
          sample_count?: number
          updated_at?: string
          user_id?: string
          window_days?: number
        }
        Relationships: []
      }
      planner_blocks: {
        Row: {
          category: Database["public"]["Enums"]["planner_category"]
          created_at: string
          ends_at: string
          external_id: string | null
          id: string
          notes: string | null
          protected: boolean
          source: string
          starts_at: string
          task_ids: string[]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["planner_category"]
          created_at?: string
          ends_at: string
          external_id?: string | null
          id?: string
          notes?: string | null
          protected?: boolean
          source?: string
          starts_at: string
          task_ids?: string[]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["planner_category"]
          created_at?: string
          ends_at?: string
          external_id?: string | null
          id?: string
          notes?: string | null
          protected?: boolean
          source?: string
          starts_at?: string
          task_ids?: string[]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planner_briefings: {
        Row: {
          briefing_date: string
          created_at: string
          id: string
          kind: string
          payload: Json
          user_id: string
        }
        Insert: {
          briefing_date: string
          created_at?: string
          id?: string
          kind: string
          payload: Json
          user_id: string
        }
        Update: {
          briefing_date?: string
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      planner_goals: {
        Row: {
          created_at: string
          deadline: string | null
          horizon: Database["public"]["Enums"]["planner_goal_horizon"]
          id: string
          metric: string | null
          parent_goal_id: string | null
          progress: number
          status: string
          target: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          horizon: Database["public"]["Enums"]["planner_goal_horizon"]
          id?: string
          metric?: string | null
          parent_goal_id?: string | null
          progress?: number
          status?: string
          target?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          horizon?: Database["public"]["Enums"]["planner_goal_horizon"]
          id?: string
          metric?: string | null
          parent_goal_id?: string | null
          progress?: number
          status?: string
          target?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_goals_parent_goal_id_fkey"
            columns: ["parent_goal_id"]
            isOneToOne: false
            referencedRelation: "planner_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      planner_inbox: {
        Row: {
          ai_confidence: number | null
          ai_reasoning: string | null
          created_at: string
          detected_category:
            | Database["public"]["Enums"]["planner_category"]
            | null
          detected_client: string | null
          detected_deadline: string | null
          detected_duration_min: number | null
          detected_energy: Database["public"]["Enums"]["planner_energy"] | null
          detected_priority:
            | Database["public"]["Enums"]["planner_priority"]
            | null
          detected_project: string | null
          detected_type: Database["public"]["Enums"]["planner_item_type"] | null
          id: string
          processed: boolean
          raw_text: string
          task_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_reasoning?: string | null
          created_at?: string
          detected_category?:
            | Database["public"]["Enums"]["planner_category"]
            | null
          detected_client?: string | null
          detected_deadline?: string | null
          detected_duration_min?: number | null
          detected_energy?: Database["public"]["Enums"]["planner_energy"] | null
          detected_priority?:
            | Database["public"]["Enums"]["planner_priority"]
            | null
          detected_project?: string | null
          detected_type?:
            | Database["public"]["Enums"]["planner_item_type"]
            | null
          id?: string
          processed?: boolean
          raw_text: string
          task_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_confidence?: number | null
          ai_reasoning?: string | null
          created_at?: string
          detected_category?:
            | Database["public"]["Enums"]["planner_category"]
            | null
          detected_client?: string | null
          detected_deadline?: string | null
          detected_duration_min?: number | null
          detected_energy?: Database["public"]["Enums"]["planner_energy"] | null
          detected_priority?:
            | Database["public"]["Enums"]["planner_priority"]
            | null
          detected_project?: string | null
          detected_type?:
            | Database["public"]["Enums"]["planner_item_type"]
            | null
          id?: string
          processed?: boolean
          raw_text?: string
          task_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planner_insights: {
        Row: {
          action_hint: string | null
          action_route: string | null
          body: string
          created_at: string
          data: Json | null
          dismissed: boolean
          id: string
          kind: string
          severity: Database["public"]["Enums"]["planner_insight_severity"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_hint?: string | null
          action_route?: string | null
          body: string
          created_at?: string
          data?: Json | null
          dismissed?: boolean
          id?: string
          kind: string
          severity?: Database["public"]["Enums"]["planner_insight_severity"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_hint?: string | null
          action_route?: string | null
          body?: string
          created_at?: string
          data?: Json | null
          dismissed?: boolean
          id?: string
          kind?: string
          severity?: Database["public"]["Enums"]["planner_insight_severity"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      planner_routines: {
        Row: {
          active: boolean
          cadence: string
          category: Database["public"]["Enums"]["planner_category"]
          created_at: string
          duration_min: number
          energy_required: Database["public"]["Enums"]["planner_energy"]
          hour: number | null
          id: string
          last_run_at: string | null
          name: string
          updated_at: string
          user_id: string
          weekday: number | null
        }
        Insert: {
          active?: boolean
          cadence?: string
          category?: Database["public"]["Enums"]["planner_category"]
          created_at?: string
          duration_min?: number
          energy_required?: Database["public"]["Enums"]["planner_energy"]
          hour?: number | null
          id?: string
          last_run_at?: string | null
          name: string
          updated_at?: string
          user_id: string
          weekday?: number | null
        }
        Update: {
          active?: boolean
          cadence?: string
          category?: Database["public"]["Enums"]["planner_category"]
          created_at?: string
          duration_min?: number
          energy_required?: Database["public"]["Enums"]["planner_energy"]
          hour?: number | null
          id?: string
          last_run_at?: string | null
          name?: string
          updated_at?: string
          user_id?: string
          weekday?: number | null
        }
        Relationships: []
      }
      planner_tasks: {
        Row: {
          actual_minutes: number | null
          ai_notes: string | null
          category: Database["public"]["Enums"]["planner_category"]
          client_ref: string | null
          completed_at: string | null
          created_at: string
          deadline: string | null
          description: string | null
          energy_required: Database["public"]["Enums"]["planner_energy"]
          estimated_minutes: number
          goal_id: string | null
          google_calendar_event_id: string | null
          id: string
          postponed_count: number
          priority: Database["public"]["Enums"]["planner_priority"]
          project_ref: string | null
          recurrence_days: number[]
          recurrence_until: string | null
          scheduled_for: string | null
          source_inbox_id: string | null
          status: Database["public"]["Enums"]["planner_task_status"]
          sync_to_google_calendar: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_minutes?: number | null
          ai_notes?: string | null
          category?: Database["public"]["Enums"]["planner_category"]
          client_ref?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          energy_required?: Database["public"]["Enums"]["planner_energy"]
          estimated_minutes?: number
          goal_id?: string | null
          google_calendar_event_id?: string | null
          id?: string
          postponed_count?: number
          priority?: Database["public"]["Enums"]["planner_priority"]
          project_ref?: string | null
          recurrence_days?: number[]
          recurrence_until?: string | null
          scheduled_for?: string | null
          source_inbox_id?: string | null
          status?: Database["public"]["Enums"]["planner_task_status"]
          sync_to_google_calendar?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_minutes?: number | null
          ai_notes?: string | null
          category?: Database["public"]["Enums"]["planner_category"]
          client_ref?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          description?: string | null
          energy_required?: Database["public"]["Enums"]["planner_energy"]
          estimated_minutes?: number
          goal_id?: string | null
          google_calendar_event_id?: string | null
          id?: string
          postponed_count?: number
          priority?: Database["public"]["Enums"]["planner_priority"]
          project_ref?: string | null
          recurrence_days?: number[]
          recurrence_until?: string | null
          scheduled_for?: string | null
          source_inbox_id?: string | null
          status?: Database["public"]["Enums"]["planner_task_status"]
          sync_to_google_calendar?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planner_tasks_source_inbox_id_fkey"
            columns: ["source_inbox_id"]
            isOneToOne: false
            referencedRelation: "planner_inbox"
            referencedColumns: ["id"]
          },
        ]
      }
      product_feedback: {
        Row: {
          admin_response: string | null
          created_at: string
          email: string | null
          estado: string
          id: string
          mensaje: string
          metadata: Json
          resolved_at: string | null
          resolved_by: string | null
          tipo: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_response?: string | null
          created_at?: string
          email?: string | null
          estado?: string
          id?: string
          mensaje: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          tipo: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_response?: string | null
          created_at?: string
          email?: string | null
          estado?: string
          id?: string
          mensaje?: string
          metadata?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          tipo?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      saas_plans: {
        Row: {
          activo: boolean
          code: string | null
          created_at: string
          currency: string
          descripcion: string | null
          id: string
          modulos: Json
          nombre: string
          orden: number
          precio_usd: number
          price_cop_monthly: number | null
          price_cop_yearly: number | null
          provisional: boolean
          updated_at: string
        }
        Insert: {
          activo?: boolean
          code?: string | null
          created_at?: string
          currency?: string
          descripcion?: string | null
          id: string
          modulos?: Json
          nombre: string
          orden?: number
          precio_usd?: number
          price_cop_monthly?: number | null
          price_cop_yearly?: number | null
          provisional?: boolean
          updated_at?: string
        }
        Update: {
          activo?: boolean
          code?: string | null
          created_at?: string
          currency?: string
          descripcion?: string | null
          id?: string
          modulos?: Json
          nombre?: string
          orden?: number
          precio_usd?: number
          price_cop_monthly?: number | null
          price_cop_yearly?: number | null
          provisional?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      saas_user_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          metadata: Json
          module: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          metadata?: Json
          module?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          metadata?: Json
          module?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_fiscal_profile: {
        Row: {
          country: string
          created_at: string
          currency_base: string
          id: string
          person_type: string
          regime: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          currency_base?: string
          id?: string
          person_type?: string
          regime?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          currency_base?: string
          id?: string
          person_type?: string
          regime?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          action_tab: string | null
          created_at: string
          id: string
          message: string
          read_at: string | null
          sender_name: string
          title: string
          user_id: string
        }
        Insert: {
          action_tab?: string | null
          created_at?: string
          id?: string
          message: string
          read_at?: string | null
          sender_name?: string
          title: string
          user_id: string
        }
        Update: {
          action_tab?: string | null
          created_at?: string
          id?: string
          message?: string
          read_at?: string | null
          sender_name?: string
          title?: string
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
          plan: string
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
          plan?: string
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
          plan?: string
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
      blindspot_category:
        | "client_at_risk"
        | "revenue_concentration"
        | "cash_risk"
        | "late_invoice"
        | "project_hours_overrun"
        | "low_margin_project"
        | "employee_overload"
        | "unused_capacity"
        | "no_followup"
        | "postponed_task"
        | "marketing_inactive"
        | "low_sales_activity"
        | "bottleneck"
        | "opportunity"
      blindspot_urgency: "critical" | "high" | "medium" | "low"
      ceo_report_period: "daily" | "weekly" | "monthly"
      planner_category:
        | "deep_work"
        | "meetings"
        | "admin"
        | "creative"
        | "calls"
        | "learning"
        | "personal"
        | "breaks"
      planner_energy: "low" | "medium" | "high"
      planner_goal_horizon:
        | "annual"
        | "quarterly"
        | "monthly"
        | "weekly"
        | "daily"
      planner_insight_severity: "info" | "warn" | "risk" | "opportunity"
      planner_item_type:
        | "task"
        | "reminder"
        | "project"
        | "idea"
        | "note"
        | "purchase"
        | "event"
        | "client"
        | "finance"
        | "unknown"
      planner_priority: "low" | "medium" | "high" | "urgent"
      planner_task_status:
        | "backlog"
        | "scheduled"
        | "in_progress"
        | "done"
        | "postponed"
        | "cancelled"
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
      blindspot_category: [
        "client_at_risk",
        "revenue_concentration",
        "cash_risk",
        "late_invoice",
        "project_hours_overrun",
        "low_margin_project",
        "employee_overload",
        "unused_capacity",
        "no_followup",
        "postponed_task",
        "marketing_inactive",
        "low_sales_activity",
        "bottleneck",
        "opportunity",
      ],
      blindspot_urgency: ["critical", "high", "medium", "low"],
      ceo_report_period: ["daily", "weekly", "monthly"],
      planner_category: [
        "deep_work",
        "meetings",
        "admin",
        "creative",
        "calls",
        "learning",
        "personal",
        "breaks",
      ],
      planner_energy: ["low", "medium", "high"],
      planner_goal_horizon: [
        "annual",
        "quarterly",
        "monthly",
        "weekly",
        "daily",
      ],
      planner_insight_severity: ["info", "warn", "risk", "opportunity"],
      planner_item_type: [
        "task",
        "reminder",
        "project",
        "idea",
        "note",
        "purchase",
        "event",
        "client",
        "finance",
        "unknown",
      ],
      planner_priority: ["low", "medium", "high", "urgent"],
      planner_task_status: [
        "backlog",
        "scheduled",
        "in_progress",
        "done",
        "postponed",
        "cancelled",
      ],
    },
  },
} as const
