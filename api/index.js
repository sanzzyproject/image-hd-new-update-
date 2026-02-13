const Busboy = require('busboy');
const FormData = require('form-data');
const axios = require('axios');
// Pastikan zencf terinstall atau ada filenya
const { zencf } = require('zencf'); 

const headers = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36',
    'sec-ch-ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
    'sec-ch-ua-mobile': '?1',
    'sec-ch-ua-platform': '"Android"',
    'Accept-Language': 'id-ID,id;q=0.9,en-AU;q=0.8,en;q=0.7,en-US;q=0.6'
};

async function solveTurnstile() {
    // Logika solve turnstile dari kode Anda
    try {
        const { token } = await zencf.turnstileMin('https://picupscaler.com', '0x4AAAAAABvAGhZHOnPwmOvR');
        return token;
    } catch (e) {
        console.error("Turnstile Error:", e);
        throw new Error("Gagal memproses keamanan (Turnstile).");
    }
}

// Helper untuk memproses file upload di Vercel
const parseForm = (req) => {
    return new Promise((resolve, reject) => {
        const busboy = Busboy({ headers: req.headers });
        const result = { file: null, fields: {} };

        busboy.on('file', (fieldname, file, info) => {
            const chunks = [];
            file.on('data', (data) => chunks.push(data));
            file.on('end', () => {
                result.file = {
                    buffer: Buffer.concat(chunks),
                    filename: info.filename,
                    mimeType: info.mimeType
                };
            });
        });

        busboy.on('field', (fieldname, val) => {
            result.fields[fieldname] = val;
        });

        busboy.on('finish', () => resolve(result));
        busboy.on('error', reject);
        
        if (req.rawBody) {
            busboy.end(req.rawBody);
        } else {
            req.pipe(busboy);
        }
    });
};

module.exports = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 1. Parse Uploaded File
        const { file, fields } = await parseForm(req);
        
        if (!file) {
            return res.status(400).json({ error: 'Tidak ada gambar yang diupload.' });
        }

        const scaleVal = fields.scale || '2';
        if (!['2', '4', '8'].includes(scaleVal)) {
            return res.status(400).json({ error: 'Scale harus 2, 4, atau 8.' });
        }

        // 2. Solve Turnstile
        const turnstileToken = await solveTurnstile();

        // 3. Prepare Form Data untuk API PicUpscaler
        const form = new FormData();
        form.append('image', file.buffer, {
            filename: file.filename,
            contentType: file.mimeType
        });
        form.append('user_id', '');
        form.append('is_public', 'true');
        form.append('turnstile_token', turnstileToken);
        form.append('scale', scaleVal);

        // 4. Hit External API
        const apiResponse = await axios.post('https://picupscaler.com/api/generate/handle', form, {
            headers: {
                ...headers,
                ...form.getHeaders(),
                'origin': 'https://picupscaler.com',
                'referer': 'https://picupscaler.com/',
                'accept': 'application/json, text/plain, */*'
            },
            maxBodyLength: Infinity
        });

        // 5. Return result
        // Asumsi apiResponse.data mengembalikan JSON berisi URL hasil
        return res.status(200).json(apiResponse.data);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ 
            error: error.message || 'Terjadi kesalahan pada server.',
            details: error.response?.data || null
        });
    }
};

// Konfigurasi agar Vercel tidak mem-parse body secara otomatis (karena kita pakai busboy)
export const config = {
    api: {
        bodyParser: false,
    },
};
