#!/bin/python
from dataclasses import dataclass
import sqlite3 as sql
import os
from typing import Optional
import datetime

from pydantic import DateTimeError

# create table User (
#     id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
#     public_id INTEGER NOT NULL,
#     name varchar(255) not null
# );
# create table GenImage (
#     id INTEGER PRIMARY KEY AUTOINCREMENT not null ,
#     parent_id INT,
#     user_id INT not null,
#     seed INT,
#     number_of_iterations INT not null,
#     create_date datetime not null,

#     history_chain TEXT not null,
#     [desc] TEXT not null,
#     path_on_disc varchar(1024) not null,
#     ref_path_on_disc varchar(1024),


#     foreign key (parent_id) references GenImage(id) on delete no action on update no action,
#     foreign key (user_id) references User(id) on delete no action on update no action
# );

@dataclass
class User:
    id: int
    public_id: int
    name: str
@dataclass
class GenImage:
    id: int
    parent_id: Optional[int]
    user_id: int
    seed: Optional[int]
    number_of_iterations: int
    create_date: int
    history_chain: str
    desc: str
    path_on_disc: str
    ref_path_on_disc: Optional[str]

class Database:
    def __init__(self, db_path, create_script_path):
        self.db_path = db_path
        self.create_script_path = create_script_path
        if not os.path.exists(db_path):
            self.create_database()
    def create_database(self):
        with open(self.create_script_path, "r") as create_script:
            with sql.connect(self.db_path) as con:
                con.executescript(create_script.read())
    def get_user(self, public_id: int) -> User:
        with sql.connect(self.db_path) as con:
            return con.execute("select * from User where public_id = ?", (public_id,)).fetchone()
    def get_gen_image(self, public_user_id: int, gen_image_id: int) -> GenImage:
        with sql.connect(self.db_path) as con:
            user = con.execute("select * from User where public_id = ?", (public_user_id,)).fetchone()
            if (user == None):
                return None
            return con.execute("select * from GenImage where id = ? and userId = ?", (gen_image_id, user.Id)).fetchone()
    def get_leaf_images(self, public_id: int) -> list[GenImage]:
        with sql.connect(self.db_path) as con:
            user = con.execute("select * from User where public_id = ?", (public_id,)).fetchone()
            if (user == None):
                return None
            return con.execute("select * from GenImage where user_id = ? and id not in (select parent_id from GenImage)", (user.id,)).fetchall()
    def get_last_images_before(self, public_id: int, count: int, before: int) -> list[GenImage]:
        with sql.connect(self.db_path) as con:
            user = con.execute("select * from User where public_id = ?", (public_id,)).fetchone()
            if (user == None):
                return None
            return con.execute("select * from GenImage where user_id = ? and id < ? order by id desc limit ?", (user.id, before, count)).fetchall()
    def create_user(self, public_id: int, name: str) -> User:
        with sql.connect(self.db_path) as con:
            con.execute("insert into User (public_id, name) values (?, ?)", (public_id, name))
            return con.execute("select * from User where public_id = ?", (public_id,)).fetchone()
    def create_gen_image(self,
        parent_id: Optional[int],
        public_user_id: int,
        seed: Optional[int],
        number_of_iterations: int,
        history_chain: str,
        desc: str,
        path_on_disc: str,
        ref_path_on_disc: Optional[str]) -> GenImage:
        t = datetime.datetime.now()
        create_date = int(t.timestamp() / 1000)
        with sql.connect(self.db_path) as con:
            user = con.execute("select Id from User where public_id = ?", (public_user_id,)).fetchone()
            if (user == None):
                return None
            con.execute("insert into GenImage (parent_id, user_id, seed, number_of_iterations, create_date, history_chain, [desc], path_on_disc, ref_path_on_disc) values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (parent_id, user.Id, seed, number_of_iterations, create_date, history_chain, desc, path_on_disc, ref_path_on_disc))
            return con.execute("select * from GenImage where id = ?", (con.execute("select last_insert_rowid()").fetchone()[0],)).fetchone()
if __name__ == "__main__":
    db = Database("test.db", "create.sql")

