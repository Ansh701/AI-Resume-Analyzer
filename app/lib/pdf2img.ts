export interface PdfConversionResult {
    imageUrl: string;
    file: File | null;
    error?: string;
}

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
    if (pdfjsLib) return pdfjsLib;
    if (loadPromise) return loadPromise;

    isLoading = true;

    try {
        // Use CDN instead of local import for Puter compatibility
        loadPromise = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
            script.onload = () => {
                // @ts-ignore
                const lib = window.pdfjsLib;
                // Set the worker source to CDN
                lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                pdfjsLib = lib;
                isLoading = false;
                resolve(lib);
            };
            script.onerror = (error) => {
                isLoading = false;
                reject(new Error('Failed to load PDF.js from CDN'));
            };
            document.head.appendChild(script);
        });

        return await loadPromise;
    } catch (error) {
        isLoading = false;
        loadPromise = null;
        throw error;
    }
}

export async function convertPdfToImage(
    file: File
): Promise<PdfConversionResult> {
    try {
        console.log('Starting PDF conversion for:', file.name);

        // Add file type check
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            return {
                imageUrl: "",
                file: null,
                error: "File is not a PDF",
            };
        }

        const lib = await loadPdfJs();
        console.log('PDF.js loaded successfully');

        const arrayBuffer = await file.arrayBuffer();
        console.log('File read as array buffer, size:', arrayBuffer.byteLength);

        const pdf = await lib.getDocument({ data: arrayBuffer }).promise;
        console.log('PDF document loaded, pages:', pdf.numPages);

        const page = await pdf.getPage(1);
        console.log('First page loaded');

        const viewport = page.getViewport({ scale: 4 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("Failed to get canvas context");
        }

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";

        await page.render({ canvasContext: context, viewport }).promise;
        console.log('PDF page rendered to canvas');

        return new Promise((resolve) => {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        // Create a File from the blob with the same name as the pdf
                        const originalName = file.name.replace(/\.pdf$/i, "");
                        const imageFile = new File([blob], `${originalName}.png`, {
                            type: "image/png",
                        });

                        console.log('PDF converted successfully to image');
                        resolve({
                            imageUrl: URL.createObjectURL(blob),
                            file: imageFile,
                        });
                    } else {
                        resolve({
                            imageUrl: "",
                            file: null,
                            error: "Failed to create image blob",
                        });
                    }
                },
                "image/png",
                1.0
            ); // Set quality to maximum (1.0)
        });
    } catch (err) {
        console.error('Detailed PDF conversion error:', err);
        return {
            imageUrl: "",
            file: null,
            error: `Failed to convert PDF: ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}