import path from 'path';
import fs from 'fs';

import {
  ensureDirectory,
  safeUnlink,
  readJsonFile,
  writeJsonFile,
  isDirectoryEmpty
} from '../infra/file-system.js';
import {
  sanitizeProjectName,
  toProjectAbsolutePath,
  toProjectRelativePath,
  normalizeSections,
  createDefaultProject,
  normalizeProjectData
} from '../../shared/domain/project.js';

import type { Project, Section } from '../../shared/types/domain.js';
import type {
  ProjectCreateOptions,
  ProjectCreateResult,
  ProjectOpenResult,
  ProjectSavePayload,
  ProjectSaveResult,
  RecoveryTake,
  RecoveryTakePayload,
  RecoveryTakeResult,
  RecentProjectsResult,
  RecentProjectListEntry,
  CleanupResult
} from '../../shared/types/services.js';

// ── Constants ─────────────────────────────────────────────────────────

export const PROJECT_FILE_NAME = 'project.json';
export const PROJECT_META_FILE_NAME = 'projects-meta.json';
export const PROJECT_RECOVERY_FILE_NAME = '.pending-recording.json';
export const MAX_RECENT_PROJECTS = 20;

// ── Minimal app interface (avoids coupling to Electron types) ────────

interface AppLike {
  getPath: (name: string) => string;
}

// ── Internal metadata shape ──────────────────────────────────────────

interface ProjectMeta {
  lastProjectPath: string | null;
  recentProjectPaths: string[];
}

// ── Factory ──────────────────────────────────────────────────────────

