CREATE TABLE restaurant (
    id uuid PRIMARY KEY,
    slug varchar(100) NOT NULL UNIQUE,
    name varchar(160) NOT NULL,
    description varchar(500) NOT NULL,
    city varchar(80) NOT NULL,
    cuisine varchar(80) NOT NULL,
    latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    active boolean NOT NULL
);

CREATE TABLE menu_category (
    id uuid PRIMARY KEY,
    restaurant_id uuid NOT NULL REFERENCES restaurant(id),
    name varchar(120) NOT NULL,
    display_order integer NOT NULL CHECK (display_order >= 0),
    active boolean NOT NULL
);

CREATE TABLE menu_item (
    id uuid PRIMARY KEY,
    category_id uuid NOT NULL REFERENCES menu_category(id),
    name varchar(160) NOT NULL,
    description varchar(500) NOT NULL,
    price_cents integer NOT NULL CHECK (price_cents >= 0),
    image_reference varchar(255),
    display_order integer NOT NULL CHECK (display_order >= 0),
    active boolean NOT NULL
);

CREATE TABLE modifier_group (
    id uuid PRIMARY KEY,
    menu_item_id uuid NOT NULL REFERENCES menu_item(id),
    name varchar(120) NOT NULL,
    min_selections integer NOT NULL CHECK (min_selections >= 0),
    max_selections integer NOT NULL CHECK (max_selections >= min_selections),
    display_order integer NOT NULL CHECK (display_order >= 0),
    active boolean NOT NULL
);

CREATE TABLE modifier_option (
    id uuid PRIMARY KEY,
    modifier_group_id uuid NOT NULL REFERENCES modifier_group(id),
    label varchar(120) NOT NULL,
    price_delta_cents integer NOT NULL CHECK (price_delta_cents >= 0),
    display_order integer NOT NULL CHECK (display_order >= 0),
    active boolean NOT NULL
);

CREATE TABLE sample_location (
    id uuid PRIMARY KEY,
    label varchar(160) NOT NULL,
    city varchar(80) NOT NULL,
    latitude double precision NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    in_coverage boolean NOT NULL,
    display_order integer NOT NULL CHECK (display_order >= 0),
    active boolean NOT NULL
);

CREATE TABLE fee_policy (
    id uuid PRIMARY KEY,
    label varchar(160) NOT NULL,
    restaurant_commission_basis_points integer NOT NULL CHECK (restaurant_commission_basis_points BETWEEN 0 AND 10000),
    service_fee_basis_points integer NOT NULL CHECK (service_fee_basis_points BETWEEN 0 AND 10000),
    service_fee_cap_cents integer NOT NULL CHECK (service_fee_cap_cents >= 0),
    grouped_delivery_fee_cents integer NOT NULL CHECK (grouped_delivery_fee_cents >= 0),
    direct_surcharge_cents integer NOT NULL CHECK (direct_surcharge_cents >= 0),
    grouped_max_distance_miles double precision NOT NULL CHECK (grouped_max_distance_miles > 0 AND grouped_max_distance_miles < 'Infinity'::double precision),
    direct_max_distance_miles double precision NOT NULL CHECK (direct_max_distance_miles >= grouped_max_distance_miles AND direct_max_distance_miles < 'Infinity'::double precision),
    demo_tax_basis_points integer NOT NULL CHECK (demo_tax_basis_points BETWEEN 0 AND 10000),
    demo boolean NOT NULL,
    active boolean NOT NULL
);

CREATE UNIQUE INDEX fee_policy_one_active ON fee_policy (active) WHERE active;
CREATE INDEX menu_category_restaurant ON menu_category (restaurant_id, display_order, id);
CREATE INDEX menu_item_category ON menu_item (category_id, display_order, id);
CREATE INDEX modifier_group_item ON modifier_group (menu_item_id, display_order, id);
CREATE INDEX modifier_option_group ON modifier_option (modifier_group_id, display_order, id);
