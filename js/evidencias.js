import { storage } from './firebase-config.js';
import {
    ref, uploadBytes, getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js';

export async function uploadEvidence(appId, moduloId, matrizId, casoId, file) {
    if (!file) return null;

    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type)) {
        await Swal.fire('Archivo no permitido', 'Solo imágenes y PDF.', 'warning');
        return null;
    }

    const path = `evidencias/${appId}/${moduloId}/${matrizId}/${casoId}/${file.name}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);

    Swal.fire('✅ Evidencia subida', file.name, 'success');
    return url;
}
