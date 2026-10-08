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
- WebCrypto API (AES-256-GCM)
- scrypt password-based key derivation
- ML-KEM-768 (CRYSTALS-Kyber, FIPS 203)
- Quantum-resistant encryption

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

## Quantum-Resistant Encryption
Encrypt images into password-protected `.enc` files. Everything runs locally.

How a file is sealed:
1. Your password is stretched with scrypt (N=2^17, r=8, p=1) into a 256-bit key.
2. A fresh ML-KEM-768 key pair is generated for the file; its shared secret
   (hashed with SHA-256) encrypts the image with AES-256-GCM.
3. The ML-KEM private key is encrypted with the password key, also AES-256-GCM.

The password is what protects a file. scrypt and AES-256 hold up against known
quantum attacks; the per-file ML-KEM key pair keeps the format ready for
public-key sharing. Passwords are never stored, so a lost password can't be
recovered.

The format is versioned (`PQIE` v2 stores its scrypt settings in the header).
Files made with v1 still open.

---

# Why SafePic?

Most AI image editors upload your files to external servers.

SafePic was built to explore:
- Local-first AI
- Browser-based security
- Quantum-resistant cryptography
- Privacy-focused software design

The goal is simple:

> Keep sensitive images entirely on the user's device.

---

# Installation

Use it at [safepics.us](https://safepics.us), or run it locally:

```bash
git clone https://github.com/JadenLee0810/safepic.git
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
- Share encrypted images to a recipient's ML-KEM public key (no shared password)

---

# License

MIT License
