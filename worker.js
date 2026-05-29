// worker.js - Background thread for running AI image segmentation
// Offloads heavy neural network inference to keep the Visual Workspace UI buttery smooth.

import { pipeline, env, RawImage } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Enforce local caching of downloaded model files via browser's Cache API
env.allowLocalModels = false;

let segmentator = null;

// Initialize the RMBG image-segmentation pipeline
async function getSegmentator() {
  if (segmentator) return segmentator;

  self.postMessage({ status: 'initiating', message: 'Initializing segmentation layers...' });

  segmentator = await pipeline('image-segmentation', 'Xenova/bria-rmbg-1.4', {
    progress_callback: (data) => {
      if (data.status === 'downloading') {
        self.postMessage({
          status: 'downloading',
          file: data.file,
          progress: data.progress || 0,
          loaded: data.loaded || 0,
          total: data.total || 0
        });
      } else if (data.status === 'done') {
        self.postMessage({ status: 'file_done', file: data.file });
      } else if (data.status === 'ready') {
        self.postMessage({ status: 'file_ready', file: data.file });
      }
    }
  });

  self.postMessage({ status: 'model_loaded' });
  return segmentator;
}

// Listen for messages from the main UI thread
self.onmessage = async (event) => {
  const { type, imageUrl } = event.data;

  if (type === 'load') {
    try {
      await getSegmentator();
    } catch (error) {
      self.postMessage({ status: 'error', error: `Model loading failed: ${error.message}` });
    }
  }

  else if (type === 'segment') {
    try {
      // 1. Ensure segmentator pipeline is fully instantiated
      const segmentatorInstance = await getSegmentator();
      
      self.postMessage({ status: 'segmenting', message: 'Analyzing foreground shapes and isolating edges...' });
      
      const startTime = performance.now();
      
      // 2. Decode the raw image via local Blob/Data URL in Web Worker
      const rawImage = await RawImage.fromURL(imageUrl);
      
      // 3. Execute inference (Runs on WebGPU if supported, falls back to WebAssembly)
      const [result] = await segmentatorInstance(rawImage);
      
      const duration = ((performance.now() - startTime) / 1000).toFixed(2);
      
      // 4. Extract grayscale mask transparency values
      // result.mask.data is a flat Uint8Array (values 0 to 255) of size (width * height * 1)
      const maskData = result.mask.data;
      const maskWidth = result.mask.width;
      const maskHeight = result.mask.height;
      
      // 5. Transfer flat binary arrays back to main thread instantly
      self.postMessage({
        status: 'success',
        maskData: maskData,
        maskWidth: maskWidth,
        maskHeight: maskHeight,
        durationSeconds: duration
      }, [maskData.buffer]); // Uses Transferable Objects for zero-copy high-speed transfer
      
    } catch (error) {
      self.postMessage({ status: 'error', error: `Segmentation failed: ${error.message}` });
    }
  }
};
