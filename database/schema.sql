create table customers
(
    customer_id   int auto_increment
        primary key,
    customer_name varchar(150) not null,
    contact_phone varchar(20)  null,
    email         varchar(100) null
);

create table products
(
    product_id   int auto_increment
        primary key,
    product_name varchar(150)                 not null,
    category     enum ('Suiting', 'Shirting') not null,
    base_price   decimal(10, 2)               not null
);

create table quotations
(
    quotation_id int auto_increment
        primary key,
    customer_id  int                                        null,
    total_amount decimal(15, 2) default 0.00                null,
    created_at   timestamp      default current_timestamp() null,
    constraint quotations_ibfk_1
        foreign key (customer_id) references customers (customer_id)
);

create table quotation_items
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

create index product_id
    on quotation_items (product_id);

create index quotation_id
    on quotation_items (quotation_id);

create index customer_id
    on quotations (customer_id);

