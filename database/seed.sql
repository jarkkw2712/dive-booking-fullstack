
insert into app_roles(role_id, role_name) values
('admin','Admin / Owner'),('counter','Counter'),('island_staff','Island Staff'),('boat_crew','Boat Crew'),('management','Management')
on conflict(role_id) do update set role_name=excluded.role_name;

insert into app_users(username, display_name, role_id, active_flag) values
('admin','Admin Owner','admin',true),
('counter','Counter Staff','counter',true),
('island','Island Staff','island_staff',true),
('boat','Boat Crew','boat_crew',true),
('manager','Management','management',true)
on conflict(username) do update set display_name=excluded.display_name, role_id=excluded.role_id, active_flag=excluded.active_flag;

insert into master_programs(program_id, program_name, default_price, sort_order) values
('boat_ticket','ตั๋วเรือ',1500,1),('one_day','One Day Trip',2500,2),('two_day','2 Day 1 Night',4500,3),('three_day','3 Day 2 Night',6500,4)
on conflict(program_id) do update set program_name=excluded.program_name, default_price=excluded.default_price;

insert into master_addons(addon_id, addon_name, default_price, sort_order) values
('fin','Fin',150,1),('mask','หน้ากากดำน้ำ',150,2),('life_jacket','ชูชีพ',100,3),('tent','เต็นท์',800,4),('other','อื่นๆ',0,99)
on conflict(addon_id) do update set addon_name=excluded.addon_name, default_price=excluded.default_price;

insert into role_permissions(role_id, permission_key, allowed) values
('admin','createBooking',true),('admin','editBooking',true),('admin','cancelBooking',true),('admin','printDailyReport',true),
('counter','createBooking',true),('counter','editBooking',true),('counter','cancelBooking',false),('counter','printDailyReport',false),
('island_staff','createBooking',false),('island_staff','editBooking',true),('island_staff','cancelBooking',false),('island_staff','printDailyReport',false),
('boat_crew','createBooking',false),('boat_crew','editBooking',false),('boat_crew','cancelBooking',false),('boat_crew','printDailyReport',false),
('management','createBooking',false),('management','editBooking',false),('management','cancelBooking',false),('management','printDailyReport',true)
on conflict(role_id, permission_key) do update set allowed=excluded.allowed;


insert into role_permissions(role_id, permission_key, allowed) values
('admin','editPermissions',true),
('admin','systemAdmin',true),
('admin','editMasterData',true),
('admin','addIslandAddOn',true),
('admin','printReceipt',true),
('admin','printCounterReport',true),
('admin','printBoatReport',true),
('admin','viewAudit',true),
('admin','viewMoney',true),
('counter','editPermissions',false),
('counter','systemAdmin',false),
('counter','editMasterData',false),
('counter','addIslandAddOn',false),
('counter','printReceipt',true),
('counter','printCounterReport',true),
('counter','printBoatReport',false),
('counter','viewAudit',false),
('counter','viewMoney',true),
('island_staff','editPermissions',false),
('island_staff','systemAdmin',false),
('island_staff','editMasterData',false),
('island_staff','addIslandAddOn',true),
('island_staff','printReceipt',false),
('island_staff','printCounterReport',false),
('island_staff','printBoatReport',false),
('island_staff','viewAudit',false),
('island_staff','viewMoney',true),
('boat_crew','editPermissions',false),
('boat_crew','systemAdmin',false),
('boat_crew','editMasterData',false),
('boat_crew','addIslandAddOn',false),
('boat_crew','printReceipt',false),
('boat_crew','printCounterReport',false),
('boat_crew','printBoatReport',true),
('boat_crew','viewAudit',false),
('boat_crew','viewMoney',false),
('management','editPermissions',false),
('management','systemAdmin',false),
('management','editMasterData',false),
('management','addIslandAddOn',false),
('management','printReceipt',false),
('management','printCounterReport',true),
('management','printBoatReport',true),
('management','viewAudit',true),
('management','viewMoney',true)
on conflict(role_id, permission_key) do update set allowed=excluded.allowed;


