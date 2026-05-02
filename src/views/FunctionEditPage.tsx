import { CodeEditor, DocumentTitle, ListPageHeader } from '@openshift-console/dynamic-plugin-sdk';
import { Language } from '@patternfly/react-code-editor';
import {
  Alert,
  Button,
  EmptyState,
  EmptyStateBody,
  Flex,
  FlexItem,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  PageSection,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { ArrowLeftIcon, CodeIcon } from '@patternfly/react-icons';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom-v5-compat';
import { FileTreeView } from '../components/FileTreeView';
import { UserAvatar } from '../components/UserAvatar';
import { ForgeConnectionProvider } from '../context/ForgeConnectionProvider';
import { SourceControlService } from '../services/source-control/SourceControlService';
import { useSourceControlService } from '../services/source-control/useSourceControlService';
import { FileEntry, RepoMetadata } from '../services/types';
import { getLanguageFromPath, handlerMap, parseNamespaceAndRuntime } from '../utils/utils';

// --- page component ---

export default function FunctionEditPage() {
  return (
    <ForgeConnectionProvider>
      <FunctionEditPageContent />
    </ForgeConnectionProvider>
  );
}

function FunctionEditPageContent() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const state = useFunctionEditPage();

  return (
    <>
      <DocumentTitle>{t('Edit function')}</DocumentTitle>
      <ListPageHeader title={`${t('Edit function')}`}>
        <UserAvatar enableReconnect={false} />
      </ListPageHeader>
      <PageSection>
        <EditToolbar hasChanges={state.hasChanges} onSave={state.saveFiles} />
        <Flex
          direction={{ default: 'row' }}
          flexWrap={{ default: 'nowrap' }}
          alignItems={{ default: 'alignItemsStretch' }}
        >
          <FlexItem
            flex={{ default: 'flexNone' }}
            style={{ width: '16rem', overflowX: 'auto', overflowY: 'auto' }}
          >
            <FileTreeView
              files={state.files}
              selectedPath={state.selectedPath}
              dirtyPaths={state.dirtyPaths}
              isLoading={state.isLoading}
              onSelect={state.onFileSelect}
            />
          </FlexItem>
          <FlexItem grow={{ default: 'grow' }} style={{ minWidth: '32rem' }}>
            <CodeEditor
              value={state.selectedContent}
              language={state.selectedLanguage}
              onChange={state.onFileChange}
              height="70vh"
              showEditor={!!state.selectedPath}
              emptyState={
                <EmptyState icon={CodeIcon} titleText={t('Start editing')} variant="lg">
                  <EmptyStateBody>
                    {t('Select a file from the tree view to start editing.')}
                  </EmptyStateBody>
                </EmptyState>
              }
              isLanguageLabelVisible
            />
          </FlexItem>
        </Flex>
      </PageSection>
    </>
  );
}

// --- page hook ---

interface FunctionEditPageState {
  files: FileEntry[];
  selectedPath: string | null;
  selectedContent: string;
  selectedLanguage: Language;
  dirtyPaths: Set<string>;
  hasChanges: boolean;
  isLoading: boolean;
  repoMetadata: RepoMetadata | undefined;
  onFileSelect: (path: string) => void;
  onFileChange: (content: string) => void;
  saveFiles: () => Promise<void>;
}

