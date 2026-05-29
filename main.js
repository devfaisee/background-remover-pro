// main.js - Core application controller for Background Remover Pro
// Handles file uploads, offscreen canvas rendering, background worker tasks, 
// and canvas compositing.

// -------------------------------------------------------------
// DOM Selection
// -------------------------------------------------------------
const dropzone = document.getElementById('dropzone');
const fileInput = document.getElementById('file-input');
const fileDetails = document.getElementById('file-details');
const detailFilename = document.getElementById('detail-filename');
const detailSize = document.getElementById('detail-size');
const detailDims = document.getElementById('detail-dims');

const progressCard = document.getElementById('progress-card');
const statusLabel = document.getElementById('status-label');
const statusPercentage = document.getElementById('status-percentage');
const progressBar = document.getElementById('progress-bar');
const progressSpeed = document.getElementById('progress-speed');
const progressBytes = document.getElementById('progress-bytes');

const transcribeBtn = document.getElementById('transcribe-btn');
const btnSpinner = document.getElementById('btn-spinner');
const btnIcon = document.getElementById('btn-icon');
const btnText = document.getElementById('btn-text');

const downloadBtn = document.getElementById('download-btn');
const clearEditorBtn = document.getElementById('clear-editor-btn');
const placeholderScreen = document.getElementById('placeholder-screen');
const editorStatus = document.getElementById('editor-status');

// Slider Elements
const comparisonSlider = document.getElementById('comparison-slider');
const imgBefore = document.getElementById('img-before');
const imgAfter = document.getElementById('img-after');
const afterWrapper = document.getElementById('after-wrapper');
const sliderInput = document.getElementById('slider-input');

// -------------------------------------------------------------
// Application State
// -------------------------------------------------------------
let originalFile = null;
let originalImage = null; // High-resolution HTML Image element
let originalImageUrl = null;
let cutoutImageUrl = null;

let worker = null;
let maskCanvas = null; // Stores the generated grayscale mask
let modelDownloads = {};

// -------------------------------------------------------------
// Web Worker Initialization
// -------------------------------------------------------------
function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = handleWorkerMessage;
  }
  return worker;
}

// -------------------------------------------------------------
// File Selection & Drag-and-Drop Handlers
// -------------------------------------------------------------
dropzone.addEventListener('click', () => fileInput.click());

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});

dropzone.addEventListener('dragleave', () => {
  dropzone.classList.remove('dragover');
});

dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  
  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    handleLoadedFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files.length > 0) {
    handleLoadedFile(e.target.files[0]);
  }
});

clearEditorBtn.addEventListener('click', () => {
  clearWorkspace();
});

function handleLoadedFile(file) {
  if (!file) return;
  
  // File size checks
  if (file.size > 15 * 1024 * 1024) {
    alert('File size exceeds the 15MB browser allocation limit. Please supply a standard image.');
    return;
  }
  
  clearWorkspace();
  originalFile = file;
  
  detailFilename.textContent = file.name;
  detailSize.textContent = `${(file.size / 1024 / 1024).toFixed(2)} MB`;
  fileDetails.style.display = 'flex';
  
  // Read dimensions using standard Image object
  originalImageUrl = URL.createObjectURL(file);
  originalImage = new Image();
  originalImage.onload = () => {
    detailDims.textContent = `${originalImage.naturalWidth} x ${originalImage.naturalHeight}px`;
    
    // Enable transcription buttons
    transcribeBtn.removeAttribute('disabled');
    btnText.textContent = 'Remove Background';
    console.log(`Image loaded successfully: ${originalImage.naturalWidth}x${originalImage.naturalHeight}`);
  };
  originalImage.onerror = () => {
    alert('Failed to parse image file. Ensure file is a standard image (JPEG, PNG, WEBP, or HEIC).');
    clearWorkspace();
  };
  originalImage.src = originalImageUrl;
}

function clearWorkspace() {
  originalFile = null;
  originalImage = null;
  maskCanvas = null;
  
  if (originalImageUrl) {
    URL.revokeObjectURL(originalImageUrl);
    originalImageUrl = null;
  }
  if (cutoutImageUrl) {
    URL.revokeObjectURL(cutoutImageUrl);
    cutoutImageUrl = null;
  }
  
  imgBefore.src = '';
  imgAfter.src = '';
  
  fileDetails.style.display = 'none';
  comparisonSlider.style.display = 'none';
  placeholderScreen.style.display = 'flex';
  placeholderScreen.style.opacity = '1';
  
  transcribeBtn.setAttribute('disabled', 'true');
  btnText.textContent = 'Load AI & Isolate Background';
  
  downloadBtn.setAttribute('disabled', 'true');
  clearEditorBtn.setAttribute('disabled', 'true');
  
  fileInput.value = '';
  editorStatus.textContent = 'Offline Sandbox Enabled';
}

