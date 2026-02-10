import express, { Request, Response } from "express";
import fileUpload from "express-fileupload";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export function setupFileUpload(app: express.Application) {
  // Use express-fileupload middleware
  app.use(fileUpload());

  // File upload endpoint
  app.post("/api/upload", (req: Request, res: Response) => {
    try {
      // Check if file is present in request
      if (!req.files || Object.keys(req.files).length === 0) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const uploadedFile = req.files.file as fileUpload.UploadedFile;

      // Validate file type (only images)
      const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedMimes.includes(uploadedFile.mimetype)) {
        return res.status(400).json({ error: "Invalid file type. Only images are allowed." });
      }

      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024;
      if (uploadedFile.size > maxSize) {
        return res.status(400).json({ error: "File size exceeds 5MB limit" });
      }

      // Generate unique filename
      const ext = path.extname(uploadedFile.name);
      const fileName = `${nanoid()}-${Date.now()}${ext}`;
      const filePath = path.join(UPLOAD_DIR, fileName);

      // Save file
      uploadedFile.mv(filePath, (err: Error | null) => {
        if (err) {
          return res.status(500).json({ error: "Failed to upload file" });
        }

        res.json({ fileName, url: `/api/uploads/${fileName}` });
      });
    } catch (error) {
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // Serve uploaded files
  app.use("/api/uploads", express.static(UPLOAD_DIR));
}
