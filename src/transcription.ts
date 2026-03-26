import path from 'path';
import { execFile } from 'child_process';

import { logger } from './logger.js';

const VENV_PYTHON = path.join(
  process.cwd(),
  'data',
  'whisper-venv',
  'bin',
  'python3',
);
const SCRIPT = path.join(process.cwd(), 'scripts', 'transcribe.py');
const MODEL_SIZE = process.env.WHISPER_MODEL || 'small';
const TIMEOUT_MS = 120_000; // 2 minutes max for transcription

interface TranscriptionResult {
  text: string;
  language: string;
  language_probability: number;
  duration: number;
}

export function transcribeAudio(audioPath: string): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(
      VENV_PYTHON,
      [SCRIPT, audioPath, MODEL_SIZE],
      { timeout: TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (err) {
          logger.warn({ err, stderr, audioPath }, 'Transcription failed');
          resolve(null);
          return;
        }

        try {
          const result: TranscriptionResult = JSON.parse(stdout.trim());
          if ('error' in result) {
            logger.warn(
              { error: (result as any).error, audioPath },
              'Transcription error',
            );
            resolve(null);
            return;
          }
          logger.info(
            {
              audioPath,
              language: result.language,
              probability: result.language_probability,
              duration: result.duration,
              length: result.text.length,
            },
            'Transcribed voice message',
          );
          resolve(result.text || null);
        } catch (parseErr) {
          logger.warn(
            { parseErr, stdout, audioPath },
            'Failed to parse transcription output',
          );
          resolve(null);
        }
      },
    );
  });
}
