DELETE FROM role_permissions
WHERE permission IN ('dashboard:view', 'dashboard:edit');
