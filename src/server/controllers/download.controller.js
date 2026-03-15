//src/server/controllers/download.controller.js
const pool = require('../db').pool;
const path = require('path');
const fs = require('fs');

const UPLOADS_PREFIX = process.env.UPLOADS_PREFIX || '/uploads';
const TRACKS_SUBDIR = 'tracks';

function isAdminIncludeUnapproved(req) {
  return !!(req.user && req.user.role === 'admin' && req.query.include_unapproved === '1');
}

function sanitizeName(s) {
  if (!s) return '';
  // keep parentheses, dashes, underscores, spaces; remove dangerous chars and trim
  return String(s)
    .replace(/["'<>:\\/|?*]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

exports.downloadTrack = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: 'Invalid track id' });

    const adminOverride = isAdminIncludeUnapproved(req);

    const sql = `
      SELECT t.*,
             a.display_name AS artist_name,
             a.is_approved AS artist_is_approved,
             a.is_rejected AS artist_is_rejected,
             u.deleted_at AS artist_user_deleted_at,
             u.banned AS artist_user_banned
      FROM tracks t
      LEFT JOIN artists a ON t.artist_id = a.id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE t.id = ?
      LIMIT 1
    `;
    const [rows] = await pool.query(sql, [id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Track not found' });
    const row = rows[0];

    // Visibility checks (non-admin)
    if (!adminOverride) {
      if (row.artist_user_deleted_at) return res.status(410).json({ status: 'deleted', message: 'Artist account deleted' });
      if (row.artist_user_banned) return res.status(403).json({ status: 'banned', message: 'Artist account banned' });
      if (row.artist_is_rejected) return res.status(403).json({ status: 'rejected', message: 'Artist profile rejected' });
      if (!row.artist_is_approved) return res.status(403).json({ status: 'pending_verification', message: 'Artist profile pending verification' });
    }

    // Determine file URL field (existing logic)
    const rawFile = row.preview_url || row.previewUrl || row.file_url || row.fileUrl || null;
    if (!rawFile) return res.status(404).json({ error: 'No audio file available for this track' });

    // ------------------------------------------------------------------
    // Build a human‑friendly filename for the download
    // ------------------------------------------------------------------
    let prettyBase = null;
    if (row.title && typeof row.title === 'string' && row.title.trim().length > 0) {
      prettyBase = sanitizeName(row.title);
    }

    // If no title, try common original‑name columns
    if (!prettyBase) {
      const candidateOriginals = [
        row.original_name, row.file_name, row.originalFilename, row.originalName, row.filename, row.upload_name
      ];
      for (let i = 0; i < candidateOriginals.length; i += 1) {
        const c = candidateOriginals[i];
        if (c && typeof c === 'string' && c.trim()) {
          const noExt = c.replace(/\.[^/.]+$/, '');
          prettyBase = sanitizeName(noExt);
          break;
        }
      }
    }

    // Determine file extension from the rawFile URL (if possible), else fallback
    let ext = '.mp3'; // default
    try {
      const url = new URL(rawFile, 'http://localhost'); // base is ignored for absolute URLs
      const pathname = url.pathname;
      const extFromUrl = path.extname(pathname).toLowerCase();
      if (extFromUrl && ['.mp3', '.m4a', '.ogg', '.wav', '.flac', '.mp4'].includes(extFromUrl)) {
        ext = extFromUrl;
      }
    } catch (e) {
      // not a valid URL, fallback to extension from local path logic below
    }

    // If we still don't have a prettyBase, fallback to deriving from stored filename (only relevant for local)
    if (!prettyBase && !/^https?:\/\//i.test(rawFile)) {
      // local file handling: extract from filename
      const normalized = rawFile.startsWith('/') ? rawFile : `/${rawFile}`;
      const fileBasename = path.posix.basename(normalized);
      let base = fileBasename.replace(/\.[^/.]+$/, '');
      base = base.replace(/^trk-[^-]+-[0-9]+-/, '');
      base = base.replace(/^trk-[0-9]+-/, '');
      base = base.replace(/^upload-/, '');
      base = base.replace(/^uid-/, '');
      base = base.replace(/^file-/, '');
      base = base.replace(/^[\-_]+/, '');
      prettyBase = sanitizeName(base) || `track-${id}`;
    } else if (!prettyBase) {
      // fallback for external URLs that couldn't derive a name
      prettyBase = `track-${id}`;
    }

    // Append the tag
    const tag = '(downloaded from backyardbeats)';
    let attachmentBase = `${prettyBase} ${tag}`;
    if (attachmentBase.length > 190) attachmentBase = attachmentBase.substring(0, 190);
    const attachmentFilename = `${attachmentBase}${ext}`;

    // Common headers that should be sent regardless of file source
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Track-Title, X-Track-Artist, X-Track-Genre, Content-Type');
    res.setHeader('X-Track-Title', row.title || '');
    res.setHeader('X-Track-Artist', row.artist_name || '');
    res.setHeader('X-Track-Genre', row.genre || '');

    // ------------------------------------------------------------------
    // External URL handling (including Cloudinary)
    // ------------------------------------------------------------------
    if (/^https?:\/\//i.test(rawFile)) {
      // If it's a Cloudinary URL, add parameters to force download and set filename
      if (rawFile.includes('cloudinary.com')) {
        try {
          const url = new URL(rawFile);
          // Add the download flag
          url.searchParams.set('fl_attachment', '');
          // Set the desired filename (Cloudinary will use this as the downloaded file name)
          url.searchParams.set('filename', attachmentFilename);
          const downloadUrl = url.toString();
          return res.redirect(302, downloadUrl);
        } catch (e) {
          // If URL parsing fails, fall back to simple redirect
          console.error('Error building Cloudinary download URL:', e);
          return res.redirect(302, rawFile);
        }
      }

      // For other external URLs, just redirect (they may not support forced download naming)
      return res.redirect(302, rawFile);
    }

    // ------------------------------------------------------------------
    // Local file on disk handling (kept for backward compatibility during migration)
    // ------------------------------------------------------------------
    const normalized = rawFile.startsWith('/') ? rawFile : `/${rawFile}`;
    const fileBasename = path.posix.basename(normalized);
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const fileOnDisk = path.join(uploadsDir, TRACKS_SUBDIR, fileBasename);

    if (!fs.existsSync(fileOnDisk)) {
      return res.status(404).json({ error: 'File not found on server', file: fileOnDisk });
    }

    // infer content type by extension (already have ext variable)
    let contentType = 'application/octet-stream';
    if (ext === '.mp3') contentType = 'audio/mpeg';
    else if (ext === '.m4a' || ext === '.mp4') contentType = 'audio/mp4';
    else if (ext === '.ogg') contentType = 'audio/ogg';
    else if (ext === '.wav') contentType = 'audio/wav';
    else if (ext === '.flac') contentType = 'audio/flac';

    // Set headers for local file download
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachmentFilename}"; filename*=UTF-8''${encodeURIComponent(attachmentFilename)}`);

    // debug log (optional)
    console.log(`Download: id=${id} file=${fileOnDisk} attach="${attachmentFilename}"`);

    // stream file
    const stream = fs.createReadStream(fileOnDisk);
    stream.on('error', (err) => {
      console.error('File stream error', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to stream file' }); 
      } else {
        res.destroy();
      }
    });
    return stream.pipe(res);
  } catch (err) {
    next(err);
  }
};