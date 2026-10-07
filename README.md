# Smart Universal File Converter with Intelligent Content Transformation (SUFC)

Front-end prototype for Software Engineering Practical 9.

## Run
Open `index.html` in a browser. No build step or server is needed.

## What works
- Drag and drop or choose a file, with extension, size and empty-file validation
- Conversion matrix: only valid output formats are offered (direct and advanced)
- Progress bar with step-by-step status
- Real in-browser conversion: JPG, PNG, WEBP between each other, and image to PDF
- OCR and speech-recognition warnings for advanced conversions
- Download, convert another file, and conversion history (localStorage)

## Simulated in this prototype
All other conversions show the full flow but download a demo text file. The planned back end
(Python with Flask or FastAPI) would use Pillow, LibreOffice, FFmpeg, pandas/openpyxl,
PyMuPDF, an OCR engine and speech-to-text and text-to-speech libraries.

## Files
`index.html` structure · `style.css` styling · `script.js` logic
