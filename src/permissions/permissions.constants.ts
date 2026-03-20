export interface PermissionDefinition {
  key: string;
  label: string;
  module: string;
}

export const ALL_PERMISSIONS = [
  // Leads
  { key: 'leads:view', label: 'View Leads', module: 'Leads' },
  { key: 'leads:create', label: 'Create Leads', module: 'Leads' },
  { key: 'leads:edit', label: 'Edit Leads', module: 'Leads' },
  { key: 'leads:delete', label: 'Delete Leads', module: 'Leads' },
  { key: 'leads:analyze', label: 'Analyze Leads (AI)', module: 'Leads' },

  // Clients
  { key: 'clients:view', label: 'View Clients', module: 'Clients' },
  { key: 'clients:create', label: 'Create Clients', module: 'Clients' },
  { key: 'clients:edit', label: 'Edit Clients', module: 'Clients' },
  { key: 'clients:delete', label: 'Delete Clients', module: 'Clients' },
  { key: 'clients:health', label: 'Health Reports (AI)', module: 'Clients' },
  { key: 'clients:upsell', label: 'Upsell Strategy (AI)', module: 'Clients' },
  { key: 'clients:convert', label: 'Convert Leads to Clients', module: 'Clients' },

  // Projects
  { key: 'projects:view', label: 'View Projects', module: 'Projects' },
  { key: 'projects:create', label: 'Create Projects', module: 'Projects' },
  { key: 'projects:edit', label: 'Edit Projects', module: 'Projects' },
  { key: 'projects:delete', label: 'Delete Projects', module: 'Projects' },

  // Costs
  { key: 'costs:view', label: 'View Cost Logs', module: 'Costs' },
  { key: 'costs:create', label: 'Create Cost Logs', module: 'Costs' },
  { key: 'costs:delete', label: 'Delete Cost Logs', module: 'Costs' },

  // Teams
  { key: 'teams:view', label: 'View Teams', module: 'Teams' },
  { key: 'teams:create', label: 'Create Teams', module: 'Teams' },
  { key: 'teams:edit', label: 'Edit Teams', module: 'Teams' },
  { key: 'teams:delete', label: 'Delete Teams', module: 'Teams' },
  { key: 'teams:manage_members', label: 'Manage Team Members', module: 'Teams' },

  // Users
  { key: 'users:view', label: 'View Users', module: 'Users' },
  { key: 'users:create', label: 'Create Users', module: 'Users' },
  { key: 'users:edit', label: 'Edit Users', module: 'Users' },
  { key: 'users:delete', label: 'Delete Users', module: 'Users' },

  // AI Settings
  { key: 'ai_settings:view', label: 'View AI Settings', module: 'AI Settings' },
  { key: 'ai_settings:edit', label: 'Edit AI Settings', module: 'AI Settings' },

  // Audit Logs
  { key: 'audit_logs:view', label: 'View Audit Logs', module: 'Audit Logs' },

  // Permissions
  { key: 'permissions:view', label: 'View Permissions', module: 'Permissions' },
  { key: 'permissions:edit', label: 'Edit Permissions', module: 'Permissions' },

  // Pipeline
  { key: 'pipeline:manage', label: 'Manage Pipeline Stages', module: 'Pipeline' },

  // Reports
  { key: 'reports:view', label: 'View Reports', module: 'Reports' },
  { key: 'reports:export', label: 'Export Reports', module: 'Reports' },

  // Settings
  { key: 'settings:manage', label: 'Manage Settings (Service Types etc.)', module: 'Settings' },

  // Tasks
  { key: 'tasks:read', label: 'View Tasks', module: 'Tasks' },
  { key: 'tasks:create', label: 'Create Tasks', module: 'Tasks' },
  { key: 'tasks:edit', label: 'Edit Tasks', module: 'Tasks' },
  { key: 'tasks:delete', label: 'Delete Tasks', module: 'Tasks' },
  { key: 'tasks:view_all', label: 'View All Tasks (Team View)', module: 'Tasks' },

  // Notifications
  { key: 'notifications:view', label: 'View Notifications', module: 'Notifications' },

  // Contacts
  { key: 'contacts:read', label: 'View Contacts', module: 'Contacts' },
  { key: 'contacts:create', label: 'Create Contacts', module: 'Contacts' },
  { key: 'contacts:edit', label: 'Edit Contacts', module: 'Contacts' },
  { key: 'contacts:delete', label: 'Delete Contacts', module: 'Contacts' },

  // Service Items
  { key: 'service_items:read', label: 'View Service Items', module: 'Service Items' },
  { key: 'service_items:manage', label: 'Manage Service Items', module: 'Service Items' },

  // Quotes
  { key: 'quotes:read', label: 'View Quotes', module: 'Quotes' },
  { key: 'quotes:create', label: 'Create Quotes', module: 'Quotes' },
  { key: 'quotes:edit', label: 'Edit Quotes', module: 'Quotes' },
  { key: 'quotes:delete', label: 'Delete Quotes', module: 'Quotes' },
  { key: 'quotes:send', label: 'Send Quotes', module: 'Quotes' },

  // Time Tracking
  { key: 'time_tracking:read', label: 'View Time Entries', module: 'Time Tracking' },
  { key: 'time_tracking:create', label: 'Log Time', module: 'Time Tracking' },
  { key: 'time_tracking:edit_own', label: 'Edit Own Time Entries', module: 'Time Tracking' },
  { key: 'time_tracking:edit_all', label: 'Edit All Time Entries', module: 'Time Tracking' },

  // Analytics & Custom Fields
  { key: 'analytics:view', label: 'View Analytics', module: 'Analytics' },
  { key: 'analytics:ai', label: 'AI Analytics Reports', module: 'Analytics' },
  { key: 'custom_fields:read', label: 'View Custom Fields', module: 'Custom Fields' },
  { key: 'custom_fields:manage', label: 'Manage Custom Fields', module: 'Custom Fields' },

  // Workflows
  { key: 'workflows:view', label: 'View Workflows', module: 'Workflows' },
  { key: 'workflows:create', label: 'Create Workflows', module: 'Workflows' },
  { key: 'workflows:edit', label: 'Edit Workflows', module: 'Workflows' },
  { key: 'workflows:delete', label: 'Delete Workflows', module: 'Workflows' },

  // Forms
  { key: 'forms:read', label: 'View Forms', module: 'Forms' },
  { key: 'forms:create', label: 'Create Forms', module: 'Forms' },
  { key: 'forms:edit', label: 'Edit Forms', module: 'Forms' },
  { key: 'forms:delete', label: 'Delete Forms', module: 'Forms' },
] as const satisfies PermissionDefinition[];

