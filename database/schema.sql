create table if not exists users
(
    user_id    int auto_increment
        primary key,
    username   varchar(50)             not null unique,
    password   varchar(100)            not null,
    email      varchar(150)            null,
    role       enum ('admin', 'user')  not null default 'user',
    created_at timestamp               default current_timestamp()
);

-- Insert default admin
INSERT IGNORE INTO users (username, password, role) VALUES ('admin', 'ktimpex', 'admin');

create table if not exists customers
(
    customer_id   int auto_increment
        primary key,
    customer_name varchar(150) not null,
    contact_phone varchar(20)  null,
    email         varchar(100) null
);

create table if not exists products
(
    product_id   int auto_increment
        primary key,
    product_name varchar(150)   not null,
    category     varchar(50)    not null,
    base_price   decimal(10, 2) not null
);

create table if not exists quotations
(
    quotation_id   int auto_increment
        primary key,
    customer_id    int                                             null,
    user_id        int                                             null,
    total_amount   decimal(15, 2)  default 0.00                   null,
    status         enum ('pending','accepted','declined') not null default 'pending',
    decline_reason varchar(500)                                    null,
    created_at     timestamp       default current_timestamp()     null,
    constraint quotations_ibfk_1
        foreign key (customer_id) references customers (customer_id),
    constraint fk_quot_user
        foreign key (user_id) references users (user_id) on delete set null
);

create table if not exists quotation_items
(
    item_id            int auto_increment
        primary key,
    quotation_id       int            null,
    product_id         int            null,
    quantity           decimal(10, 2) null,
    unit_price_at_time decimal(10, 2) null,
    constraint quotation_items_ibfk_1
        foreign key (quotation_id) references quotations (quotation_id),
    constraint quotation_items_ibfk_2
        foreign key (product_id) references products (product_id)
);

create index if not exists product_id
    on quotation_items (product_id);

create index if not exists quotation_id
    on quotation_items (quotation_id);

create index if not exists customer_id
    on quotations (customer_id);

create index if not exists user_id
    on quotations (user_id);
