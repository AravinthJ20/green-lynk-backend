const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const ChatMedia = require('../models/ChatMedia');
const { uploadMediaBuffer } = require('./mediaStorage');

const normalizeMimeType = (value) => `${value || ''}`.split(';')[0].trim().toLowerCase();

const isObjectIdString = (value) => typeof value === 'string' && mongoose.Types.ObjectId.isValid(value);

const createExternalAvatarMedia = async ({ ownerId, url }) => {
  const normalizedUrl = typeof url === 'string' ? url.trim() : '';
  if (!normalizedUrl) return '';

  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch (error) {
    throw new Error('Avatar URL is invalid');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('Avatar URL must start with http or https');
  }

  const originalName = path.basename(parsedUrl.pathname) || 'avatar-url';
  const extension = path.extname(originalName);
  const fileName = extension ? originalName : `${originalName}.url`;

  const media = await ChatMedia.create({
    owner: ownerId,
    storageType: 'external',
    bucketType: 'external',
    storageId: crypto.createHash('sha1').update(normalizedUrl).digest('hex'),
    fileName,
    originalName,
    mimeType: 'image/url',
    size: 0,
    storagePath: normalizedUrl,
    publicUrl: normalizedUrl,
    category: 'image'
  });

  return media._id.toString();
};

const createUploadedAvatarMedia = async ({ ownerId, fileName, mimeType, buffer }) => {
  const normalizedMimeType = normalizeMimeType(mimeType);
  if (!fileName || !normalizedMimeType || !buffer) {
    throw new Error('Missing avatar upload data');
  }

  const storedFile = await uploadMediaBuffer({
    fileName,
    mimeType: normalizedMimeType,
    buffer,
    category: 'image'
  });

  const media = await ChatMedia.create({
    owner: ownerId,
    storageType: storedFile.storageType,
    bucketType: storedFile.bucketType || storedFile.storageType,
    storageId: storedFile.storageId,
    fileName: storedFile.fileName,
    originalName: fileName,
    mimeType: storedFile.mimeType,
    size: buffer.length,
    storagePath: storedFile.storagePath,
    publicUrl: storedFile.publicUrl,
    category: 'image'
  });

  return media._id.toString();
};

const resolveAvatarPublicUrl = async (avatarValue) => {
  if (!avatarValue) return '';
  if (typeof avatarValue === 'object' && avatarValue.publicUrl) return avatarValue.publicUrl;

  const normalizedValue = `${avatarValue}`.trim();
  if (!normalizedValue) return '';
  if (!isObjectIdString(normalizedValue)) return normalizedValue;

  const media = await ChatMedia.findById(normalizedValue).select('publicUrl').lean();
  return media?.publicUrl || '';
};

const resolveAvatarIdForProfileUpdate = async ({ ownerId, avatar }) => {
  const normalizedAvatar = typeof avatar === 'string' ? avatar.trim() : '';
  if (!normalizedAvatar) return '';

  if (isObjectIdString(normalizedAvatar)) {
    const media = await ChatMedia.findOne({
      _id: normalizedAvatar,
      owner: ownerId,
      category: 'image'
    }).select('_id').lean();

    if (!media) {
      throw new Error('Selected avatar image was not found');
    }

    return normalizedAvatar;
  }

  const existingMedia = await ChatMedia.findOne({
    owner: ownerId,
    publicUrl: normalizedAvatar,
    category: 'image'
  }).select('_id').lean();

  if (existingMedia) {
    return existingMedia._id.toString();
  }

  return createExternalAvatarMedia({ ownerId, url: normalizedAvatar });
};

module.exports = {
  createExternalAvatarMedia,
  createUploadedAvatarMedia,
  isObjectIdString,
  resolveAvatarIdForProfileUpdate,
  resolveAvatarPublicUrl
};
