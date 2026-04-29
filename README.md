# SafePic

SafePic is a browser-based image editor focused on privacy, AI, and cybersecurity.

Everything runs locally on your device:
- No cloud storage
- No uploads
- No accounts
- No external servers

AI background removal and encryption both happen directly in the browser.

---

# Tech Stack

## Frontend
- JavaScript / TypeScript
- HTML5 Canvas
- CSS

## AI
- ONNX Runtime Web
- Local AI background removal model
- Fully client-side inference

## Security
- WebCrypto API
- ML-KEM-768 (CRYSTALS-Kyber)
- scrypt password-based key derivation
- Post-quantum encryption

---

# Features

## Image Editing
- Draw / paint tools
- Text tool
- Crop / resize
- Rotate / flip
- Undo / redo
- Zoom controls
- Redact

## Filters & Adjustments
- Brightness
- Contrast
- Saturation
- Hue shift
- Grayscale
- Sepia
- Invert
- Vivid filters

## AI Background Removal
Runs fully in-browser using ONNX Runtime.
No API calls or cloud processing required.

## Compression
Export images as:
- PNG
- JPG
- WebP

Includes live quality and file size preview.

## Post-Quantum Encryption
Encrypt images into `.enc` files using:
- ML-KEM-768
- Password-based encryption
- Local-only key generation

Passwords are never stored.

---

# Why SafePic?

Most AI image editors upload your files to external servers.

SafePic was built to explore:
- Local-first AI
- Browser-based security
- Post-quantum cryptography
- Privacy-focused software design

The goal is simple:

> Keep sensitive images entirely on the user's device.

---

# Installation

Deploy on safepic.vercel.app 

- or -

```bash
git clone https://github.com/yourusername/safepic.git
cd safepic
npm install
npm run dev
```

---

# Future Plans

- Layer system
- Additional AI editing tools
- Mobile support
- Secure local image vault
- More post-quantum cryptography support

---

# License

MIT License
