import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  atomicWriteFileSync,
  ensureDirectory,
  isDirectoryEmpty,
  readJsonFile,
  safeUnlink,
  writeJsonFile
} from '../../src/main/infra/file-system';

describe('main/infra/file-system', () => {
  test('writeJsonFile and readJsonFile round-trip data', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'video-fs-test-'));
    const file = path.join(root, 'nested', 'data.json');
    writeJsonFile(file, { ok: true, count: 3 });
    const result = readJsonFile(file, null);
    expect(result).toEqual({ ok: true, count: 3 });
  });

  test('ensureDirectory creates folders recursively', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'video-fs-dir-'));
    const folder = path.join(root, 'a', 'b', 'c');
    ensureDirectory(folder);
    expect(fs.existsSync(folder)).toBe(true);
  });

  test('isDirectoryEmpty and safeUnlink behave safely', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'video-fs-empty-'));
    const file = path.join(root, 'file.txt');
    expect(isDirectoryEmpty(root)).toBe(true);
    fs.writeFileSync(file, 'x', 'utf8');
    expect(isDirectoryEmpty(root)).toBe(false);
    safeUnlink(file);
    expect(fs.existsSync(file)).toBe(false);
  });

  test('atomicWriteFileSync writes text files without leaving temp artifacts', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'video-fs-atomic-'));
    const file = path.join(root, 'data.txt');
    atomicWriteFileSync(file, 'hello world', 'utf8');
    expect(fs.readFileSync(file, 'utf8')).toBe('hello world');
    // No leftover temp files
    const files = fs.readdirSync(root);
    expect(files).toEqual(['data.txt']);
  });

  test('atomicWriteFileSync writes binary buffers with correct size', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'video-fs-atomic-bin-'));
    const file = path.join(root, 'recording.webm');
    const data = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x00, 0xff]);
    atomicWriteFileSync(file, data);
    const written = fs.readFileSync(file);
    expect(written.length).toBe(data.length);
    expect(Buffer.compare(written, data)).toBe(0);
  });

  test('atomicWriteFileSync creates parent directories', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'video-fs-atomic-nested-'));
    const file = path.join(root, 'a', 'b', 'deep.json');
    atomicWriteFileSync(file, '{"nested":true}', 'utf8');
    expect(fs.readFileSync(file, 'utf8')).toBe('{"nested":true}');
  });

  test('atomicWriteFileSync replaces existing file atomically', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'video-fs-atomic-replace-'));
    const file = path.join(root, 'project.json');
    fs.writeFileSync(file, 'original', 'utf8');
    atomicWriteFileSync(file, 'updated', 'utf8');
    expect(fs.readFileSync(file, 'utf8')).toBe('updated');
    const files = fs.readdirSync(root);
    expect(files).toEqual(['project.json']);
  });

  test('writeJsonFile uses atomic writes under the hood', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'video-fs-json-atomic-'));
    const file = path.join(root, 'config.json');
    writeJsonFile(file, { version: 1 });
    expect(readJsonFile(file, null)).toEqual({ version: 1 });
    // Overwrite — old data must be fully replaced, not corrupted
    writeJsonFile(file, { version: 2, extra: 'field' });
    expect(readJsonFile(file, null)).toEqual({ version: 2, extra: 'field' });
    const files = fs.readdirSync(root);
    expect(files).toEqual(['config.json']);
  });
});
