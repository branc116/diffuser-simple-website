--sqlite3
create table User (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    public_id INTEGER NOT NULL UNIQUE,
    name varchar(255) not null,
    is_admin boolean not null default false
);
create table GenImage (
    id INTEGER PRIMARY KEY AUTOINCREMENT not null,
    parent_id INT,
    user_id INT not null,
    seed INT,
    number_of_iterations INT not null,
    number_of_iterations_done INT,
    create_date datetime not null,

    history_chain TEXT not null,
    [desc] TEXT not null,
    path_on_disc varchar(1024) not null,
    ref_path_on_disc varchar(1024),


    foreign key (parent_id) references GenImage(id) on delete no action on update no action,
    foreign key (user_id) references User(id) on delete no action on update no action
);
create table GenImagePublicId (
    id INTEGER PRIMARY KEY AUTOINCREMENT not null,
    gen_image_id INT not null,
    public_id INT not null UNIQUE,
    foreign key (gen_image_id) references GenImage(id) on delete no action on update no action
);