export type PermissionKey = (typeof ALL_PERMISSIONS)[number]['key'];

// Default permissions matching current hardcoded behavior
export const DEFAULT_ROLE_PERMISSIONS: Record<string, PermissionKey[]> = {
  CEO: ALL_PERMISSIONS.map((p) => p.key), // CEO gets everything
  ADMIN: [
    'leads:view', 'leads:create', 'leads:edit', 'leads:delete', 'leads:analyze',
    'clients:view', 'clients:create', 'clients:edit', 'clients:delete', 'clients:health', 'clients:upsell', 'clients:convert',
    'projects:view', 'projects:create', 'projects:edit', 'projects:delete',
    'costs:view', 'costs:create', 'costs:delete',
    'teams:view', 'teams:create', 'teams:edit', 'teams:delete', 'teams:manage_members',
    'users:view', 'users:create', 'users:edit', 'users:delete',
    'ai_settings:view', 'ai_settings:edit',
    'audit_logs:view',
    'permissions:view',
    'pipeline:manage',
    'reports:view', 'reports:export',
    'settings:manage',
    'tasks:read', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:view_all',
    'notifications:view',
    'contacts:read', 'contacts:create', 'contacts:edit', 'contacts:delete',
    'service_items:read', 'service_items:manage',
    'quotes:read', 'quotes:create', 'quotes:edit', 'quotes:delete', 'quotes:send',
    'time_tracking:read', 'time_tracking:create', 'time_tracking:edit_own', 'time_tracking:edit_all',
    'workflows:view', 'workflows:create', 'workflows:edit', 'workflows:delete',
    'forms:read', 'forms:create', 'forms:edit', 'forms:delete',
  ],
  BDM: [
    'leads:view', 'leads:create', 'leads:edit', 'leads:analyze',
    'clients:view', 'clients:create', 'clients:edit', 'clients:health', 'clients:upsell', 'clients:convert',
    'projects:view', 'projects:create', 'projects:edit',
    'teams:view', 'teams:manage_members',
    'users:view', 'users:create', 'users:edit',
    'reports:view', 'reports:export',
    'ai_settings:view',
    'tasks:read', 'tasks:create', 'tasks:edit', 'tasks:delete', 'tasks:view_all',
    'notifications:view',
    'contacts:read', 'contacts:create', 'contacts:edit', 'contacts:delete',
    'service_items:read',
    'quotes:read', 'quotes:create', 'quotes:edit', 'quotes:send',
    'time_tracking:read', 'time_tracking:create', 'time_tracking:edit_own', 'time_tracking:edit_all',
  ],
  SALES: [
    'leads:view', 'leads:create', 'leads:edit', 'leads:analyze',
    'clients:view', 'clients:create', 'clients:edit', 'clients:health', 'clients:upsell', 'clients:convert',
    'projects:view', 'projects:create', 'projects:edit',
    'teams:view',
    'reports:view',
    'ai_settings:view',
    'tasks:read', 'tasks:create', 'tasks:edit', 'tasks:delete',
    'notifications:view',
    'contacts:read', 'contacts:create', 'contacts:edit',
    'service_items:read',
    'quotes:read', 'quotes:create', 'quotes:edit', 'quotes:send',
    'time_tracking:read', 'time_tracking:create', 'time_tracking:edit_own',
  ],
  DESIGNER: [
    'leads:view', 'leads:edit',
    'projects:view',
    'ai_settings:view',
    'tasks:read', 'tasks:create', 'tasks:edit',
    'notifications:view',
    'contacts:read',
    'service_items:read',
    'quotes:read',
    'time_tracking:read', 'time_tracking:create', 'time_tracking:edit_own',
  ],
  QS: [
    'leads:view',
    'projects:view', 'projects:edit',
    'costs:view', 'costs:create', 'costs:delete',
    'ai_settings:view',
    'tasks:read', 'tasks:create', 'tasks:edit',
    'notifications:view',
    'contacts:read',
    'service_items:read',
    'quotes:read',
    'time_tracking:read', 'time_tracking:create', 'time_tracking:edit_own',
  ],
};
