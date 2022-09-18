#this will swapn a simple website that on get requests returns form and on post request returns image
from fileinput import filename
import http.server
from typing import BinaryIO
from PIL import Image
from io import BytesIO
import base64
import urllib.parse
import datetime
import os
import numpy as np

file_extension_to_mime_type: dict[str, str] = {
    "html": 'text/html',
    "css": 'text/css',
    "js": 'text/javascript',
    "png": 'image/png',
    "jpg": 'image/jpeg',
    "gif": 'image/gif',
    "glsl": "text/plain"
}

class GenImageRequest:
    def __init__(self, bs: bytes):
        self.previous_image = int.from_bytes(bs[:4], "little")
        self.user_id = int.from_bytes(bs[4:8], "little")
        self.number_of_iterations = int.from_bytes(bs[8:12], "little")
        self.image_size = int.from_bytes(bs[12:16], "little")
        if (self.image_size == 0xFFFFFFFF):
            self.image_size = 0
            self.image_bytes = None
        else:
            self.image_bytes = bs[16:(self.image_size + 16)]
        self.prompt = bs[(self.image_size + 16):].decode("utf-8")
    def image_to_np(self) -> np.array:
        if (self.image_bytes is None):
            return None
        ii = Image.open(BytesIO(self.image_bytes))
        ii.save("test.png")
        c = np.array(ii) # (512, 512, 3)
        return c

    

def write_form(file: BinaryIO, value: str):
    file.write(b"""\
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Generate</title>
</head>
<body>
    <form method="POST" action="">
        <input type="textbox" name="message" value='""" + value.encode("UTF-8") + b"""' >
        <input type="submit" value="Submit">
    </form>
""")


def list_old_images(file: BinaryIO):
    file.write(b"<h1>Images</h1>")
    file.write(b"<ul>")
    for image in sorted(os.listdir("imgs")):
        file.write(b"<li><a href='imgs/" +  urllib.parse.quote(image).encode("UTF-8") + b"'>")
        file.write(image.encode("UTF-8") + b"</a></li>")
    file.write(b"</ul>")
def get_newest_modify_date_recursivly(path: str) -> float:
    newest_modify_date = 0.0
    for file in os.listdir(path):
        file_path = os.path.join(path, file)
        if os.path.isdir(file_path):
            newest_modify_date = max(newest_modify_date, get_newest_modify_date_recursivly(file_path))
        else:
            newest_modify_date = max(newest_modify_date,  os.path.getmtime(file_path) * 1000)
    return newest_modify_date
class CreateImage:
    def __init__(self):
        import torch
        from torch import autocast
        from diffusers2.src.diffusers import StableDiffusionPipeline
        self.autocast = autocast

        torch.cuda.memory_stats()["max_split_size"] = 2**30
        model_id = "CompVis/stable-diffusion-v1-4"
        device = "cuda"
        pipe = StableDiffusionPipeline.from_pretrained(model_id, revision="fp16", torch_dtype=torch.float16, use_auth_token=True)
        self.pipe = pipe.to(device)
    def prompt(self, promp, imaz, number_of_iterations) -> BytesIO:
        with self.autocast("cuda"):
            image : Image  = self.pipe(promp, guidance_scale=7.5, reference_imaz=imaz, num_inference_steps=number_of_iterations)["sample"][0]  
        safe_name = str(datetime.datetime.now()).replace(":", ".").replace(" ", "_") + "".join([x for x in promp if x.isalnum()])[:50]
        image.save("imgs/" + safe_name + ".png")
        buff = BytesIO()
        image.save(buff, format="JPEG", quality=97)
        return buff
class DickButImage:
    def __init__(self) -> None:
        with open("imgs/dickbut.jpeg", "rb") as f:
            self.img = BytesIO(f.read())
    def prompt(self, promp, imaz, number_of_iterations):
        return self.img

print("Starting server")
img_create = CreateImage()
print("Started server")
imageId = 69
class WebSite(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        route = self.path.split("/")
        if route == "":
            self.path = "/index.html"
            self.handle_static_file()
        elif route[0] == "imgs":
            self.handle_imgs(route[1])
        elif route[0] == "favicon.ico":
            self.send_error(404, "File not found")
        elif self.path.strip("/") == "last-modified":
            self.send_response(200)
            self.send_header('Content-type', 'text/plain')
            self.end_headers()
            self.wfile.write(str(get_newest_modify_date_recursivly("www")).encode())
        else:
            self.handle_static_file()

    def do_POST(self):
        
        #read form data
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        d = GenImageRequest(post_data)
        img_base = img_create.prompt(d.prompt, d.image_to_np(), d.number_of_iterations).getbuffer()
        
        self.send_response(200)
        self.send_header('Content-type', 'application/octet-stream')
        self.send_header('Content-length', len(img_base) + 4)
        self.end_headers()
        self.wfile.write(imageId.to_bytes(4, "little"))
        self.wfile.write(img_base)
        
    def handle_root(self):
        write_form(self.wfile, "")
        list_old_images(self.wfile)
    def handle_imgs(self, img_name):
        file_name = self.path.lstrip("/")
        
        if (file_name not in os.listdir("imgs")):
            self.send_error(404, "File not found")
            return
        self.send_response(200)
        self.send_header('Content-type', 'image/png')
        self.end_headers()
        self.wfile.write(b'<img src="data:image/png;base64,')
        with open("imgs/" + file_name, "rb") as img_file:
            self.wfile.write(base64.b64encode(img_file.read()))
        self.wfile.write(b'"/>')
    def handle_static_file(self):
        file_name = "www/" + self.path.lstrip("/")
        if (not os.path.exists(file_name)):
            self.send_error(404, "File not found")
            return
        file_extension = file_name.split(".")[-1]
        if (file_extension in file_extension_to_mime_type):
            self.send_response(200)
            self.send_header('Content-type', file_extension)
            self.end_headers()
        else:
            self.send_error(404, "File not found")
            return
        with open(file_name, "rb") as file:
            self.wfile.write(file.read())

if __name__ == "__main__":
    server_address = ("", 8080)
    httpd = http.server.HTTPServer(server_address, WebSite)
    httpd.serve_forever()