import { FileEntry, ForgeUser, RepoMetadata } from '../types';

export interface SourceControlService {
  listFunctionRepos(): Promise<RepoMetadata[]>;
  fetchFileContent(repo: RepoMetadata, path: string): Promise<string>;
  createRepo(repo: RepoMetadata, files: FileEntry[], message: string): Promise<void>;
  updateRepo(repo: RepoMetadata, files: FileEntry[], message: string): Promise<void>;
  fetch(repo: RepoMetadata): Promise<FileEntry[]>;
  fetchUserInfo(pat: string): Promise<ForgeUser>;
}
