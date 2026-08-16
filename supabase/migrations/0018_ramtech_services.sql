-- =====================================================================
-- RCT APPLICATION | Migration 0018 - RAM Computer Technology Services
-- =====================================================================

DO $$ 
DECLARE
  v_default_priority_id uuid;
BEGIN
  -- Get the default priority ID
  SELECT id INTO v_default_priority_id FROM public.priorities WHERE is_default = true LIMIT 1;
  
  IF v_default_priority_id IS NULL THEN
    -- Fallback to the lowest severity priority if no default exists
    SELECT id INTO v_default_priority_id FROM public.priorities ORDER BY severity ASC LIMIT 1;
  END IF;

  -- Insert Core Services from ramtechuae.com
  INSERT INTO public.categories (code, name, description, icon, colour, sort_order, default_priority_id)
  VALUES 
    ('SRV-CCTV', 'CCTV & ELV Solutions', 'IP cameras, access control, intercom & surveillance', 'Video', '#dc2626', 10, v_default_priority_id),
    ('SRV-NET', 'Network & Structured Cabling', 'Cisco, Aruba, fiber optics, LAN/WAN design', 'Network', '#2563eb', 20, v_default_priority_id),
    ('SRV-DC', 'Data Centre Setup & Management', 'Servers, UPS, cooling, rack design & monitoring', 'Server', '#0f172a', 30, v_default_priority_id),
    ('SRV-CYBER', 'Cybersecurity Solutions', 'Fortinet, SonicWall, VPN, Kaspersky, VAPT', 'Shield', '#16a34a', 40, v_default_priority_id),
    ('SRV-AMC', 'AMC – Annual Maintenance', 'SLA-backed maintenance for all IT assets', 'Wrench', '#ea580c', 50, v_default_priority_id),
    ('SRV-MCC', 'MCC Approved – CCTV Compliance', 'Abu Dhabi MCC certified · 100+ clients', 'FileCheck', '#b45309', 60, v_default_priority_id),
    ('SRV-ADHICS', 'ADHICS Audit & Certification', 'Healthcare IT compliance & consultation', 'Activity', '#059669', 70, v_default_priority_id),
    ('SRV-REP', 'Laptop, Desktop & Mac Repair', 'Apple Mac, Windows, all brands – Al Ain', 'Laptop', '#4b5563', 80, v_default_priority_id),
    ('SRV-SALE', 'Sale of Laptops & Desktops', 'Apple, Dell, HP, Lenovo – bulk orders welcome', 'ShoppingCart', '#0284c7', 90, v_default_priority_id),
    ('SRV-GAME', 'Custom Gaming & AI Workstation Builds', 'Gaming rigs, deep learning & multi-GPU AI systems', 'Gamepad2', '#7c3aed', 100, v_default_priority_id),
    ('SRV-WEB', 'Web & App Development', 'Websites, Android, iOS & Windows apps', 'Code', '#db2777', 110, v_default_priority_id),
    ('SRV-SOC', 'Social Media Marketing', 'Instagram, Facebook, LinkedIn & Meta Ads', 'Share2', '#e11d48', 120, v_default_priority_id),
    ('SRV-HOST', 'Email, Domain & Hosting', 'UAE-based servers & business email setup', 'Globe', '#d97706', 130, v_default_priority_id),
    ('SRV-AI', 'AI & ML / DL Solutions', 'Custom AI models, ML pipelines & deep learning', 'Brain', '#0891b2', 140, v_default_priority_id),
    ('SRV-3CX', '3CX Call Centre & VoIP', 'Cloud & on-premise PBX, call routing & IVR', 'Phone', '#0284c7', 150, v_default_priority_id),
    ('SRV-AV', 'AV — Audio & Video Solutions', 'Bosch, Bose, JBL & more — supply & installation', 'Speaker', '#475569', 160, v_default_priority_id)
  ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description;

END $$;
