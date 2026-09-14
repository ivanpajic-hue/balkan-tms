/* BALKAN TMS — core/config.js
   Konfiguracija: Supabase, tabele
   Modul generisan iz monolita v3.0 (A0.2). */
const KEY='balkan_tms_v1'; // ključ starog lokalnog prototipa (koristi se samo za jednokratnu migraciju)
const SB_URL='https://ygkxuuumbzsanyatylet.supabase.co';
const SB_ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlna3h1dXVtYnpzYW55YXR5bGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNDAxMDMsImV4cCI6MjA5ODcxNjEwM30.ljEVQm40Du9qn7f2vZds1ps5uyFMZFaabUPcNEDYiWA';
const SB_TABLES=['companies','clients','transport_orders','order_vehicles','trips','trip_stops','trip_orders',
  'drivers','fleet_vehicles','fleet_documents','driver_documents','expenses','invoices','invoice_items',
  'payments','driver_settlements','settlement_items','bonuses_maluses','service_orders','audit_logs',
  'expense_categories','purchase_invoices','settlement_item_types','fleet_doc_types','driver_doc_types',
  'countries','settings','order_statuses','order_doc_types'];
const TRANSACTIONAL=['clients','transport_orders','order_vehicles','trips','trip_stops','trip_orders','drivers',
  'fleet_vehicles','fleet_documents','driver_documents','expenses','invoices','invoice_items','payments',
  'driver_settlements','settlement_items','bonuses_maluses','service_orders','purchase_invoices','audit_logs'];

export {
  KEY,
  SB_URL,
  SB_ANON,
  SB_TABLES,
  TRANSACTIONAL
};
