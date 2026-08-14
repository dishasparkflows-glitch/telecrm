const { ApiResponse, ApiError, asyncHandler, getPresignedUploadUrl, getPresignedDownloadUrl } = require('@sparkcrm/shared-utils');

/**
 * POST /api/uploads/url
 * Generate a presigned URL for direct client-side uploading to Cloudflare R2 / AWS S3
 */
const getUploadUrl = asyncHandler(async (req, res) => {
    // Both tenantId and userId can be used depending on context
    const tenantId = req.headers['x-tenant-id'] || req.body.tenantId || 'system';
    const userId = req.headers['x-user-id'] || req.body.userId;

    const uploadType = req.body.uploadType || "misc";
    const subUploadType = req.body.subUploadType;
    const fileType = req.body.fileType || "image/jpeg";

    // File type validation
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "video/mp4",
        "video/quicktime",
        "video/x-msvideo",
        "video/x-matroska",
        "application/pdf",
        "text/plain",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        // Audio types
        "audio/mpeg",
        "audio/mp4",
        "audio/aac",
        "audio/ogg",
        "audio/wav",
        "audio/x-wav",
        "audio/webm",
        "audio/3gpp"
    ];

    if (!allowedTypes.includes(fileType)) {
        throw ApiError.badRequest("Invalid file type. Only images, audio, video, PDFs, and documents are allowed.");
    }

    // File size validation (max 10MB)
    if (req.body.fileSize && req.body.fileSize > 10 * 1024 * 1024) {
        throw ApiError.badRequest("File size exceeds 10MB limit.");
    }

    const timestamp = Date.now();

    const leadId = req.body.leadId;
    const meetingId = req.body.meetingId;

    // 🔧 Base path for this CRM project
    let keyPath = `tenants/${tenantId}`;

    if (userId) {
        keyPath += `/users/${userId}`;
    }

    if (leadId) {
        keyPath += `/leads/${leadId}`;
    }

    if (meetingId) {
        keyPath += `/meetings/${meetingId}`;
    }

    keyPath += `/${uploadType}`;

    if (subUploadType) {
        keyPath += `/${subUploadType}`;
    }

    const key = `${keyPath}/${timestamp}-${Math.random().toString(36).substring(7)}`;

    const { uploadUrl } = await getPresignedUploadUrl(key, fileType);
    const downloadUrl = await getPresignedDownloadUrl(key, 86400);

    ApiResponse.success(res, { uploadUrl, downloadUrl, key }, 'Upload URL generated');
});

module.exports = {
    getUploadUrl,
};
