import http.server
from random import random
import os
from .database import Database



# GET /api/reg?name={userName} <- returns publicId
# GET /api/hist?publicId={publicId}&before={beforeId} <- returns list of max 10 images <imageSize:4B><imageId:4B><imageParentId:4B><imageData:imageSizeB>...
# GET /api/descrtiption?publicId={publicId}&[imageId={imageId}...] <- returns image description <imageDescriptionSize:4B><imageId:4B><imageDescription:imageDescriptionSizeB>...
# GET /api/seed?publicId={publicId}&[imageId={imageId}...] <- returns image seeds <imageId:4B><imageSeed:4B>...
# GET /api/imageStatus?publicId={publicId}&imageId={imageId} <- returns image status <imageId:4B><imageStatus:4B> // imageStatus: -1 - queued, rest: numbers of iterations done

# POST /api/image:
#     req body: <userId:4B><parentImageId:4B><numberOfIterations:4B><imageSize:4B><imageData:imageSizeB><imageDescription:rest>
#              or <userId:4B><parentImageId:4B><numberOfIterations:4B><0xFFFFFFFF><imageDescription:rest> // if no image
#     resp body: <imageId:4B>

# GET /api/image/{userId}/{imageId} <- returns image <imageData:rest>
# GET /api/image/{publicImageImage} <- returns image <imageData:rest>

def api(state: http.server.BaseHTTPRequestHandler):
    db = Database.Database("database.db", "simple_diffuser/database/create.sql")
    rs = [ x for x in state.path.split("/") if x != "" ]
    route = rs[1]
    route, qp = (route, rs[-1].split("?")[-1]) if "?" in rs[-1] else (route, "")
    qp = dict([y for y in [x.split("=") for x in qp.split("&")] if len(y) == 2])
    print("req")
    if route == "reg":
        public_id = int(random() * 2**31)
        user = db.create_user(public_id, qp["name"])
        state.send_response(200)
        state.send_header('Content-type', 'application/octet-stream')
        state.send_header('Content-length', 4)
        state.end_headers()
        state.wfile.write(public_id.to_bytes(4, "little"))
        print(public_id)
    elif route == "hist":
        images = db.get_last_images_before(qp["publicId"], 10, qp["before"])
        state.send_response(200)
        state.send_header('Content-type', 'application/octet-stream')
        state.send_header('Content-length', sum([len(x) for x in images]))
        state.end_headers()
        for image in images:
            state.wfile.write(image)
    elif route == "image":
        print(rs)
        if (len(rs) == 3):
            img = db.get_gen_image(None, int(rs[-1]))
            path = f"imgs/{img.path_on_disc}"
            if os.path.exists(path):
                state.send_response(200)
                state.send_header('Content-type', 'application/octet-stream')
                state.send_header('Content-length', os.path.getsize(path))
                state.end_headers()
                with open(path, "rb") as f:
                    state.wfile.write(f.read())
            else:
                state.send_response(404)
                state.send_header('Content-type', 'text/plain')
                state.send_header('Content-length', 0)
                state.end_headers()
        elif (len(rs) == 4):
            img = db.get_gen_image(int(rs[-2]), int(rs[-1]))
            path = f"imgs/{img.path_on_disc}"
            if os.path.exists(path):
                state.send_response(200)
                state.send_header('Content-type', 'application/octet-stream')
                state.send_header('Content-length', os.path.getsize(path))
                state.end_headers()
                with open(path, "rb") as f:
                    state.wfile.write(f.read())
            else:
                state.send_response(404)
                state.send_header('Content-type', 'text/plain')
                state.send_header('Content-length', 0)
                state.end_headers()

