-- SliceMatic — menu seed data (EXACT items from stage2-gradio/menu/*.txt).
-- Run AFTER schema.sql. Idempotent: re-running updates name/price/active.

-- Bases (Types_of_Base.txt)
insert into menus (id, category, name, price, is_active) values
  ('B1', 'base', 'Thin Crust',   149, true),
  ('B2', 'base', 'Thick Crust',  179, true),
  ('B3', 'base', 'Cheese Burst', 229, true),
  ('B4', 'base', 'Whole Wheat',  159, true),
  ('B5', 'base', 'Multigrain',   169, true)
on conflict (id) do update
  set category = excluded.category,
      name     = excluded.name,
      price    = excluded.price,
      is_active = excluded.is_active;

-- Pizzas (Types_of_Pizza.txt)
insert into menus (id, category, name, price, is_active) values
  ('P1', 'pizza', 'Margherita',          299, true),
  ('P2', 'pizza', 'Chicago Deep Dish',   349, true),
  ('P3', 'pizza', 'Greek Mediterranean', 329, true),
  ('P4', 'pizza', 'California Veggie',    339, true),
  ('P5', 'pizza', 'Farm House',          319, true),
  ('P6', 'pizza', 'Pepperoni Classic',   369, true),
  ('P7', 'pizza', 'BBQ Chicken',         379, true),
  ('P8', 'pizza', 'Paneer Tikka',        349, true)
on conflict (id) do update
  set category = excluded.category,
      name     = excluded.name,
      price    = excluded.price,
      is_active = excluded.is_active;

-- Toppings (Types_of_Toppings.txt)
insert into menus (id, category, name, price, is_active) values
  ('T1',  'topping', 'Black Olives',       49, true),
  ('T2',  'topping', 'Extra Cheese',       69, true),
  ('T3',  'topping', 'Button Mushrooms',   49, true),
  ('T4',  'topping', 'Green Peppers',      39, true),
  ('T5',  'topping', 'Jalapenos',          39, true),
  ('T6',  'topping', 'Sun-Dried Tomatoes', 59, true),
  ('T7',  'topping', 'Caramelised Onions', 49, true),
  ('T8',  'topping', 'Sweet Corn',         39, true),
  ('T9',  'topping', 'Roasted Garlic',     49, true),
  ('T10', 'topping', 'Peri-Peri Drizzle',  59, true)
on conflict (id) do update
  set category = excluded.category,
      name     = excluded.name,
      price    = excluded.price,
      is_active = excluded.is_active;