insert into company_profile (
  profile_id, company_name, tax_id, address, phone, email, website,
  line_oa, facebook, logo_url, bank_name, bank_account, bank_account_name, promptpay
) values (
  'default', 'Dive Tour Company', '-', 'Phuket, Thailand', '081-000-0000', '', '',
  '', '', '', '', '', '', ''
)
on conflict (profile_id) do nothing;


insert into master_agents (agent_id, agent_name, description, sort_order) values
('direct', 'Direct Customer', 'ลูกค้าตรง', 1),
('facebook', 'Facebook', 'ลูกค้าจาก Facebook', 2),
('executive', 'Executive Special', 'ราคาพิเศษผู้บริหาร', 3)
on conflict (agent_id) do update set agent_name=excluded.agent_name, description=excluded.description, sort_order=excluded.sort_order;

insert into master_boats (boat_id, boat_name, description, sort_order) values
('boat_1', 'Boat 1', '', 1),
('boat_2', 'Boat 2', '', 2)
on conflict (boat_id) do update set boat_name=excluded.boat_name, description=excluded.description, sort_order=excluded.sort_order;

insert into master_islands (island_id, island_name, description, sort_order) values
('unspecified', 'ไม่ระบุ', '', 1),
('mai_ngam', 'อ่าวไม้งาม', '', 2),
('chong_khad', 'อ่าวช่องขาด', '', 3)
on conflict (island_id) do update set island_name=excluded.island_name, description=excluded.description, sort_order=excluded.sort_order;

insert into master_price_reasons (reason_id, reason_name, description, sort_order) values
('default', 'ราคา Default', '', 1),
('executive', 'ผู้บริหารอนุมัติ', '', 2),
('agent_contract', 'ราคา Agent Contract', '', 3),
('other', 'อื่นๆ', '', 99)
on conflict (reason_id) do update set reason_name=excluded.reason_name, description=excluded.description, sort_order=excluded.sort_order;

insert into master_payment_methods (method_id, method_name, description, sort_order) values
('cash', 'เงินสด', '', 1),
('bank_transfer', 'โอนผ่านธนาคาร', '', 2)
on conflict (method_id) do update set method_name=excluded.method_name, description=excluded.description, sort_order=excluded.sort_order;

insert into master_statuses (status_id, status_name, description, sort_order) values
('pending', 'pending', 'รอคอนเฟิร์ม', 1),
('confirmed', 'confirmed', 'ยืนยันแล้ว', 2),
('checked-in', 'checked-in', 'เช็คอินแล้ว', 3),
('completed', 'completed', 'จบงานแล้ว', 4),
('cancelled', 'cancelled', 'ยกเลิก', 5)
on conflict (status_id) do update set status_name=excluded.status_name, description=excluded.description, sort_order=excluded.sort_order;


-- Sprint 1.5 roles
insert into app_roles (role_id, role_name) values
('finance', 'Finance'),
('ceo', 'CEO')
on conflict (role_id) do update set role_name=excluded.role_name;

-- Sprint 1.5 manageUsers permission and expanded role permissions
insert into role_permissions (role_id, permission_key, allowed) values
('admin', 'manageUsers', true),
('finance', 'createBooking', false),
('finance', 'editBooking', false),
('finance', 'cancelBooking', false),
('finance', 'editMasterData', false),
('finance', 'editPermissions', false),
('finance', 'systemAdmin', false),
('finance', 'addIslandAddOn', false),
('finance', 'printReceipt', true),
('finance', 'printCounterReport', true),
('finance', 'printBoatReport', false),
('finance', 'printDailyReport', true),
('finance', 'viewAudit', true),
('finance', 'viewMoney', true),
('finance', 'manageUsers', false),
('ceo', 'createBooking', false),
('ceo', 'editBooking', false),
('ceo', 'cancelBooking', false),
('ceo', 'editMasterData', false),
('ceo', 'editPermissions', false),
('ceo', 'systemAdmin', false),
('ceo', 'addIslandAddOn', false),
('ceo', 'printReceipt', false),
('ceo', 'printCounterReport', true),
('ceo', 'printBoatReport', true),
('ceo', 'printDailyReport', true),
('ceo', 'viewAudit', true),
('ceo', 'viewMoney', true),
('ceo', 'manageUsers', false)
on conflict (role_id, permission_key) do update set allowed=excluded.allowed, updated_at=now();