// -------------------------------------------------------------
// Model Caching & Inference Trigger
// -------------------------------------------------------------
transcribeBtn.addEventListener('click', async () => {
  if (!originalImage) return;
  
  // Update button statuses
  transcribeBtn.setAttribute('disabled', 'true');
  btnSpinner.style.display = 'inline-block';
  btnIcon.style.display = 'none';
  btnText.textContent = 'Allocating GPU...';
  
  progressCard.style.display = 'block';
  progressBar.style.width = '0%';
  statusPercentage.textContent = '0%';
  progressSpeed.textContent = 'Downsampling image...';
  progressBytes.textContent = '';
  
  modelDownloads = {};
  
  try {
    // 1. Downsamp image to max 1024px to ensure lightning-fast client-side WebGPU processing
    const maxDimension = 1024;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    let width = originalImage.naturalWidth;
    let height = originalImage.naturalHeight;
    
    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }
    
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(originalImage, 0, 0, width, height);
    
    // 2. Export canvas as a temporary JPEG Blob to pass to the Web Worker
    canvas.toBlob((blob) => {
      if (!blob) {
        throw new Error('Image scaling failed.');
      }
      
      const downscaledBlobUrl = URL.createObjectURL(blob);
      
      // 3. Initiate Web Worker speech/segmentation execution
      const activeWorker = getWorker();
      
      statusLabel.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Initializing model layers...`;
      progressSpeed.textContent = 'Downloading RMBG weights...';
      
      activeWorker.postMessage({
        type: 'segment',
        imageUrl: downscaledBlobUrl
      });
      
    }, 'image/jpeg', 0.95);
    
  } catch (error) {
    console.error('Error initiating background removal:', error);
    resetTranscribeButton();
    alert(`AI Error: ${error.message}`);
  }
});

function resetTranscribeButton() {
  transcribeBtn.removeAttribute('disabled');
  btnSpinner.style.display = 'none';
  btnIcon.style.display = 'inline-block';
  btnText.textContent = originalFile ? 'Remove Background' : 'Load AI & Isolate Background';
  progressCard.style.display = 'none';
}

// -------------------------------------------------------------
// Web Worker Listener
// -------------------------------------------------------------
function handleWorkerMessage(event) {
  const data = event.data;
  const { status, file, progress, loaded, total, message, maskData, maskWidth, maskHeight, durationSeconds, error } = data;
  
  if (status === 'downloading') {
    modelDownloads[file] = { progress, loaded, total };
    
    let sumLoaded = 0;
    let sumTotal = 0;
    let activeFiles = 0;
    
    for (const key in modelDownloads) {
      if (modelDownloads[key].total > 0) {
        sumLoaded += modelDownloads[key].loaded;
        sumTotal += modelDownloads[key].total;
        activeFiles++;
      }
    }
    
    let overallPercentage = 0;
    if (sumTotal > 0) {
      overallPercentage = Math.round((sumLoaded / sumTotal) * 100);
    }
    
    statusLabel.innerHTML = `<i class="fa-solid fa-cloud-arrow-down fa-bounce"></i> Fetching Neural Layers...`;
    statusPercentage.textContent = `${overallPercentage}%`;
    progressBar.style.width = `${overallPercentage}%`;
    
    const loadedMB = (sumLoaded / 1024 / 1024).toFixed(1);
    const totalMB = (sumTotal / 1024 / 1024).toFixed(1);
    progressBytes.textContent = `${loadedMB} MB / ${totalMB} MB`;
    progressSpeed.textContent = `Downloading ${activeFiles} model file(s)...`;
  }
  
  else if (status === 'file_ready' || status === 'file_done') {
    statusLabel.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Initializing model layers...`;
  }
  
  else if (status === 'initiating') {
    statusLabel.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Loading RMBG-1.4...`;
    progressSpeed.textContent = message;
  }
  
  else if (status === 'model_loaded') {
    console.log('RMBG-1.4 Neural network loaded successfully.');
    statusLabel.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Running segmentation...`;
    progressSpeed.textContent = 'Weights parsed. Allocating WebGPU pipelines...';
  }
  
  else if (status === 'segmenting') {
    statusLabel.innerHTML = `<i class="fa-solid fa-wand-magic-sparkles fa-pulse"></i> Extracting Subject...`;
    statusPercentage.textContent = '...';
    progressBar.style.width = '95%';
    progressSpeed.textContent = message;
    progressBytes.textContent = '';
    btnText.textContent = 'Extracting...';
  }
  
  else if (status === 'success') {
    console.log(`Background removed in ${durationSeconds} seconds.`);
    
    // 1. Build mask canvas from grayscale TypedArray returned by Web Worker
    maskCanvas = document.createElement('canvas');
    maskCanvas.width = maskWidth;
    maskCanvas.height = maskHeight;
    const maskCtx = maskCanvas.getContext('2d');
    
    const maskImageData = maskCtx.createImageData(maskWidth, maskHeight);
    const pixels = maskImageData.data;
    
    // Populate mask ImageData channels
    for (let i = 0; i < maskData.length; i++) {
      const alphaValue = maskData[i];
      const pixelIndex = i * 4;
      pixels[pixelIndex] = 255;     // R
      pixels[pixelIndex + 1] = 255; // G
      pixels[pixelIndex + 2] = 255; // B
      pixels[pixelIndex + 3] = alphaValue; // A (the mask weight!)
    }
    
    maskCtx.putImageData(maskImageData, 0, 0);
    
    // 2. Perform compositing to display Before vs After visual slider
    renderSliderPreviews();
    
    // 3. Update interface elements
    placeholderScreen.style.opacity = '0';
    setTimeout(() => {
      placeholderScreen.style.display = 'none';
      comparisonSlider.style.display = 'block';
      updateSliderWidths();
    }, 300);
    
    downloadBtn.removeAttribute('disabled');
    clearEditorBtn.removeAttribute('disabled');
    
    editorStatus.textContent = `Isolated in ${durationSeconds}s. Private & secure.`;
    resetTranscribeButton();
  }
  
  else if (status === 'error') {
    console.error('Worker returned execution error:', error);
    resetTranscribeButton();
    alert(`AI Processing Failed: ${error}`);
  }
}

// -------------------------------------------------------------
// Canvas Destination-In Alpha Mask Compositing
// -------------------------------------------------------------
function renderSliderPreviews() {
  if (!originalImage || !maskCanvas) return;
  
  // We create two canvases: one for the 'before' image (which is standard) and one for the 'after' cutout
  const width = originalImage.naturalWidth;
  const height = originalImage.naturalHeight;
  
  // 1. Cutout Canvas
  const cutoutCanvas = document.createElement('canvas');
  cutoutCanvas.width = width;
  cutoutCanvas.height = height;
  const cutoutCtx = cutoutCanvas.getContext('2d');
  
  // Draw the original image first
  cutoutCtx.drawImage(originalImage, 0, 0);
  
  // Set destination-in compositing (keep pixels only where mask overlaps)
  cutoutCtx.globalCompositeOperation = 'destination-in';
  
  // Scale and draw the mask canvas onto the original dimensions
  cutoutCtx.drawImage(maskCanvas, 0, 0, width, height);
  
  // Reset compositing mode to standard
  cutoutCtx.globalCompositeOperation = 'source-over';
  
  // 2. Load into visual slider image elements
  imgBefore.src = originalImageUrl;
  
  cutoutCanvas.toBlob((blob) => {
    if (cutoutImageUrl) {
      URL.revokeObjectURL(cutoutImageUrl);
    }
    cutoutImageUrl = URL.createObjectURL(blob);
    imgAfter.src = cutoutImageUrl;
  }, 'image/png');
}

// -------------------------------------------------------------
// Comparison Range Slider Handles
// -------------------------------------------------------------
sliderInput.addEventListener('input', (e) => {
  const value = e.target.value;
  comparisonSlider.style.setProperty('--slider-pos', `${value}%`);
});

// Update the absolute width of the 'after' image so it maps 1:1 on slider drag
function updateSliderWidths() {
  if (comparisonSlider.style.display !== 'none') {
    const sliderWidth = comparisonSlider.clientWidth;
    comparisonSlider.style.setProperty('--slider-width', `${sliderWidth}px`);
  }
}

window.addEventListener('resize', updateSliderWidths);

// -------------------------------------------------------------
// PNG Download and Export
// -------------------------------------------------------------
downloadBtn.addEventListener('click', () => {
  if (!originalImage || !maskCanvas) return;
  
  const width = originalImage.naturalWidth;
  const height = originalImage.naturalHeight;
  
  // Create high-resolution offscreen canvas
  const downloadCanvas = document.createElement('canvas');
  downloadCanvas.width = width;
  downloadCanvas.height = height;
  const downloadCtx = downloadCanvas.getContext('2d');
  
  // Draw the original image
  downloadCtx.drawImage(originalImage, 0, 0);
  
  // Apply destination-in mask compositing (bilinear scaling is automatically handled by GPU)
  downloadCtx.globalCompositeOperation = 'destination-in';
  downloadCtx.drawImage(maskCanvas, 0, 0, width, height);
  downloadCtx.globalCompositeOperation = 'source-over';
  
  // Export as transparent PNG
  downloadCtx.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const tempLink = document.createElement('a');
    tempLink.href = url;
    
    // Deduce file download name
    const rawName = originalFile.name.split('.')[0] || 'cutout';
    tempLink.download = `${rawName}-removed.png`;
    
    document.body.appendChild(tempLink);
    tempLink.click();
    
    document.body.removeChild(tempLink);
    URL.revokeObjectURL(url);
    editorStatus.textContent = 'Transparent PNG cutout downloaded!';
  }, 'image/png');
});
