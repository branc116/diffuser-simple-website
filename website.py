#this will swapn a simple website that on get requests returns form and on post request returns image
from fileinput import filename
import http.server
from typing import BinaryIO
from PIL.Image import Image
from io import BytesIO
import base64
import urllib.parse
import datetime
import os

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
        file.write(b"<li><a href='" +  urllib.parse.quote(image).encode("UTF-8") + b"'>")
        file.write(image.encode("UTF-8") + b"</a></li>")
    file.write(b"</ul>")

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
    def prompt(self, promp):
        with self.autocast("cuda"):
            image : Image  = self.pipe(promp, guidance_scale=7.5)["sample"][0]  
        safe_name = str(datetime.datetime.now()).replace(":", ".").replace(" ", "_") + "".join([x for x in promp if x.isalnum()])[:50]
        image.save("imgs/" + safe_name + ".png")
        buff = BytesIO()
        image.save(buff, format="JPEG")
        img_str = base64.b64encode(buff.getvalue())
        return img_str
print("Starting server")
img_create = CreateImage()
print("Started server")
class WebSite(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        if self.path.lstrip("/") == "":
            write_form(self.wfile, "")
            list_old_images(self.wfile)
        else:
            file_name = self.path.lstrip("/")
            if (file_name not in os.listdir("imgs")):
                self.send_error(404, "File not found")
                return
            self.wfile.write(b'<img src="data:image/png;base64,')
            with open("imgs/" + file_name, "rb") as img_file:
                self.wfile.write(base64.b64encode(img_file.read()))
            self.wfile.write(b'"/>')
        return

    def do_POST(self):
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()
        #read form data
        content_length = int(self.headers['Content-Length'])
        post_data = self.rfile.read(content_length)
        message = urllib.parse.parse_qs(post_data.decode('utf-8'))["message"][0]
        img_base = img_create.prompt(message)
        write_form(self.wfile, message)
        self.wfile.write(b'<img src="data:image/png;base64,')
        self.wfile.write(img_base)
        self.wfile.write(b'"/>')
    

if __name__ == "__main__":
    server_address = ("", 8080)
    httpd = http.server.HTTPServer(server_address, WebSite)
    httpd.serve_forever()