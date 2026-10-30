import {Directory, Filesystem} from "@capacitor/filesystem";
import {Share} from "@capacitor/share";

window.saveNativeFile = async (blob, filename) => {
  const uri = await writeCacheFile(blob, filename);
  await Share.share({title: filename, url: uri, dialogTitle: "Save or share your file"});
};

window.shareNativeSlides = async files => {
  const uris = await Promise.all(files.map(file =>
    writeCacheFile(base64ToBlob(file.b64), file.name)));
  await Share.share({files: uris, title: "Instagram carousel", dialogTitle: "Share carousel slides"});
};

function base64ToBlob(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes]);
}

async function writeCacheFile(blob, filename) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Could not read the file."));
    reader.readAsDataURL(blob);
  });
  const data = String(dataUrl).split(",")[1];
  if (!data) throw new Error("Could not encode the file for sharing.");
  const {uri} = await Filesystem.writeFile({path: filename, data, directory: Directory.Cache});
  return uri;
}
