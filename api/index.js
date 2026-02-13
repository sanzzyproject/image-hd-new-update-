const Busboy = require('busboy');
const FormData = require('form-data');
const axios = require('axios');
const { zencf } = require('zencf'); 

// 1. Header yang LEBIH LENGKAP agar terlihat seperti browser asli (Android Chrome)
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36';

const commonHeaders = {
    'User-Agent': USER_AGENT,
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://picupscaler.com',
    'Referer': 'https://picupscaler.com/',
    'Sec-Ch-Ua': '"Chromium";v="139", "Not;A=Brand";v="99"',
    'Sec-Ch-Ua-Mobile': '?1',
    'Sec-Ch-Ua-Platform': '"Android"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin', // Penting agar tidak dianggap lintas situs mencurigakan
    'X-Requested-With': 'XMLHttpRequest'
};

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
    // Enable CORS agar bisa dipanggil dari frontend
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        console.log("Menerima request...");
        const { file, fields } = await parseForm(req);
        
        if (!file) {
            return res.status(400).json({ error: 'Tidak ada gambar yang diupload.' });
        }

        const scaleVal = fields.scale || '2';

        // 2. Mendapatkan Token Turnstile
        // NOTE: Pastikan zencf berjalan di lingkungan server yang valid
        console.log("Sedang bypass Turnstile...");
        const { token } = await zencf.turnstileMin('https://picupscaler.com', '0x4AAAAAABvAGhZHOnPwmOvR');

        if (!token) {
            throw new Error("Gagal mendapatkan token Turnstile");
        }
        console.log("Token didapat:", token.substring(0, 15) + "...");

        // 3. Susun FormData
        const form = new FormData();
        form.append('image', file.buffer, {
            filename: file.filename,
            contentType: file.mimeType
        });
        form.append('user_id', '');
        form.append('is_public', 'true');
        form.append('turnstile_token', token);
        form.append('scale', scaleVal);

        // 4. Hit API dengan Header yang digabungkan
        // Penting: Jangan menimpa header form-data boundary
        const requestHeaders = {
            ...commonHeaders,
            ...form.getHeaders()
        };

        console.log("Mengirim ke PicUpscaler...");
        const apiResponse = await axios.post('https://picupscaler.com/api/generate/handle', form, {
            headers: requestHeaders,
            maxBodyLength: Infinity,
            // Tambahkan timeout agar tidak hang
            timeout: 60000 
        });

        console.log("Sukses!");
        return res.status(200).json(apiResponse.data);

    } catch (error) {
        console.error("Error Detail:", error.message);
        
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", error.response.data);
            
            // Jika 403, berarti Cloudflare memblokir IP Vercel
            if (error.response.status === 403) {
                return res.status(403).json({ 
                    error: 'Server target menolak akses (403 Forbidden).', 
                    suggestion: 'IP Vercel mungkin diblokir Cloudflare. Coba jalankan di local/VPS.',
                    details: error.response.data
                });
            }
        }

        return res.status(500).json({ 
            error: 'Gagal memproses gambar.',
            message: error.message
        });
    }
};

export const config = {
    api: {
        bodyParser: false,
    },
};
