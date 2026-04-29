# SafePic

A local image editor with AI background removal and post-quantum encryption. Everything runs in your browser. Nothing ever leaves your device.

---

## Features

### Editing
- Draw and paint with adjustable brush size and color
- Eraser
- Text tool — click anywhere on the canvas and type
- Flood fill / paint bucket
- Crop — drag to select a region, then apply
- Resize the canvas to any width and height
- Rotate 90° left or right
- Flip horizontally or vertically
- Undo and redo (40 steps)
- Mouse-wheel zoom and fit-to-screen

### Adjustments
Real-time, non-destructive sliders for:
- Brightness
- Contrast
- Saturation
- Hue shift

Preview live, then apply and flatten when you're happy.

### Filters
One-click presets:
- Grayscale
- Sepia
- Invert
- Vivid
- Cool
- Warm
- Fade

### AI background removal
Removes the background from any image with one click. The model runs entirely in your browser via ONNX Runtime — no API call, no upload, no cloud. The first click downloads the model files (~40 MB) once; after that it works offline forever.

### Compress and Save
Open the Compress dialog to choose JPG, WebP, or PNG, drag a quality slider, and watch the estimated file size update in real time before you save. Compare the result to a lossless PNG baseline so you know exactly how much you're saving.

### Post-quantum encryption
Save any image as an encrypted `.enc` file protected by a password. Open `.enc` files the same way — drag, drop, type the password, edit. If the password is wrong, nothing decrypts. If you lose the password, the file is gone forever.

### Themes
Four themes: Dark Gold, Light, Cyberpunk, and Forest. Pick one from the palette icon in the top-right; your choice is remembered between visits.

---

## Why SafePic is secure

### Nothing ever leaves your device
Every other photo editing service — Photoshop online, Canva, Pixlr, Figma, Google Photos — sends your images to a server somewhere. They have to. That's how their AI features work, that's where their compute lives, that's how they share files between users. The price is that a copy of every photo you edit ends up on someone else's hard drive.

SafePic doesn't do any of that. There's no server. There's no upload. There's no account, no email signup, no telemetry. Your photos go from your device, into the editor, back to your device. The only network requests the entire app makes are the initial code download and, on first AI use, the one-time model file fetch. After that, you can disconnect from the internet and SafePic still works perfectly.

### The encryption is post-quantum
Today's encryption — the kind protecting your bank account, your email, your messages — relies on math problems that ordinary computers can't solve. But quantum computers, which are real and improving rapidly, will eventually be able to crack much of that math. Some governments and criminal groups are already collecting encrypted data today, planning to decrypt it in 10–15 years when the hardware catches up. It's called "harvest now, decrypt later."

SafePic uses **ML-KEM-768 (CRYSTALS-Kyber)**, an encryption algorithm specifically designed to resist both today's computers and future quantum computers. The U.S. National Institute of Standards and Technology selected it as the official standard for protecting information that needs to stay secret for a long time. A photo you encrypt today will still be unbreakable in 2050.

### Your password never gets stored
Some apps that ask for a password actually save it somewhere — encrypted, sure, but still saved. That's a weakness: if someone steals the storage, they can sometimes work backward to your data.

SafePic doesn't save your password at all. When you type it, the app runs it through a one-way function called **scrypt** that turns it into an encryption key. The key is used immediately and discarded. The password itself touches memory for a fraction of a second and disappears. There's nothing on your device that says what your password is, not even a hash of it. The only way to open an encrypted file is to type the right password again — and if you type the wrong one, the app instantly knows and refuses without giving any clue about what was wrong.

### The browser sandbox protects you from us
This is subtle but important. Even if SafePic's code were malicious, the browser physically prevents it from doing damage. Browsers run web pages in a sandbox: a web page can't read your filesystem, can't access other apps, can't talk to your camera without permission, can't reach into your other tabs. When you click "Open," your browser shows its own file picker — *you* choose what to give the app. When you save, the file goes to *your* Downloads folder via a normal download. The app can't sneak around behind your back. The browser's sandbox is a stronger guarantee than "trust the developer."

### Open and auditable
Every line of code that runs on your device is visible. Right-click anywhere in SafePic and choose "View source." That's it. There's no hidden server-side logic, no obfuscated binary, no closed-source backend. Anyone with a few hours and a bit of JavaScript knowledge can read exactly what SafePic does. You don't have to trust the developer — you can verify.

### What this all adds up to
- A hacker breaks into your computer → they get scrambled bytes they can't read
- A future quantum computer → still can't break ML-KEM-768
- Someone steals your `.enc` file → useless without the password
- The developer turns evil → browser sandbox stops them anyway
- A tech company you don't trust → none is involved
- Your internet goes out → SafePic keeps working

The deliberate tradeoff: if *you* forget your password, the file is gone forever. There's no recovery email, no support team, no master key. That's not a flaw — it's the same property that keeps everyone else out. Real security has no backdoor, not even for you.

Most apps trade security for convenience. SafePic deliberately trades convenience for security. For a photo you actually need to keep private, that's the right call.