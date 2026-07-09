const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

const IMAGE_TYPES = [
  { ext: '.jpg', matches: b => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: '.png', matches: b => b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a },
  { ext: '.gif', matches: b => b.length >= 6 && b.slice(0, 6).toString('ascii').startsWith('GIF8') },
  { ext: '.webp', matches: b => b.length >= 12 && b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP' }
];

function detectImageType(buffer) {
  return IMAGE_TYPES.find(type => type.matches(buffer)) || null;
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = crypto.randomUUID() + ext;
    cb(null, uniqueName);
  }
});

// 文件类型过滤
const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('仅允许上传 jpg/png/gif/webp 格式的图片'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// 上传单张图片
router.post('/', auth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    console.log('[Upload] req.file:', req.file ? req.file.originalname : 'MISSING');
    console.log('[Upload] req.body keys:', Object.keys(req.body));
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ code: 400, message: '图片大小不能超过 5MB' });
      }
      return res.status(400).json({ code: 400, message: '上传失败: ' + err.message });
    }
    if (err) {
      return res.status(400).json({ code: 400, message: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ code: 400, message: '请选择要上传的图片' });
    }

    const filePath = req.file.path;
    const buffer = fs.readFileSync(filePath);
    const detected = detectImageType(buffer);
    if (!detected) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ code: 400, message: '仅允许上传真实图片文件' });
    }
    if (path.extname(req.file.filename).toLowerCase() !== detected.ext) {
      const newName = path.basename(req.file.filename, path.extname(req.file.filename)) + detected.ext;
      const newPath = path.join(path.dirname(filePath), newName);
      fs.renameSync(filePath, newPath);
      req.file.filename = newName;
    }

    res.json({
      code: 0,
      data: {
        url: '/uploads/' + req.file.filename
      }
    });
  });
});

// base64 方式上传（ArkTS multipart 不兼容 multer 时的备选）
router.post('/base64', auth, (req, res) => {
  const { image } = req.body;
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ code: 400, message: '请提供有效的图片数据' });
  }
  const buffer = Buffer.from(image, 'base64');
  if (buffer.length > 5 * 1024 * 1024) {
    return res.status(400).json({ code: 400, message: '图片大小不能超过 5MB' });
  }
  const detected = detectImageType(buffer);
  if (!detected) {
    return res.status(400).json({ code: 400, message: '仅允许上传真实图片文件' });
  }
  const name = crypto.randomUUID() + detected.ext;
  const outPath = path.join(__dirname, '..', 'uploads', name);
  try {
    fs.writeFileSync(outPath, buffer);
    console.log('[Upload-base64] 保存成功: ' + name + ' size=' + buffer.length);
    res.json({ code: 0, data: { url: '/uploads/' + name } });
  } catch (e) {
    console.error('[Upload-base64] 保存失败: ' + e.message);
    res.status(500).json({ code: 500, message: '保存图片失败' });
  }
});

module.exports = router;
