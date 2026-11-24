/** Station (tenant) permission catalogue and the default system roles every new station gets (spec 5.1). */

export const PERMISSIONS: Array<[string, string]> = [
  ['workers.create', 'Add workers'], ['workers.update', 'Edit workers'], ['workers.deactivate', 'Deactivate workers'],
  ['workers.view', 'View workers'], ['workers.face.enroll', 'Enroll / reset worker face'],
  ['branches.manage', 'Manage branches and geofences'],
  ['attendance.checkin', 'Check in / out'], ['attendance.view', 'View attendance'], ['attendance.correct', 'Correct attendance'],
  ['orders.create', 'Create orders, add items, checkout'], ['orders.view', 'View orders'], ['orders.cancel', 'Cancel orders'],
  ['customers.view', 'View customers'], ['customers.create', 'Create / update customers'], ['customers.delete', 'Delete / merge customers'],
  ['catalog.manage', 'Manage services and prices'], ['tax.manage', 'Manage tax rates'],
  ['payments.record', 'Record payments'], ['payments.view', 'View payments'], ['finance.correct', 'Corrections / refunds'],
  ['reports.operations', 'Operations reports'], ['reports.finance', 'Finance reports'],
  ['data.import', 'Excel import'], ['data.export', 'Excel export'], ['roles.manage', 'Manage roles'],
  ['audit.view', 'View audit log'], ['settings.manage', 'Station settings'], ['support_access.grant', 'Grant support access'],
];

export const ROLE_PERMS: Record<string, string[]> = {
  owner: PERMISSIONS.map(([code]) => code),
  branch_manager: ['workers.view', 'workers.update', 'attendance.checkin', 'attendance.view', 'attendance.correct',
    'orders.create', 'orders.view', 'orders.cancel', 'customers.view', 'customers.create', 'payments.record', 'reports.operations'],
  worker: ['attendance.checkin', 'orders.create', 'orders.view', 'customers.view', 'customers.create', 'payments.record'],
  accountant: ['workers.view', 'orders.view', 'customers.view', 'payments.view', 'reports.finance', 'data.import', 'data.export', 'audit.view'],
};