export function createProjectService({ app }: { app: AppLike }) {
  function getProjectFilePath(projectFolder: string): string {
    return path.join(projectFolder, PROJECT_FILE_NAME);
  }

  function getProjectRecoveryFilePath(projectFolder: string): string {
    return path.join(projectFolder, PROJECT_RECOVERY_FILE_NAME);
  }

  function getProjectMetaFilePath(): string {
    return path.join(app.getPath('userData'), PROJECT_META_FILE_NAME);
  }

  function normalizeRecoveryTake(
    rawTake: unknown,
    projectFolder: string
  ): RecoveryTake | null {
    if (!rawTake || typeof rawTake !== 'object') return null;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = rawTake as Record<string, any>;

    const screenPath = projectFolder
      ? toProjectAbsolutePath(projectFolder, raw.screenPath)
      : (raw.screenPath as string) || null;
    const cameraPath = projectFolder
      ? toProjectAbsolutePath(projectFolder, raw.cameraPath)
      : (raw.cameraPath as string) || null;
    const recordedDuration = Number(raw.recordedDuration);
    const sections: Section[] = normalizeSections(raw.sections);
    const trimSegments: Array<{ start: number; end: number; text: string }> =
      Array.isArray(raw.trimSegments)
        ? (raw.trimSegments as unknown[])
            .map((segment) => {
              const seg = segment as Record<string, unknown> | null | undefined;
              const start = Number(seg?.start);
              const end = Number(seg?.end);
              if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
              return {
                start,
                end,
                text: typeof seg?.text === 'string' ? seg.text.trim() : ''
              };
            })
            .filter(
              (v): v is { start: number; end: number; text: string } => v !== null
            )
        : [];

    if (!screenPath || !fs.existsSync(screenPath)) return null;
    if (cameraPath && !fs.existsSync(cameraPath)) return null;

    return {
      id:
        typeof raw.id === 'string' && raw.id
          ? raw.id
          : `recovery-${Date.now()}`,
      createdAt:
        typeof raw.createdAt === 'string'
          ? raw.createdAt
          : new Date().toISOString(),
      screenPath,
      cameraPath,
      recordedDuration: Number.isFinite(recordedDuration) ? recordedDuration : 0,
      sections,
      trimSegments
    };
  }

  function readRecoveryTake(projectFolder: string): RecoveryTake | null {
    const filePath = getProjectRecoveryFilePath(projectFolder);
    const raw = readJsonFile(filePath, null);
    const normalized = normalizeRecoveryTake(raw, projectFolder);
    if (!raw) return null;
    if (normalized) return normalized;
    safeUnlink(filePath);
    return null;
  }

  function writeRecoveryTake(
    projectFolder: string,
    rawTake: unknown
  ): RecoveryTake {
    const normalized = normalizeRecoveryTake(rawTake, projectFolder);
    if (!normalized) throw new Error('Invalid recovery recording');

    const serializable = {
      ...normalized,
      screenPath: toProjectRelativePath(projectFolder, normalized.screenPath),
      cameraPath: toProjectRelativePath(projectFolder, normalized.cameraPath)
    };
    writeJsonFile(getProjectRecoveryFilePath(projectFolder), serializable);
    return normalized;
  }

  function clearRecoveryTake(projectFolder: string): void {
    safeUnlink(getProjectRecoveryFilePath(projectFolder));
  }

  function completeRecoveryTake(projectFolder: string): void {
    clearRecoveryTake(projectFolder);
  }

  function resolveAvailableProjectFolder(targetFolder: string): string {
    const resolvedTarget = path.resolve(targetFolder);
    if (!fs.existsSync(resolvedTarget)) return resolvedTarget;

    if (!fs.statSync(resolvedTarget).isDirectory()) {
      throw new Error('Project location must be a folder');
    }

    if (
      isDirectoryEmpty(resolvedTarget) &&
      !fs.existsSync(getProjectFilePath(resolvedTarget))
    ) {
      return resolvedTarget;
    }

    const parentFolder = path.dirname(resolvedTarget);
    const baseName = path.basename(resolvedTarget);
    let candidate = resolvedTarget;
    let suffix = 2;
    while (fs.existsSync(candidate)) {
      candidate = path.join(parentFolder, `${baseName} ${suffix}`);
      suffix += 1;
    }
    return candidate;
  }

  function saveProjectToDisk(
    projectFolder: string,
    rawProject: unknown
  ): Project {
    const normalized = normalizeProjectData(rawProject, projectFolder);
    normalized.updatedAt = new Date().toISOString();

    const serializable = JSON.parse(JSON.stringify(normalized)) as Project;
    serializable.takes = serializable.takes.map((take) => ({
      ...take,
      screenPath: toProjectRelativePath(projectFolder, take.screenPath),
      cameraPath: toProjectRelativePath(projectFolder, take.cameraPath),
      mousePath: toProjectRelativePath(projectFolder, take.mousePath),
      proxyPath: toProjectRelativePath(projectFolder, take.proxyPath)
    }));

    writeJsonFile(getProjectFilePath(projectFolder), serializable);
    return normalized;
  }

  function loadProjectFromDisk(projectFolder: string): Project {
    const resolvedFolder = path.resolve(projectFolder);
    const rawProject = readJsonFile(getProjectFilePath(resolvedFolder), null);
    if (!rawProject) {
      throw new Error(
        `Project file missing at ${getProjectFilePath(resolvedFolder)}`
      );
    }
    return normalizeProjectData(rawProject, resolvedFolder);
  }

  function readProjectMeta(): ProjectMeta {
    const fallback = { lastProjectPath: null, recentProjectPaths: [] };
    const raw = readJsonFile<ProjectMeta>(getProjectMetaFilePath(), fallback);
    const recentProjectPaths = Array.isArray(raw?.recentProjectPaths)
      ? raw!.recentProjectPaths.filter(
          (projectPath: unknown) =>
            typeof projectPath === 'string' && (projectPath as string).trim()
        )
      : [];

    return {
      lastProjectPath:
        typeof raw?.lastProjectPath === 'string' ? raw.lastProjectPath : null,
      recentProjectPaths: [...new Set(recentProjectPaths)].slice(
        0,
        MAX_RECENT_PROJECTS
      )
    };
  }

  function writeProjectMeta(meta: ProjectMeta): void {
    writeJsonFile(getProjectMetaFilePath(), meta);
  }

  function touchRecentProject(projectFolder: string): void {
    const resolvedFolder = path.resolve(projectFolder);
    const meta = readProjectMeta();
    const remaining = meta.recentProjectPaths.filter(
      (projectPath) =>
        projectPath !== resolvedFolder &&
        fs.existsSync(getProjectFilePath(projectPath))
    );
    meta.recentProjectPaths = [resolvedFolder, ...remaining].slice(
      0,
      MAX_RECENT_PROJECTS
    );
    meta.lastProjectPath = resolvedFolder;
    writeProjectMeta(meta);
  }

  function listRecentProjects(limit: number = 10): RecentProjectsResult {
    const meta = readProjectMeta();
    const projects: RecentProjectListEntry[] = [];
    const maxItems = Math.max(1, Number(limit) || 10);

    for (const projectFolder of meta.recentProjectPaths) {
      try {
        if (!fs.existsSync(getProjectFilePath(projectFolder))) continue;
        const project = loadProjectFromDisk(projectFolder);
        projects.push({
          projectPath: projectFolder,
          id: project.id,
          name: project.name,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt
        });
        if (projects.length >= maxItems) break;
      } catch (error) {
        console.error(
          `Failed to read recent project at ${projectFolder}:`,
          error
        );
      }
    }

    const lastProjectPath =
      typeof meta.lastProjectPath === 'string' &&
      fs.existsSync(getProjectFilePath(meta.lastProjectPath))
        ? meta.lastProjectPath
        : null;

    return { lastProjectPath, projects };
  }

  function createProject(opts: ProjectCreateOptions = {}): ProjectCreateResult {
    const baseName = sanitizeProjectName(opts.name || 'Untitled Project');
    const explicitProjectPath =
      typeof opts.projectPath === 'string' ? opts.projectPath.trim() : '';

    let targetFolder: string;
    if (explicitProjectPath) {
      targetFolder = path.resolve(explicitProjectPath);
      const parentFolder = path.dirname(targetFolder);
      ensureDirectory(parentFolder);
      targetFolder = resolveAvailableProjectFolder(targetFolder);
    } else {
      const parentFolder =
        typeof opts.parentFolder === 'string' ? opts.parentFolder : '';
      if (!parentFolder) throw new Error('Missing parent folder');
      const resolvedParent = path.resolve(parentFolder);
      ensureDirectory(resolvedParent);
      targetFolder = resolveAvailableProjectFolder(
        path.join(resolvedParent, baseName)
      );
    }

    if (
      fs.existsSync(targetFolder) &&
      !fs.statSync(targetFolder).isDirectory()
    ) {
      throw new Error('Project location must be a folder');
    }

    ensureDirectory(targetFolder);
    const project = saveProjectToDisk(
      targetFolder,
      createDefaultProject(path.basename(targetFolder))
    );
    touchRecentProject(targetFolder);
    return { projectPath: targetFolder, project };
  }

  function openProject(projectFolder: string): ProjectOpenResult {
    if (typeof projectFolder !== 'string' || !projectFolder.trim()) {
      throw new Error('Missing project folder');
    }

    const resolvedFolder = path.resolve(projectFolder);
    const project = loadProjectFromDisk(resolvedFolder);
    const recoveryTake = readRecoveryTake(resolvedFolder);
    touchRecentProject(resolvedFolder);
    return { projectPath: resolvedFolder, project, recoveryTake };
  }

  function saveProject(payload: ProjectSavePayload): ProjectSaveResult {
    const projectPath =
      typeof payload.projectPath === 'string' ? payload.projectPath : '';
    if (!projectPath) throw new Error('Missing project path');

    const resolvedFolder = path.resolve(projectPath);
    ensureDirectory(resolvedFolder);
    const project = saveProjectToDisk(resolvedFolder, payload.project || {});
    touchRecentProject(resolvedFolder);
    return { projectPath: resolvedFolder, project };
  }

  function setRecoveryTake(
    payload: RecoveryTakePayload
  ): RecoveryTakeResult {
    const projectPath =
      typeof payload.projectPath === 'string' ? payload.projectPath : '';
    if (!projectPath) throw new Error('Missing project path');

    const resolvedFolder = path.resolve(projectPath);
    ensureDirectory(resolvedFolder);
    const recoveryTake = writeRecoveryTake(resolvedFolder, payload.take || {});
    touchRecentProject(resolvedFolder);
    return { projectPath: resolvedFolder, recoveryTake };
  }

  function clearRecoveryByProject(projectFolder: string): boolean {
    if (typeof projectFolder !== 'string' || !projectFolder.trim())
      return false;
    clearRecoveryTake(path.resolve(projectFolder));
    return true;
  }

  function completeRecoveryByProject(projectFolder: string): boolean {
    if (typeof projectFolder !== 'string' || !projectFolder.trim())
      return false;
    completeRecoveryTake(path.resolve(projectFolder));
    return true;
  }

  function loadLastProject(): ProjectOpenResult | null {
    const meta = readProjectMeta();
    const projectFolder = meta.lastProjectPath;
    if (
      !projectFolder ||
      !fs.existsSync(getProjectFilePath(projectFolder))
    )
      return null;

    try {
      const project = loadProjectFromDisk(projectFolder);
      const recoveryTake = readRecoveryTake(projectFolder);
      touchRecentProject(projectFolder);
      return { projectPath: projectFolder, project, recoveryTake };
    } catch (error) {
      console.error(
        `Failed to load last project at ${projectFolder}:`,
        error
      );
      return null;
    }
  }

  function setLastProject(projectFolder: string): boolean {
    if (typeof projectFolder !== 'string' || !projectFolder.trim())
      return false;
    touchRecentProject(path.resolve(projectFolder));
    return true;
  }

  function stageTakeFiles(
    projectPath: string,
    filePaths: string[]
  ): void {
    const resolvedProject = path.resolve(projectPath);
    const deletedDir = path.join(resolvedProject, '.deleted');
    ensureDirectory(deletedDir);
    for (const filePath of filePaths) {
      if (!filePath) continue;
      const resolved = path.isAbsolute(filePath)
        ? filePath
        : path.join(resolvedProject, filePath);
      if (!fs.existsSync(resolved)) continue;
      const dest = path.join(deletedDir, path.basename(resolved));
      fs.renameSync(resolved, dest);
    }
  }

  function unstageTakeFiles(
    projectPath: string,
    fileNames: string[]
  ): void {
    const resolvedProject = path.resolve(projectPath);
    const deletedDir = path.join(resolvedProject, '.deleted');
    if (!fs.existsSync(deletedDir)) return;
    for (const fileName of fileNames) {
      if (!fileName) continue;
      const src = path.join(deletedDir, fileName);
      if (!fs.existsSync(src)) continue;
      const dest = path.join(resolvedProject, fileName);
      fs.renameSync(src, dest);
    }
  }

  function cleanupDeletedFolder(projectPath: string): void {
    const resolvedProject = path.resolve(projectPath);
    const deletedDir = path.join(resolvedProject, '.deleted');
    if (!fs.existsSync(deletedDir)) return;
    fs.rmSync(deletedDir, { recursive: true, force: true });
  }

  function cleanupUnusedTakes(projectPath: string): CleanupResult {
    const resolvedProject = path.resolve(projectPath);
    const project = loadProjectFromDisk(resolvedProject);
    const rawTimeline = project.timeline || {};
    const sections: Section[] = Array.isArray(rawTimeline.sections)
      ? rawTimeline.sections
      : [];
    const savedSections: Section[] = Array.isArray(rawTimeline.savedSections)
      ? rawTimeline.savedSections
      : [];

    const referencedTakeIds = new Set<string>();
    for (const s of sections) {
      if (s.takeId) referencedTakeIds.add(s.takeId);
    }
    for (const s of savedSections) {
      if (s.takeId) referencedTakeIds.add(s.takeId);
    }

    const keptTakes = [];
    let removedCount = 0;
    for (const take of project.takes) {
      if (referencedTakeIds.has(take.id)) {
        keptTakes.push(take);
      } else {
        if (take.screenPath) safeUnlink(take.screenPath);
        if (take.cameraPath) safeUnlink(take.cameraPath);
        removedCount += 1;
      }
    }

    if (removedCount > 0) {
      project.takes = keptTakes;
      saveProjectToDisk(resolvedProject, project);
    }

    cleanupDeletedFolder(resolvedProject);
    return { removedCount };
  }

  function importOverlayMedia(
    projectPath: string,
    sourcePath: string
  ): string {
    const resolvedProject = path.resolve(projectPath);
    const overlayDir = path.join(resolvedProject, 'overlay-media');
    ensureDirectory(overlayDir);

    // Check if an identical file already exists in overlay-media/
    const sourceSize = fs.statSync(sourcePath).size;
    const sourceContent = fs.readFileSync(sourcePath);
    const existing = fs.readdirSync(overlayDir);
    for (const fileName of existing) {
      const candidate = path.join(overlayDir, fileName);
      try {
        if (fs.statSync(candidate).size !== sourceSize) continue;
        if (Buffer.compare(sourceContent, fs.readFileSync(candidate)) === 0) {
          return `overlay-media/${fileName}`;
        }
      } catch (_) {
        /* skip unreadable files */
      }
    }

    const ext = path.extname(sourcePath).toLowerCase();
    const baseName = path.basename(sourcePath, ext);
    const destName = `${baseName}-${Date.now()}${ext}`;
    const destPath = path.join(overlayDir, destName);
    fs.copyFileSync(sourcePath, destPath);
    return `overlay-media/${destName}`;
  }

  function importAudioOverlayMedia(
    projectPath: string,
    sourcePath: string
  ): { mediaPath: string; duration: number } {
    const resolvedProject = path.resolve(projectPath);
    const audioDir = path.join(resolvedProject, 'audio-overlay-media');
    ensureDirectory(audioDir);

    // Check if an identical file already exists
    const sourceSize = fs.statSync(sourcePath).size;
    const sourceContent = fs.readFileSync(sourcePath);
    const existing = fs.readdirSync(audioDir);
    for (const fileName of existing) {
      const candidate = path.join(audioDir, fileName);
      try {
        if (fs.statSync(candidate).size !== sourceSize) continue;
        if (Buffer.compare(sourceContent, fs.readFileSync(candidate)) === 0) {
          return { mediaPath: `audio-overlay-media/${fileName}`, duration: 0 };
        }
      } catch (_) {
        /* skip unreadable files */
      }
    }

    const ext = path.extname(sourcePath).toLowerCase();
    const baseName = path.basename(sourcePath, ext);
    const destName = `${baseName}-${Date.now()}${ext}`;
    const destPath = path.join(audioDir, destName);
    fs.copyFileSync(sourcePath, destPath);
    return { mediaPath: `audio-overlay-media/${destName}`, duration: 0 };
  }

  function stageAudioOverlayFile(
    projectPath: string,
    mediaPath: string
  ): void {
    const resolvedProject = path.resolve(projectPath);
    const srcPath = path.join(resolvedProject, mediaPath);
    if (!fs.existsSync(srcPath)) return;
    const deletedDir = path.join(
      resolvedProject,
      '.deleted',
      'audio-overlay-media'
    );
    ensureDirectory(deletedDir);
    const dest = path.join(deletedDir, path.basename(srcPath));
    fs.renameSync(srcPath, dest);
  }

  function unstageAudioOverlayFile(
    projectPath: string,
    mediaPath: string
  ): void {
    const resolvedProject = path.resolve(projectPath);
    const fileName = path.basename(mediaPath);
    const src = path.join(
      resolvedProject,
      '.deleted',
      'audio-overlay-media',
      fileName
    );
    if (!fs.existsSync(src)) return;
    const audioDir = path.join(resolvedProject, 'audio-overlay-media');
    ensureDirectory(audioDir);
    const dest = path.join(audioDir, fileName);
    fs.renameSync(src, dest);
  }

  function stageOverlayFile(
    projectPath: string,
    mediaPath: string
  ): void {
    const resolvedProject = path.resolve(projectPath);
    const srcPath = path.join(resolvedProject, mediaPath);
    if (!fs.existsSync(srcPath)) return;
    const deletedDir = path.join(
      resolvedProject,
      '.deleted',
      'overlay-media'
    );
    ensureDirectory(deletedDir);
    const dest = path.join(deletedDir, path.basename(srcPath));
    fs.renameSync(srcPath, dest);
  }

  function unstageOverlayFile(
    projectPath: string,
    mediaPath: string
  ): void {
    const resolvedProject = path.resolve(projectPath);
    const fileName = path.basename(mediaPath);
    const src = path.join(
      resolvedProject,
      '.deleted',
      'overlay-media',
      fileName
    );
    if (!fs.existsSync(src)) return;
    const overlayDir = path.join(resolvedProject, 'overlay-media');
    ensureDirectory(overlayDir);
    const dest = path.join(overlayDir, fileName);
    fs.renameSync(src, dest);
  }

  function saveMouseTrail(
    projectPath: string,
    suffix: string,
    trailData: unknown
  ): string {
    const resolvedProject = path.resolve(projectPath);
    ensureDirectory(resolvedProject);
    const filename = `recording-${suffix}-mouse.json`;
    const filePath = path.join(resolvedProject, filename);
    writeJsonFile(filePath, trailData);
    return filename;
  }

  function saveVideo(
    buffer: Buffer | Uint8Array,
    folder: string,
    suffix?: string
  ): string {
    const filename = `recording-${Date.now()}${suffix ? `-${suffix}` : ''}.webm`;
    ensureDirectory(folder);
    const filePath = path.join(folder, filename);
    fs.writeFileSync(filePath, Buffer.from(buffer));
    return filePath;
  }

  return {
    sanitizeProjectName,
    getProjectFilePath,
    getProjectRecoveryFilePath,
    getProjectMetaFilePath,
    normalizeRecoveryTake,
    readRecoveryTake,
    writeRecoveryTake,
    clearRecoveryTake,
    completeRecoveryTake,
    resolveAvailableProjectFolder,
    saveProjectToDisk,
    loadProjectFromDisk,
    readProjectMeta,
    writeProjectMeta,
    touchRecentProject,
    listRecentProjects,
    createProject,
    openProject,
    saveProject,
    setRecoveryTake,
    clearRecoveryByProject,
    completeRecoveryByProject,
    loadLastProject,
    setLastProject,
    saveVideo,
    stageTakeFiles,
    unstageTakeFiles,
    cleanupDeletedFolder,
    cleanupUnusedTakes,
    importOverlayMedia,
    importAudioOverlayMedia,
    stageOverlayFile,
    unstageOverlayFile,
    stageAudioOverlayFile,
    unstageAudioOverlayFile,
    saveMouseTrail
  };
}
