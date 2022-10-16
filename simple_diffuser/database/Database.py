#!/bin/python
from dataclasses import dataclass
import sqlite3 as sql
import os
import traceback
from typing import Optional
import datetime

# create table User (
#     id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
#     public_id INTEGER NOT NULL,
#     name varchar(255) not null,
#     is_admin boolean not null default false
# );
# create table GenImage (
#     id INTEGER PRIMARY KEY AUTOINCREMENT not null ,
#     parent_id INT,
#     user_id INT not null,
#     seed INT,
#     number_of_iterations INT not null,
#     number_of_iterations_done INT,
#     create_date datetime not null,

#     history_chain TEXT not null,
#     [desc] TEXT not null,
#     path_on_disc varchar(1024) not null,
#     ref_path_on_disc varchar(1024),

#     foreign key (parent_id) references GenImage(id) on delete no action on update no action,
#     foreign key (user_id) references User(id) on delete no action on update no action
# );
# create table GenImagePublicId (
#     id INTEGER PRIMARY KEY AUTOINCREMENT not null,
#     gen_image_id INT not null,
#     public_id INT not null,
#     foreign key (gen_image_id) references GenImage(id) on delete no action on update no action
# );

USER_TABLE_NAME = "User"
GEN_IMAGE_TABLE_NAME = "GenImage"
GEN_IMAGE_PUBLIC_ID_TABLE_NAME = "GenImagePublicId"


@dataclass
class User:
    id: int
    public_id: int
    name: str
    is_admin: bool
@dataclass
class GenImage:
    id: int
    parent_id: Optional[int]
    user_id: int
    seed: Optional[int]
    number_of_iterations: int
    number_of_iterations_done: int
    create_date: int
    history_chain: str
    desc: str
    path_on_disc: str
    ref_path_on_disc: Optional[str]
