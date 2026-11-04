-- Fictional demo catalog. Fixed UUIDs and ordering keep fresh databases repeatable.
INSERT INTO sample_location (id, label, city, latitude, longitude, in_coverage, display_order, active) VALUES
    ('10000000-0000-0000-0000-000000000001', 'Santa Clara Central — demo location', 'Santa Clara', 37.3541, -121.9552, true, 1, true),
    ('10000000-0000-0000-0000-000000000002', 'Downtown San Jose — demo location', 'San Jose', 37.3382, -121.8863, true, 2, true),
    ('10000000-0000-0000-0000-000000000003', 'North San Jose — demo location', 'San Jose', 37.3894, -121.9302, true, 3, true),
    ('10000000-0000-0000-0000-000000000004', 'San Francisco — outside demo coverage', 'San Francisco', 37.7749, -122.4194, false, 4, true);

-- Santa Clara Central has nearby, direct-only, and beyond-six-mile examples.
INSERT INTO restaurant (id, slug, name, city, cuisine, latitude, longitude, description, active) VALUES
    ('20000000-0000-0000-0000-000000000001', 'orchard-bowl-kitchen', 'Orchard Bowl Kitchen', 'Santa Clara', 'California bowls', 37.3541, -121.9552, 'Bright grain bowls and seasonal sides.', true),
    ('20000000-0000-0000-0000-000000000002', 'willow-noodle-house', 'Willow Noodle House', 'Santa Clara', 'Noodles', 37.365, -121.975, 'Comforting noodle bowls with fresh vegetables.', true),
    ('20000000-0000-0000-0000-000000000003', 'cedar-flatbread-table', 'Cedar Flatbread Table', 'Santa Clara', 'Mediterranean', 37.337, -121.984, 'Warm flatbreads and colorful mezze.', true),
    ('20000000-0000-0000-0000-000000000004', 'sunstone-taco-corner', 'Sunstone Taco Corner', 'San Jose', 'Mexican', 37.333, -121.89, 'Fresh tacos and comforting street-food sides.', true),
    ('20000000-0000-0000-0000-000000000005', 'juniper-curry-room', 'Juniper Curry Room', 'San Jose', 'Indian', 37.347, -121.864, 'Small-batch curries and fragrant rice.', true),
    ('20000000-0000-0000-0000-000000000006', 'meadow-burger-studio', 'Meadow Burger Studio', 'San Jose', 'Burgers', 37.27, -121.84, 'Classic burgers with crisp vegetable sides.', true);

INSERT INTO menu_category (id, restaurant_id, name, display_order, active) VALUES
    ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Mains', 1, true),
    ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Sides', 2, true),
    ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000002', 'Noodle bowls', 1, true),
    ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Small plates', 2, true),
    ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000003', 'Flatbreads', 1, true),
    ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'Mezze', 2, true),
    ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004', 'Taco plates', 1, true),
    ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000004', 'Sides', 2, true),
    ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000005', 'Curries', 1, true),
    ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000005', 'Accompaniments', 2, true),
    ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000006', 'Burgers', 1, true),
    ('30000000-0000-0000-0000-000000000012', '20000000-0000-0000-0000-000000000006', 'Sides', 2, true);

