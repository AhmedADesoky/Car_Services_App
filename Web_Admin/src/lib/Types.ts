/** Shapes returned by the Admin API (see Backend/src/Platform). */

export interface Station_Request {
  id: string; status: string; plan_code: string; business_name: string; business_name_ar: string | null; contact_name: string;
  contact_phone: string; contact_email: string | null; city: string | null; branches_count: number; workers_count: number;
  locale: string; created_at: string; reviewed_at: string | null; reviewed_by_name: string | null; tenant_id: string | null;
  message?: string | null; review_note?: string | null;
}

export interface Station_Row {
  id: string; station_code: string; display_name: string; legal_name: string; status: string; plan: string; country: string;
  currency: string; created_at: string; active_users: number; invited_users: number; devices: number; plate_scans_month: number;
}

export interface Station_Detail {
  station: {
    id: string; station_code: string; display_name: string; legal_name: string; tax_reg_no: string | null; country: string; currency: string;
    time_zone: string; default_locale: string; status: string; plan_code: string; plan_name: string; plan_limits: Record<string, unknown>;
    contact_name: string | null; contact_phone: string | null; contact_email: string | null; created_at: string;
    deletion_scheduled_at: string | null; source_request_id: string | null;
  };
  counts: { active_users: number; invited_users: number; devices: number } | null;
  ownerInvitation: { created_at: string; expires_at: string; used_at: string | null; revoked_at: string | null; username: string; display_name: string; owner_status: string } | null;
}

export interface Plan { code: string; name: string; limits: Record<string, unknown>; price_monthly: string; currency: string; is_active: boolean; stations: number }

export interface Staff { id: string; email: string; full_name: string; status: string; mfa_enabled: boolean; last_login_at: string | null; created_at: string; department_id: string | null; department: string | null; roles: { id: string; name: string }[] }

export interface Role { id: string; name: string; description: string | null; is_system: boolean; permissions: string[]; members: number }

export interface Permission { code: string; category: string; description: string }

export interface Department { id: string; name: string; description: string | null; members: number }

export interface Audit_Row { seq: string; actor_email: string | null; action: string; target_type: string; target_id: string | null; tenant_id: string | null; details: Record<string, unknown>; ip: string | null; at: string }
