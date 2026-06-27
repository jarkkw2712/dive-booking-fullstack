
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
