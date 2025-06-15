/**
 * Data Persistence Module
 * Handles all file system operations and data management
 */

import fs from "fs/promises";
import path from "path";

export class DataPersistence {
  constructor(dataDir) {
    this.dataDir = dataDir;
  }

  getProjectDir(projectId) {
    const projectDir = path.join(this.dataDir, "projects", projectId);
    console.error(
      `DEBUG getProjectDir: dataDir=${this.dataDir}, projectId=${projectId}, result=${projectDir}`,
    );
    return projectDir;
  }

  getPathDir(projectId, pathName) {
    return path.join(this.dataDir, "projects", projectId, "paths", pathName);
  }

  async loadProjectData(projectId, filename) {
    try {
      const filePath = path.join(this.getProjectDir(projectId), filename);

      // Check if file exists first
      try {
        await fs.access(filePath);
      } catch {
        return null;
      }

      const data = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(data);

      // PROJECT ISOLATION: Validate data belongs to requested project
      if (parsed.id && parsed.id !== projectId) {
        throw new Error(
          `Data integrity violation: File contains project "${parsed.id}" but requested "${projectId}"`,
        );
      }
      if (parsed.project_id && parsed.project_id !== projectId) {
        throw new Error(
          `Data integrity violation: File contains project_id "${parsed.project_id}" but requested "${projectId}"`,
        );
      }

      return parsed;
    } catch (error) {
      await this.logError("loadProjectData", error, { projectId, filename });
      return null;
    }
  }

  async saveProjectData(projectId, filename, data) {
    try {
      const projectDir = this.getProjectDir(projectId);
      await fs.mkdir(projectDir, { recursive: true });
      const filePath = path.join(projectDir, filename);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      await this.logError("saveProjectData", error, { projectId, filename });
      return false;
    }
  }

  async loadPathData(projectId, pathName, filename) {
    try {
      const filePath = path.join(
        this.getPathDir(projectId, pathName),
        filename,
      );

      // Check if file exists first
      try {
        await fs.access(filePath);
      } catch {
        return null;
      }

      const data = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(data);

      // PROJECT ISOLATION: Validate data belongs to requested project
      if (parsed.project_id && parsed.project_id !== projectId) {
        throw new Error(
          `Data integrity violation: Path data contains project_id "${parsed.project_id}" but requested "${projectId}"`,
        );
      }
      if (parsed.path_name && parsed.path_name !== pathName) {
        throw new Error(
          `Data integrity violation: Path data contains path_name "${parsed.path_name}" but requested "${pathName}"`,
        );
      }

      return parsed;
    } catch (error) {
      await this.logError("loadPathData", error, {
        projectId,
        pathName,
        filename,
      });
      return null;
    }
  }

  async savePathData(projectId, pathName, filename, data) {
    try {
      const pathDir = this.getPathDir(projectId, pathName);
      await fs.mkdir(pathDir, { recursive: true });
      const filePath = path.join(pathDir, filename);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      await this.logError("savePathData", error, {
        projectId,
        pathName,
        filename,
      });
      return false;
    }
  }

  async loadGlobalData(filename) {
    try {
      const filePath = path.join(this.dataDir, filename);
      const data = await fs.readFile(filePath, "utf8");
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async saveGlobalData(filename, data) {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const filePath = path.join(this.dataDir, filename);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      return true;
    } catch (error) {
      await this.logError("saveGlobalData", error, { filename });
      return false;
    }
  }

  async logError(operation, error, context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      operation,
      error: error.message,
      stack: error.stack,
      context,
    };

    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      const logPath = path.join(this.dataDir, "error.log");
      await fs.appendFile(logPath, JSON.stringify(logEntry) + "\n");
    } catch {
      // If we can't log the error, just console.error it
      console.error("Failed to log error:", logEntry);
    }
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
      return true;
    } catch (error) {
      await this.logError("ensureDirectoryExists", error, { dirPath });
      return false;
    }
  }

  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(filePath) {
    try {
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      await this.logError("deleteFile", error, { filePath });
      return false;
    }
  }

  async listFiles(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      return files;
    } catch (error) {
      await this.logError("listFiles", error, { dirPath });
      return [];
    }
  }

  async copyFile(sourcePath, destPath) {
    try {
      await fs.copyFile(sourcePath, destPath);
      return true;
    } catch (error) {
      await this.logError("copyFile", error, { sourcePath, destPath });
      return false;
    }
  }
}
