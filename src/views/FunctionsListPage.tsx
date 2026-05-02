import {
  DocumentTitle,
  K8sResourceKind,
  ListPageHeader,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Button,
  Content,
  ContentVariants,
  PageSection,
  Spinner,
} from '@patternfly/react-core';
import { useContext, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom-v5-compat';
import { FunctionsEmptyState } from '../components/EmptyState';
import { FunctionStatus, FunctionTable, FunctionTableItem } from '../components/FunctionTable';
import { UserAvatar } from '../components/UserAvatar';
import {
  ForgeConnectionContext,
  ForgeConnectionProvider,
} from '../context/ForgeConnectionProvider';
import { useClusterService } from '../services/cluster/useClusterService';
import { useSourceControlService } from '../services/source-control/useSourceControlService';
import { RepoMetadata } from '../services/types';
import { errorMessage, parseNamespaceAndRuntime } from '../utils/utils';

export default function FunctionsListPage() {
  return (
    <ForgeConnectionProvider>
      <FunctionsListPageContent />
    </ForgeConnectionProvider>
  );
}

function FunctionsListPageContent() {
  const { t } = useTranslation('plugin__console-functions-plugin');
  const { functions, loaded, onEdit, isConnectedToForge, error } = useFunctionListPage();

  return (
    <>
      <DocumentTitle>{t('Functions')}</DocumentTitle>
      <ListPageHeader title={t('Functions')}>
        <UserAvatar enableReconnect />
      </ListPageHeader>
      <PageSection>
        {error && (
          <Alert variant="danger" title={t('Error listing functions')} isInline>
            {error}
          </Alert>
        )}
        {!loaded && (
          <Spinner aria-label={t('Loading')} style={{ display: 'block', margin: '4rem auto' }} />
        )}
        {loaded && functions.length === 0 && (
          <FunctionsEmptyState isCreateDisabled={!isConnectedToForge} />
        )}
        {loaded && functions.length > 0 && (
          <>
            <Content component={ContentVariants.p}>
              {t(
                'Serverless functions in your repository and deployed to your cluster. Manage lifecycle, monitor status, and scale on demand.',
              )}
            </Content>
            <Content component={ContentVariants.p}>
              {!isConnectedToForge ? (
                <Button variant="primary" isDisabled>
                  {t('Create new function')}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  component={(props) => <Link {...props} to="/faas/create" />}
                >
                  {t('Create new function')}
                </Button>
              )}
            </Content>
            <FunctionTable functions={functions} onEdit={onEdit} />
          </>
        )}
      </PageSection>
    </>
  );
}

function useFunctionListPage(): {
  functions: FunctionTableItem[];
  loaded: boolean;
  onEdit: (name: string) => void;
  isConnectedToForge: boolean;
  error: string;
} {
  const isConnectedToForge = useContext(ForgeConnectionContext).isActive;
  const sourceControl = useSourceControlService();
  const { deployments, loaded: clusterLoaded } = useClusterService();
  const navigate = useNavigate();

  const [functionItems, setFunctionItems] = useState<FunctionTableItem[]>([]);
  const [reposLoaded, setReposLoaded] = useState(!isConnectedToForge);
  const [wasConnectedToForge, setWasConnectedToForge] = useState(isConnectedToForge);

  const [error, setError] = useState<string>('');

  // Reset state when authentication status changes (render-time adjustment)
  if (isConnectedToForge !== wasConnectedToForge) {
    setWasConnectedToForge(isConnectedToForge);
    setError('');
    if (isConnectedToForge) {
      setReposLoaded(false);
    } else {
      setFunctionItems([]);
      setReposLoaded(true);
    }
  }

  useEffect(() => {
    if (!isConnectedToForge) return;

    let ignore = false;

    async function loadFunctionTableItems() {
      let repos: RepoMetadata[];
      let items: FunctionTableItem[];
      try {
        repos = await sourceControl.listFunctionRepos();
        items = await Promise.all(
          repos.map(async (repo) => {
            const funcYaml = await sourceControl.fetchFileContent(repo, 'func.yaml');
            const { namespace, runtime } = parseNamespaceAndRuntime(funcYaml);
            return newItem(repo.name, namespace, runtime);
          }),
        );
      } catch (err) {
        if (!ignore) {
          setReposLoaded(true);
          setError(errorMessage(err));
        }
        return;
      }
      if (ignore) return;

      setFunctionItems(items);
      setReposLoaded(true);
      setError('');
    }

    loadFunctionTableItems();
    return () => {
      ignore = true;
    };
  }, [sourceControl, isConnectedToForge]);

  const functions = useMemo(
    () =>
      functionItems.map((item) => {
        const deployment = deployments.find(
          (d) => d.metadata?.labels?.['function.knative.dev/name'] === item.name,
        );
        return deployment ? enrichItem(item, deployment) : item;
      }),
    [functionItems, deployments],
  );

  const loaded = reposLoaded && clusterLoaded;

  const onEdit = (name: string) => navigate(`/faas/edit/${name}`);
  return { functions, loaded, onEdit, isConnectedToForge, error };
}

function newItem(repoName: string, namespace: string, runtime: string): FunctionTableItem {
  return {
    name: repoName,
    namespace,
    runtime,
    status: 'NotDeployed' as const,
    replicas: 0,
  };
}

function enrichItem(item: FunctionTableItem, deployment: K8sResourceKind): FunctionTableItem {
  return {
    ...item,
    status: deriveStatus(deployment),
    url: `http://${item.name}.${deployment.metadata?.namespace}.svc`,
    replicas: deployment.status?.readyReplicas ?? 0,
    deployment,
  };
}

function deriveStatus(deployment: K8sResourceKind): FunctionStatus {
  const desired = deployment.spec?.replicas ?? 0;
  const ready = deployment.status?.readyReplicas ?? 0;
  const conditions = deployment.status?.conditions ?? [];

  const hasFailed = conditions.some(
    (c: { type: string; status: string }) => c.type === 'Available' && c.status === 'False',
  );
  if (hasFailed) return 'Error';

  if (ready === desired && desired > 0) return 'Running';
  if (ready === 0 && desired === 0) return 'ScaledToZero';
  if (ready < desired) return 'Deploying';

  return 'Unknown';
}