function useFunctionEditPage(): FunctionEditPageState {
  const sourceControl = useSourceControlService();
  const { name: repoName } = useParams<{ name: string }>();

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [originalFiles, setOriginalFiles] = useState<FileEntry[]>([]);
  const [repoMetadata, setRepoMetadata] = useState<RepoMetadata>();
  const [selectedPath, setSelectedPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  const dirtyFiles = new Set(
    files
      // Guard: originalFiles is empty during initial render before fetch completes.
      .filter((f, i) => originalFiles[i] && f.content !== originalFiles[i].content)
      .map((f) => f.path),
  );
  const hasChanges = dirtyFiles.size > 0;

  const selectedFile = files.find((f) => f.path === selectedPath);
  const selectedContent = selectedFile?.content ?? '';
  const selectedLanguage = getLanguageFromPath(selectedPath);

  useEffect(() => {
    let ignore = false;

    async function loadFiles() {
      let repo: { content: FileEntry[]; metadata: RepoMetadata };
      try {
        // we ignore the error and show an empty tree if repo is not found
        repo = await resolveRepoContent(repoName!, sourceControl);
      } catch {
        if (!ignore) setIsLoading(false);
        return;
      }
      if (ignore) return;

      if (repo.content.length === 0) {
        setIsLoading(false);
        return;
      }

      setFiles(repo.content);
      // Shallow copy each entry so files and originalFiles hold
      // different object references. When onFileChange updates a
      // file's content via setFiles, the corresponding originalFiles
      // entry stays unchanged, enabling dirty comparison.
      setOriginalFiles(repo.content.map((f) => ({ ...f })));
      setRepoMetadata(repo.metadata);
      setSelectedPath(determineHandler(repo.content));
      setIsLoading(false);
    }

    loadFiles();
    return () => {
      ignore = true;
    };
  }, [repoName, sourceControl]);

  const onFileSelect = (path: string) => {
    setSelectedPath(path);
  };

  const onFileChange = (content: string) => {
    if (!selectedPath) return;
    setFiles((prev) => prev.map((f) => (f.path === selectedPath ? { ...f, content } : f)));
  };

  const saveFiles = async () => {
    if (!repoMetadata) return;
    await sourceControl.updateRepo(repoMetadata, files, 'Update function files');
    setOriginalFiles(files.map((f) => ({ ...f })));
  };

  return {
    files,
    selectedPath,
    selectedContent,
    selectedLanguage,
    dirtyPaths: dirtyFiles,
    hasChanges,
    isLoading,
    repoMetadata,
    onFileSelect,
    onFileChange,
    saveFiles,
  };
}

async function resolveRepoContent(
  repoName: string,
  sourceControl: SourceControlService,
): Promise<{ content: FileEntry[]; metadata: RepoMetadata }> {
  const repos = await sourceControl.listFunctionRepos();

  const repoMetadata = repos.find((r) => r.name === repoName);
  if (!repoMetadata) throw new Error(`repository ${repoName} not found`);

  return {
    content: await sourceControl.fetch(repoMetadata),
    metadata: repoMetadata,
  };
}

function determineHandler(loadedFiles: FileEntry[]): string {
  const funcYaml = loadedFiles.find((f) => f.path === 'func.yaml');
  if (!funcYaml) return '';

  const { runtime } = parseNamespaceAndRuntime(funcYaml.content);

  const handlerPath = handlerMap[runtime];
  if (loadedFiles.find((f) => f.path === handlerPath)) return handlerPath;
  return '';
}

// --- toolbar component ---

interface EditToolbarProps {
  hasChanges: boolean;
  onSave: () => Promise<void>;
}

function EditToolbar({ hasChanges, onSave }: EditToolbarProps) {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const {
    isSaving,
    errorMsg,
    successMsg,
    showLeaveModal,
    handleSave,
    handleBack,
    onLeaveConfirm,
    onLeaveCancel,
  } = useEditToolbar(hasChanges, onSave);

  return (
    <>
      <Toolbar>
        <ToolbarContent>
          <ToolbarItem>
            <Button variant="link" icon={<ArrowLeftIcon />} onClick={handleBack}>
              {t('Back to Functions')}
            </Button>
          </ToolbarItem>
          <ToolbarGroup align={{ default: 'alignCenter' }}>
            <ToolbarItem>
              {errorMsg && <Alert variant="danger" title={errorMsg} isInline isPlain />}
              {successMsg && <Alert variant="success" title={t(successMsg)} isInline isPlain />}
            </ToolbarItem>
          </ToolbarGroup>
          <ToolbarGroup align={{ default: 'alignEnd' }}>
            <ToolbarItem>
              <Button
                variant="primary"
                onClick={handleSave}
                isDisabled={isSaving || !hasChanges}
                isLoading={isSaving}
              >
                {t('Save & Deploy')}
              </Button>
            </ToolbarItem>
          </ToolbarGroup>
        </ToolbarContent>
      </Toolbar>
      <LeaveModal isOpen={showLeaveModal} onStay={onLeaveCancel} onLeave={onLeaveConfirm} />
    </>
  );
}

function useEditToolbar(
  hasChanges: boolean,
  onSave: () => Promise<void>,
): {
  isSaving: boolean;
  errorMsg: string;
  successMsg: string;
  showLeaveModal: boolean;
  handleSave: () => Promise<void>;
  handleBack: () => void;
  onLeaveConfirm: () => void;
  onLeaveCancel: () => void;
} {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');
  const [showLeaveModal, setShowLeaveModal] = useState(false);

  // Cleared on unmount to prevent state updates after navigation.
  const dismissTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => clearTimeout(dismissTimer.current);
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await onSave();
      setSuccessMsg('Pushed to GitHub. Deployment running...');
      dismissTimer.current = setTimeout(() => setSuccessMsg(''), 2000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleBack = () => {
    if (hasChanges) setShowLeaveModal(true);
    else navigate('/faas');
  };

  const onLeaveConfirm = () => {
    setShowLeaveModal(false);
    navigate('/faas');
  };

  const onLeaveCancel = () => {
    setShowLeaveModal(false);
  };

  return {
    isSaving,
    errorMsg,
    successMsg,
    showLeaveModal,
    handleSave,
    handleBack,
    onLeaveConfirm,
    onLeaveCancel,
  };
}

// --- leave modal component ---

function LeaveModal({
  isOpen,
  onStay,
  onLeave,
}: {
  isOpen: boolean;
  onStay: () => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation('plugin__console-functions-plugin');

  return (
    <Modal isOpen={isOpen} onClose={onStay} variant="small">
      <ModalHeader title={t('Unsaved changes')} />
      <ModalBody>{t('You have unsaved changes. Leave anyway?')}</ModalBody>
      <ModalFooter>
        <Button variant="primary" onClick={onStay}>
          {t('Stay')}
        </Button>
        <Button variant="link" onClick={onLeave}>
          {t('Leave')}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