@dataclass
class GenImagePublicId:
    id: int
    gen_image_id: int
    public_id: int

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
            self.seed_database()
    def count_table(self, table_name: str) -> int:
        with sql.connect(self.db_path) as con:
            return con.execute("select count(*) from " + table_name).fetchone()[0]
    def get_user(self, public_id: int) -> User:
        with sql.connect(self.db_path) as con:
            usr_tupple = con.execute("select id, public_id, name, is_admin from User where public_id = ?", (public_id,)).fetchone()
            return User(*usr_tupple) if usr_tupple != None else None
    def get_all_users(self) -> list[User]:
        with sql.connect(self.db_path) as con:
            user_tuppls = con.execute("select * from User").fetchall()
            return [User(*user_tupple) for user_tupple in user_tuppls]
    def get_gen_image(self, public_user_id: int, gen_image_id: int) -> GenImage:
        with sql.connect(self.db_path) as con:
            if public_user_id != None:
                user = con.execute("select id, is_admin from User where public_id = ?", (public_user_id,)).fetchone()
                if (user == None):
                    return None
                img = con.execute("select * from GenImage where id = ? and (user_id = ? or ?)", (gen_image_id, user[0], user[1])).fetchone()
                if (img != None):
                    return GenImage(*img)
            pubImg = con.execute("select * from GenImagePublicId where public_id = ?", (gen_image_id, )).fetchone()
            if (pubImg == None):
                return None
            img_tupple = con.execute("select * from GenImage where id = ?", (pubImg.gen_image_id,)).fetchone()
            return GenImage(*img_tupple) if img_tupple != None else None
    def get_leaf_images(self, public_id: int) -> list[GenImage]:
        with sql.connect(self.db_path) as con:
            user = con.execute("select id from User where public_id = ?", (public_id,)).fetchone()
            if (user == None):
                return None
            img_tuppls = con.execute("select * from GenImage where user_id = ? and id not in (select parent_id from GenImage)", (user[0],)).fetchall()
            return [GenImage(*img_tupple) for img_tupple in img_tuppls]
    def get_last_images_before(self, public_id: int, count: int, before: int) -> list[GenImage]:
        with sql.connect(self.db_path) as con:
            user = con.execute("select id, is_admin from User where public_id = ?", (public_id,)).fetchone()
            if (user == None):
                return None
            img_tuppls = con.execute("select * from GenImage where (user_id = ? or ?) and id < ? order by id desc limit ?", (user[0], user[1], before, count)).fetchall()
            return [GenImage(*img_tupple) for img_tupple in img_tuppls]
    def get_image_status(self, public_id: int, gen_image_id: int) -> Optional[int]:
        with sql.connect(self.db_path) as con:
            user = con.execute("select id, is_admin from User where public_id = ?", (public_id,)).fetchone()
            if (user == None):
                return None
            img = con.execute("select number_of_iterations_done, number_of_iterations from GenImage where id = ? and (user_id = ? or ?)", (gen_image_id, user[0], user[1])).fetchone()
            if (img == None):
                return None
            return int((1 + img[0]) / (1 + img[1]) * 100)
    def get_image_status_by_id(self, gen_image_id: int) -> Optional[int]:
        with sql.connect(self.db_path) as con:
            img = con.execute("select number_of_iterations_done, number_of_iterations from GenImage where id = ?", (gen_image_id,)).fetchone()
            if (img == None):
                return None
            return int((1 + img[0]) / (1 + img[1]) * 100)
    def create_user(self, name: str) -> Optional[User]:
        with sql.connect(self.db_path) as con:
            user_tuple = con.execute("insert into User (public_id, name, is_admin) values (random(), ?, false) returning *", (name, )).fetchone()
            return User(*user_tuple)
    def create_gen_image(self,
        parent_id: Optional[int],
        public_user_id: int,
        seed: Optional[int],
        number_of_iterations: int,
        number_of_iterations_done: int,
        desc: str,
        path_on_disc: str) -> GenImage:
        t = datetime.datetime.now()
        create_date = int(t.timestamp() / 1000)
        history_chain = ""
        ref_path_on_disc = None
        with sql.connect(self.db_path) as con:
            user = con.execute("select Id from User where public_id = ?", (public_user_id,)).fetchone()
            if (user == None):
                return None
            if (parent_id != None):
                parent = con.execute("select Id, history_chain, ref_path_on_disc from GenImage where id = ? and user_id = ?", (parent_id, user[0])).fetchone()
                if (parent == None):
                    return None
                history_chain = f"{parent[1]},{parent[0]}" if parent[1] != "" else f"{parent[0]}"
                ref_path_on_disc = parent[2]
            inserted_id = con.execute("""
            insert into GenImage (parent_id, user_id, seed, number_of_iterations, number_of_iterations_done, create_date, history_chain, [desc], path_on_disc, ref_path_on_disc)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            returning *
            """,
                (parent_id, user[0], seed, number_of_iterations, number_of_iterations_done, create_date, history_chain, desc, path_on_disc, ref_path_on_disc)).fetchone()
            return GenImage(*inserted_id)
    def create_image_public_id(self, user_public_id: int, gen_image_id: int) -> GenImagePublicId:
        with sql.connect(self.db_path) as con:
            user = con.execute("select id from User where public_id = ?", (user_public_id,)).fetchone()
            if (user == None):
                return None
            img = con.execute("select id from GenImage where id = ? and user_id = ?", (gen_image_id, user[0])).fetchone()
            if (img == None):
                return None
            inserted_id = con.execute("insert into GenImagePublicId (gen_image_id, public_id) values (?, random()) returning *", (gen_image_id, )).fetchone()
            return GenImagePublicId(*inserted_id)
    def delete_user(self, public_id: int) -> bool:
        self.delete_user_images(public_id)
        with sql.connect(self.db_path) as con:
            user = con.execute("select id from User where public_id = ?", (public_id,)).fetchone()
            if (user == None):
                return False
            con.execute("delete from User where id = ?", (user[0],))
            return True
    def delete_user_images(self, public_id: int):
        self.delete_public_imgs_by_user(public_id)
        with sql.connect(self.db_path) as con:
            user = con.execute("select id from User where public_id = ?", (public_id,)).fetchone()
            if (user == None):
                return False
            con.execute("delete from GenImage where user_id = ?", (user[0],))
            return True
    def delete_public_imgs_by_user(self, public_id: int):
        with sql.connect(self.db_path) as con:
            user = con.execute("select id from User where public_id = ?", (public_id,)).fetchone()
            if (user == None):
                return False
            con.execute("delete from GenImagePublicId where gen_image_id in (select id from GenImage where user_id = ?)", (user[0],))
            return True
    def delete_gen_image(self, public_user_id: int, gen_image_id: int) -> bool:
        with sql.connect(self.db_path) as con:
            user = con.execute("select * from User where public_id = ?", (public_user_id,)).fetchone()
            if (user == None):
                return False
            img = con.execute("select * from GenImage where id = ? and user_id = ?", (gen_image_id, user.Id)).fetchone()
            if (img == None):
                return False
            con.execute("delete from GenImage where id = ?", (gen_image_id,))
            return True
    def delete_db_file(self):
        os.remove(self.db_path)
    def seed_database(self):
        user = self.create_user('admin')
        with sql.connect(self.db_path) as con:
            con.execute("update User set is_admin = true where id = ?", (user.id,))
        img = self.create_gen_image(None, user.public_id, 0, 0, 0, 'This is a default inital image', "astronaut_rides_horse.png")
        self.create_image_public_id(user.public_id, img.id)


