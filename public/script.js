const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('drop-zone');
const previewContainer = document.getElementById('previewContainer');
const previewImg = document.getElementById('previewImg');
const btnRemove = document.getElementById('btnRemove');
const scaleBtns = document.querySelectorAll('.scale-btn');
const btnUpscale = document.getElementById('btnUpscale');
const statusMsg = document.getElementById('statusMsg');
const resultCard = document.getElementById('resultCard');
const resBefore = document.getElementById('resBefore');
const resAfter = document.getElementById('resAfter');
const downloadBtn = document.getElementById('downloadBtn');

let selectedScale = '2';
let selectedFile = null;

// Event Listeners UI
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);

scaleBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        scaleBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedScale = btn.dataset.value;
    });
});

btnRemove.addEventListener('click', () => {
    selectedFile = null;
    fileInput.value = '';
    previewContainer.style.display = 'none';
    dropZone.style.display = 'block';
    btnUpscale.disabled = true;
    resultCard.style.display = 'none';
});

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            // Set source untuk comparison slider bagian 'Before'
            resBefore.src = e.target.result; 
            previewContainer.style.display = 'block';
            dropZone.style.display = 'none';
            btnUpscale.disabled = false;
        };
        reader.readAsDataURL(file);
    }
}

// Logic API Call
btnUpscale.addEventListener('click', async () => {
    if (!selectedFile) return;

    // UI Loading State
    btnUpscale.disabled = true;
    btnUpscale.querySelector('.btn-text').textContent = 'Sedang memproses...';
    btnUpscale.querySelector('.loader').style.display = 'block';
    statusMsg.textContent = "Sedang menghubungi server & AI...";
    resultCard.style.display = 'none';

    const formData = new FormData();
    formData.append('image', selectedFile);
    formData.append('scale', selectedScale);

    try {
        const response = await fetch('/api/upscale', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'Gagal upscale');

        // Asumsi data mengembalikan { output_url: "..." } atau struktur serupa
        // Cek struktur response asli dari picupscaler. Biasanya ada di data.output_url atau data.image_url
        // DISESUAIKAN: Berdasarkan kode anda 'return r.data', kita perlu cek log console nanti kalau error.
        // Mari kita asumsikan outputnya ada URL gambar hasilnya.
        
        // Debugging (cek console browser jika gagal)
        console.log("API Response:", data);
        
        // Cari URL gambar output (Sesuaikan key ini jika responsenya berbeda)
        // Biasanya API generate mengembalikan { generated_image: "url", ... } atau similar.
        // Jika response langsung URL string, pakai data langsung.
        const outputUrl = data.generated_image || data.url || data.output_url || data; 

        if(!outputUrl) throw new Error("Format response API tidak dikenali.");

        // Tampilkan Hasil
        resAfter.src = outputUrl;
        downloadBtn.href = outputUrl;
        
        resAfter.onload = () => {
            resultCard.style.display = 'block';
            initComparisonSlider(); // Inisialisasi slider setelah gambar load
            statusMsg.textContent = "Selesai!";
            resetBtnState();
        };

    } catch (error) {
        statusMsg.textContent = "Error: " + error.message;
        statusMsg.style.color = "red";
        resetBtnState();
    }
});

function resetBtnState() {
    btnUpscale.disabled = false;
    btnUpscale.querySelector('.btn-text').textContent = 'Mulai Upscale';
    btnUpscale.querySelector('.loader').style.display = 'none';
}

// Logic Before/After Slider
function initComparisonSlider() {
    const slider = document.querySelector(".comp-slider");
    const imgWrapper = document.querySelector(".img-comp-before"); // Gambar atas (original)
    const container = document.querySelector(".comparison-container");
    
    let clicked = 0;
    const w = container.offsetWidth;
    
    // Set posisi awal di tengah
    imgWrapper.style.width = (w / 2) + "px";
    slider.style.left = (w / 2) + "px";

    slider.addEventListener("mousedown", slideReady);
    window.addEventListener("mouseup", slideFinish);
    slider.addEventListener("touchstart", slideReady);
    window.addEventListener("touchend", slideFinish);

    function slideReady(e) {
        e.preventDefault();
        clicked = 1;
        window.addEventListener("mousemove", slideMove);
        window.addEventListener("touchmove", slideMove);
    }

    function slideFinish() {
        clicked = 0;
    }

    function slideMove(e) {
        if (clicked == 0) return false;
        let pos = getCursorPos(e);
        if (pos < 0) pos = 0;
        if (pos > w) pos = w;
        
        slide(pos);
    }

    function getCursorPos(e) {
        let a, x = 0;
        e = (e.changedTouches) ? e.changedTouches[0] : e;
        a = container.getBoundingClientRect();
        x = e.pageX - a.left;
        x = x - window.pageXOffset;
        return x;
    }

    function slide(x) {
        imgWrapper.style.width = x + "px";
        slider.style.left = x + "px"; // Geser tombol
    }
}
