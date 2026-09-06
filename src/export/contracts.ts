import type { RasterSettings } from '../raster/settings';

export const VIDEO_FRAME_RATE = 30;

export type VideoExportFormat = 'webm' | 'mp4';
export type VideoFrameRate = 24 | 30;
export type VideoQualityProfile = 'web' | 'high';

export interface ImageExportOptions {
  width: number;
  height: number;
  settings: RasterSettings;
  source?: ImageData | null;
  phase: number;
  background: string;
  transparent: boolean;
  fileName?: string;
}

export interface ImageExportResult {
  blob: Blob;
  width: number;
  height: number;
  fileName: string;
}

export interface VideoExportOptions {
  width: number;
  height: number;
  settings: RasterSettings;
  source?: ImageData | null;
  duration: number;
  background: string;
  format: VideoExportFormat;
  transparent?: boolean;
  frameRate?: VideoFrameRate;
  quality?: VideoQualityProfile;
  onProgress?: (progress: number) => void;
  signal?: AbortSignal;
  fileName?: string;
}

export interface VideoExportResult {
  blob: Blob;
  width: number;
  height: number;
  duration: number;
  frameCount: number;
  format: VideoExportFormat;
  fileName: string;
}

export interface VideoFormatCapability {
  supported: boolean;
  codec: 'vp9' | 'vp8' | 'avc' | null;
  reason?: string;
}

export interface VideoExportCapabilities {
  webm: VideoFormatCapability;
  mp4: VideoFormatCapability;
}

export interface VideoExportCapabilityOptions {
  transparent?: boolean;
  width?: number;
  height?: number;
}