def create_random_db():
    timestamp = int(datetime.datetime.now().timestamp())
    db = Database(f"simple_diffuser/database/test_{timestamp}.sqlite", "simple_diffuser/database/create.sql")
    return db

def test_seed_data(db: Database):
    assert db.count_table(USER_TABLE_NAME) == 1, "There should be one user in the database"
    assert db.count_table(GEN_IMAGE_TABLE_NAME) == 1, "There should be one image in the database"
    assert db.count_table(GEN_IMAGE_PUBLIC_ID_TABLE_NAME) == 1, "There should be one public id in the database"
    user = db.get_all_users()
    db.delete_user(user[0].public_id)
    assert db.count_table(USER_TABLE_NAME) == 0, "There should be zero users in the database"
    assert db.count_table(GEN_IMAGE_TABLE_NAME) == 0, "There should be zero images in the database"
    assert db.count_table(GEN_IMAGE_PUBLIC_ID_TABLE_NAME) == 0, "There should be zero public ids in the database"



def basic_test(db: Database):
    usr = db.get_all_users()[0]
    og_img = db.get_last_images_before(usr.public_id, 1, 100000)
    assert len(og_img) == 1, "There should be one image"
    img = db.create_gen_image(og_img[0].id, usr.public_id, 0, 0, 0, "This is a test", "test.png")
    assert img != None, "The image should not be null"
    assert img.history_chain == f"{og_img[0].id}", "History chain should be the id of the og imgage"
    img2 = db.create_gen_image(img.id, usr.public_id, 0, 0, 0, "This is a test", "test.png")
    assert img2 != None, "The image should not be null"
    assert img2.history_chain == f"{og_img[0].id},{img.id}", "History chain should be the id of the og imgage"

def test_image_getting(db: Database):
    admin_usr = db.get_all_users()[0]
    usr = db.create_user("test1")
    usr2 = db.create_user("test2")
    img = db.create_gen_image(None, usr.public_id, 0, 0, 0, "This is a test", "test.png")
    img_usr = db.get_gen_image(usr.public_id, img.id)
    assert img_usr != None, "The image should not be null"
    img_usr2 = db.get_gen_image(usr2.public_id, img.id)
    assert img_usr2 == None, "The image should be null"
    img_usr_admin = db.get_gen_image(admin_usr.public_id, img.id)
    assert img_usr_admin != None, "The image should not be null"

    usr_images = db.get_last_images_before(usr.public_id, 10, 100000)
    assert len(usr_images) == 1, "Usr should have one image"

    usr2_images = db.get_last_images_before(usr2.public_id, 10, 100000)
    assert len(usr2_images) == 0, "Usr2 should have zero images"

    admin_images = db.get_last_images_before(admin_usr.public_id, 10, 100000)
    assert len(admin_images) == 2, "Admin should have two images"



def run_test(test_func):
    db = create_random_db()
    success = False
    try:
        test_func(db)
        success = True
    except Exception as e:
        stacktrace = traceback.format_exc()
        print(e, stacktrace)
    finally:
        db.delete_db_file()
        return success


if __name__ == "__main__":
    assert run_test(test_seed_data), "TEST `test_seed_data` FAILED!!!"
    assert run_test(basic_test), "TEST `basic_test` FAILED!!!"
    assert run_test(test_image_getting), "TEST `test_image_getting` FAILED!!!"