INSERT INTO menu_item (id, category_id, name, description, price_cents, image_reference, display_order, active) VALUES
    ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'Citrus Chicken Bowl', 'Grilled chicken, citrus slaw, and herb dressing.', 1450, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'Roasted Vegetable Bowl', 'Seasonal vegetables with lemon tahini.', 1350, NULL, 2, true),
    ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'Crispy Potatoes', 'Roasted potatoes with paprika.', 550, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000002', 'Cucumber Salad', 'Cucumber, herbs, and rice vinegar.', 500, NULL, 2, true),
    ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000003', 'Ginger Chicken Noodles', 'Chicken, ginger broth, and greens.', 1550, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000003', 'Mushroom Noodles', 'Mushrooms, scallions, and savory broth.', 1450, NULL, 2, true),
    ('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000004', 'Vegetable Dumplings', 'Steamed dumplings with sesame dip.', 650, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000004', 'Sesame Greens', 'Blanched greens with sesame dressing.', 500, NULL, 2, true),
    ('40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000005', 'Lemon Chicken Flatbread', 'Chicken, greens, and yogurt sauce.', 1400, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000005', 'Chickpea Flatbread', 'Spiced chickpeas, tomato, and herbs.', 1300, NULL, 2, true),
    ('40000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000006', 'Hummus and Pita', 'Creamy chickpea dip with warm pita.', 650, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000006', 'Carrot Mezze', 'Roasted carrots with cumin.', 550, NULL, 2, true),
    ('40000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000007', 'Citrus Chicken Tacos', 'Three chicken tacos with cabbage slaw.', 1500, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000007', 'Black Bean Tacos', 'Three bean tacos with pico de gallo.', 1250, NULL, 2, true),
    ('40000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000008', 'Chips and Salsa', 'Crisp tortilla chips with tomato salsa.', 450, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-000000000008', 'Lime Rice', 'Steamed rice with lime and cilantro.', 400, NULL, 2, true),
    ('40000000-0000-0000-0000-000000000017', '30000000-0000-0000-0000-000000000009', 'Tomato Chicken Curry', 'Chicken in a fragrant tomato sauce.', 1650, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000018', '30000000-0000-0000-0000-000000000009', 'Golden Lentil Curry', 'Slow-simmered lentils with turmeric.', 1400, NULL, 2, true),
    ('40000000-0000-0000-0000-000000000019', '30000000-0000-0000-0000-000000000010', 'Garlic Flatbread', 'Warm flatbread brushed with garlic.', 450, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000020', '30000000-0000-0000-0000-000000000010', 'Cucumber Raita', 'Cooling yogurt with cucumber.', 400, NULL, 2, true),
    ('40000000-0000-0000-0000-000000000021', '30000000-0000-0000-0000-000000000011', 'House Beef Burger', 'Beef patty, lettuce, tomato, and house sauce.', 1550, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000022', '30000000-0000-0000-0000-000000000011', 'Garden Bean Burger', 'Bean patty, crunchy slaw, and herb sauce.', 1400, NULL, 2, true),
    ('40000000-0000-0000-0000-000000000023', '30000000-0000-0000-0000-000000000012', 'Seasoned Fries', 'Crispy fries with sea salt.', 500, NULL, 1, true),
    ('40000000-0000-0000-0000-000000000024', '30000000-0000-0000-0000-000000000012', 'Garden Slaw', 'Cabbage and carrots in a tangy dressing.', 450, NULL, 2, true);

INSERT INTO modifier_group (id, menu_item_id, name, min_selections, max_selections, display_order, active) VALUES
    ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'Choose your base', 1, 1, 1, true),
    ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', 'Optional extras', 0, 2, 1, true),
    ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000005', 'Choose your base', 1, 1, 1, true),
    ('50000000-0000-0000-0000-000000000004', '40000000-0000-0000-0000-000000000006', 'Optional extras', 0, 2, 1, true),
    ('50000000-0000-0000-0000-000000000005', '40000000-0000-0000-0000-000000000009', 'Choose your base', 1, 1, 1, true),
    ('50000000-0000-0000-0000-000000000006', '40000000-0000-0000-0000-000000000010', 'Optional extras', 0, 2, 1, true),
    ('50000000-0000-0000-0000-000000000007', '40000000-0000-0000-0000-000000000013', 'Choose your base', 1, 1, 1, true),
    ('50000000-0000-0000-0000-000000000008', '40000000-0000-0000-0000-000000000014', 'Optional extras', 0, 2, 1, true),
    ('50000000-0000-0000-0000-000000000009', '40000000-0000-0000-0000-000000000017', 'Choose your base', 1, 1, 1, true),
    ('50000000-0000-0000-0000-000000000010', '40000000-0000-0000-0000-000000000018', 'Optional extras', 0, 2, 1, true),
    ('50000000-0000-0000-0000-000000000011', '40000000-0000-0000-0000-000000000021', 'Choose your base', 1, 1, 1, true),
    ('50000000-0000-0000-0000-000000000012', '40000000-0000-0000-0000-000000000022', 'Optional extras', 0, 2, 1, true);

INSERT INTO modifier_option (id, modifier_group_id, label, price_delta_cents, display_order, active) VALUES
    ('60000000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', 'Brown rice', 0, 1, true),
    ('60000000-0000-0000-0000-000000000002', '50000000-0000-0000-0000-000000000001', 'Quinoa', 0, 2, true),
    ('60000000-0000-0000-0000-000000000003', '50000000-0000-0000-0000-000000000002', 'Avocado', 200, 1, true),
    ('60000000-0000-0000-0000-000000000004', '50000000-0000-0000-0000-000000000002', 'Roasted seeds', 100, 2, true),
    ('60000000-0000-0000-0000-000000000005', '50000000-0000-0000-0000-000000000003', 'Wheat noodles', 0, 1, true),
    ('60000000-0000-0000-0000-000000000006', '50000000-0000-0000-0000-000000000003', 'Rice noodles', 0, 2, true),
    ('60000000-0000-0000-0000-000000000007', '50000000-0000-0000-0000-000000000004', 'Soft egg', 150, 1, true),
    ('60000000-0000-0000-0000-000000000008', '50000000-0000-0000-0000-000000000004', 'Extra mushrooms', 200, 2, true),
    ('60000000-0000-0000-0000-000000000009', '50000000-0000-0000-0000-000000000005', 'Classic pita', 0, 1, true),
    ('60000000-0000-0000-0000-000000000010', '50000000-0000-0000-0000-000000000005', 'Whole wheat pita', 0, 2, true),
    ('60000000-0000-0000-0000-000000000011', '50000000-0000-0000-0000-000000000006', 'Feta', 150, 1, true),
    ('60000000-0000-0000-0000-000000000012', '50000000-0000-0000-0000-000000000006', 'Olives', 100, 2, true),
    ('60000000-0000-0000-0000-000000000013', '50000000-0000-0000-0000-000000000007', 'Corn tortillas', 0, 1, true),
    ('60000000-0000-0000-0000-000000000014', '50000000-0000-0000-0000-000000000007', 'Flour tortillas', 0, 2, true),
    ('60000000-0000-0000-0000-000000000015', '50000000-0000-0000-0000-000000000008', 'Guacamole', 250, 1, true),
    ('60000000-0000-0000-0000-000000000016', '50000000-0000-0000-0000-000000000008', 'Pickled onion', 100, 2, true),
    ('60000000-0000-0000-0000-000000000017', '50000000-0000-0000-0000-000000000009', 'Basmati rice', 0, 1, true),
    ('60000000-0000-0000-0000-000000000018', '50000000-0000-0000-0000-000000000009', 'Brown rice', 0, 2, true),
    ('60000000-0000-0000-0000-000000000019', '50000000-0000-0000-0000-000000000010', 'Extra vegetables', 200, 1, true),
    ('60000000-0000-0000-0000-000000000020', '50000000-0000-0000-0000-000000000010', 'Crispy onions', 100, 2, true),
    ('60000000-0000-0000-0000-000000000021', '50000000-0000-0000-0000-000000000011', 'Brioche bun', 0, 1, true),
    ('60000000-0000-0000-0000-000000000022', '50000000-0000-0000-0000-000000000011', 'Sesame bun', 0, 2, true),
    ('60000000-0000-0000-0000-000000000023', '50000000-0000-0000-0000-000000000012', 'Cheddar', 150, 1, true),
    ('60000000-0000-0000-0000-000000000024', '50000000-0000-0000-0000-000000000012', 'Avocado', 200, 2, true);

INSERT INTO fee_policy (id, label, restaurant_commission_basis_points, service_fee_basis_points, service_fee_cap_cents, grouped_delivery_fee_cents, direct_surcharge_cents, grouped_max_distance_miles, direct_max_distance_miles, demo_tax_basis_points, demo, active) VALUES
    ('70000000-0000-0000-0000-000000000001', 'Demo pricing — estimated tax, USD', 1200, 500, 300, 699, 450, 4, 6, 900, true, true);
