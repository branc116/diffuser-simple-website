const numberToUint8Array = (number) => {
  const array = new Uint8Array(4);
  array[0] = (number >> 0) & 0xff;
  array[1] = (number >> 8) & 0xff;
  array[2] = (number >> 16) & 0xff;
  array[3] = (number >> 24) & 0xff;
  return array;
};
const uint8ArrayToInt32 = (array) => {
  return array[0] | (array[1] << 8) | (array[2] << 16) | (array[3] << 24);
};
const arrayBufferToInt32 = (arrayBuffer) => {
  return new Uint32Array(arrayBuffer)[0];
};
/*
GET /api/reg?name={userName} <- returns publicId
GET /api/hist?publicId={publicId}&before={beforeId} <- returns list of max 10 images <imageSize:4B><imageId:4B><imageParentId:4B><imageData:imageSizeB>...
GET /api/descrtiption?publicId={publicId}&[imageId={imageId}...] <- returns image description <imageDescriptionSize:4B><imageId:4B><imageDescription:imageDescriptionSizeB>...
GET /api/seed?publicId={publicId}&[imageId={imageId}...] <- returns image seeds <imageId:4B><imageSeed:4B>...
GET /api/imageStatus?publicId={publicId}&imageId={imageId} <- returns image status <imageId:4B><imageStatus:4B> // imageStatus: -1 - queued, rest: numbers of iterations done

POST /api/image:
    req body: <userId:4B><parentImageId:4B><numberOfIterations:4B><imageSize:4B><imageData:imageSizeB><imageDescription:rest>
             or <userId:4B><parentImageId:4B><numberOfIterations:4B><0xFFFFFFFF><imageDescription:rest> // if no image
    resp body: <imageId:4B>

GET /api/image/{userId}/{imageId} <- returns image <imageData:rest>
GET /api/image/{publicImageImage} <- returns image <imageData:rest>
*/
class Api {
  constructor() {
    const userId = localStorage.getItem('userId') || undefined;
    if (userId) {
      this.userId = parseInt(userId);
    }
    this.baseApi =
      location.href
        .split('/')
        .filter((i) => i != 'index.html')
        .join('/') + '/api';
  }
  register = async (userName) => {
    if (this.userId)
      return;
    const res = await fetch(`${this.baseApi}/reg?name=${userName}`);
    const blob = await res.blob();
    const ab = await blob.arrayBuffer();
    this.userId = arrayBufferToInt32(ab);
    localStorage.setItem('userId', `${this.userId}`);
    return this.userId;
  };
  hist = async (publicId, before) => {
    const res = await fetch(`${this.baseApi}/hist?publicId=${publicId}&before=${before}`);
    const blob = await res.blob();
    const ab = await blob.arrayBuffer();
    const images = [];
    let offset = 0;
    while (offset < ab.size) {
      const imageSize = arrayBufferToInt32(ab.slice(offset, offset + 4));
      offset += 4;
      const imageId = arrayBufferToInt32(ab.slice(offset, offset + 4));
      offset += 4;
      const imageParentId = arrayBufferToInt32(ab.slice(offset, offset + 4));
      offset += 4;
      const imageData = blob.slice(offset, offset + imageSize);
      offset += imageSize;
      images.push({ id: imageId, parentId: imageParentId, data: imageData });
    }
    return images;
  };
  description = async (publicId, imageIds) => {
    const res = await fetch(`${this.baseApi}/description?publicId=${publicId}&${imageIds.map((i) => `imageId=${i}`).join('&')}`);
    const blob = await res.blob();
    const ab = await blob.arrayBuffer();
    const descriptions = {};
    let offset = 0;
    while (offset < blob.size) {
      const descriptionSize = arrayBufferToInt32(ab.slice(offset, offset + 4));
      offset += 4;
      const imageId = arrayBufferToInt32(ab.slice(offset, offset + 4));
      offset += 4;
      const imageDescription = await blob.slice(offset, offset + descriptionSize).text();
      offset += descriptionSize;
      descriptions[imageId] = imageDescription;
    }
    return descriptions;
  };
  seed = async (publicId, imageIds) => {
    const res = await fetch(`${this.baseApi}/seed?publicId=${publicId}&${imageIds.map((i) => `imageId=${i}`).join('&')}`);
    const blob = await res.blob();
    const ab = await blob.arrayBuffer();
    const seeds = {};
    let offset = 0;
    while (offset < blob.size) {
      const imageId = arrayBufferToInt32(ab.slice(offset, offset + 4));
      offset += 4;
      const imageSeed = arrayBufferToInt32(ab.slice(offset, offset + 4));
      offset += 4;
      seeds[imageId] = imageSeed;
    }
    return seeds;
  };
  imageStatus = async (publicId, imageId) => {
    const res = await fetch(`${this.baseApi}/imageStatus?publicId=${publicId}&imageId=${imageId}`);
    const blob = await res.blob();
    const ab = await blob.arrayBuffer();
    const imageStatus = blobToInt32(ab.slice(0, 4));
    return imageStatus;
  };
  postImage = async (imageBlob, referenceImageId, description, numberOfIterations) => {
    if (numberOfIterations == 3) numberOfIterations++;

    const blobToSend = imageBlob
      ? new Blob([
          numberToUint8Array(this.userId),
          numberToUint8Array(this.referenceImageId),
          numberToUint8Array(numberOfIterations),
          numberToUint8Array(imageBlob.size),
          imageBlob,
          description,
        ])
      : new Blob([
          numberToUint8Array(this.userId),
          numberToUint8Array(this.referenceImageId),
          numberToUint8Array(numberOfIterations),
          numberToUint8Array(0xffffffff),
          description,
        ]);

    const blobResponse = await fetch('.', {
      method: 'POST',
      body: blobToSend,
      headers: {
        'Content-Type': 'application/octet-stream',
      },
    }).then((resp) => resp.blob()).then(r => r.arrayBuffer());
    const imageId = arrayBufferToInt32(blobResponse);
    return imageId;
  };
  getImage = async (imageId) => {
    const res = await fetch(`${this.baseApi}/image/${this.userId}/${imageId}`);
    const blob = await res.blob();
    return blob;
  }
  getPublicImage = async (publicImageId) => {
    const res = await fetch(`${this.baseApi}/image/${publicImageId}`);
    const blob = await res.blob();
    return blob;
  }
}
