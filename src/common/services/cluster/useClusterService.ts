import { K8sResourceKind, useK8sWatchResource } from '@openshift-console/dynamic-plugin-sdk';
import { useMemo } from 'react';
import { K8sKeyedResource } from '../types';
import { OcpClusterService } from './OcpClusterService';

const instance = new OcpClusterService();

const FUNCTION_NAME_LABEL = 'function.knative.dev/name';

interface ClusterService {
  knativeServices: K8sResourceKind[];
  deployments: K8sResourceKind[];
  secrets: K8sKeyedResource[];
  configMaps: K8sKeyedResource[];
  loaded: boolean;
  error: unknown;
  generateKubeconfig: (namespace: string) => Promise<string>;
}

function toKeyedResources(resources: K8sResourceKind[], loaded: boolean): K8sKeyedResource[] {
  if (!loaded) return [];
  return (resources ?? [])
    .filter((r) => r.metadata?.name)
    .map((r) => ({
      name: r.metadata!.name!,
      keys: r.data ? Object.keys(r.data) : [],
    }));
}

export function useClusterService(
  functionNames: string[] = [],
  namespace?: string,
): ClusterService {
  const knSvcConfig = useMemo(
    () =>
      functionNames.length > 0
        ? {
            groupVersionKind: { group: 'serving.knative.dev', version: 'v1', kind: 'Service' },
            isList: true,
            selector: {
              matchExpressions: [
                { key: FUNCTION_NAME_LABEL, operator: 'In', values: functionNames },
              ],
            },
          }
        : null,
    [functionNames],
  );

  const depConfig = useMemo(
    () =>
      functionNames.length > 0
        ? {
            groupVersionKind: { group: 'apps', version: 'v1', kind: 'Deployment' },
            isList: true,
            selector: {
              matchExpressions: [
                { key: FUNCTION_NAME_LABEL, operator: 'In', values: functionNames },
              ],
            },
          }
        : null,
    [functionNames],
  );

  const secretConfig = useMemo(
    () =>
      namespace
        ? {
            groupVersionKind: { version: 'v1', kind: 'Secret' },
            namespace,
            isList: true,
          }
        : null,
    [namespace],
  );

  const configMapConfig = useMemo(
    () =>
      namespace
        ? {
            groupVersionKind: { version: 'v1', kind: 'ConfigMap' },
            namespace,
            isList: true,
          }
        : null,
    [namespace],
  );

  const [knSvcs, knLoaded, knError] = useK8sWatchResource<K8sResourceKind[]>(knSvcConfig);
  const [deps, depLoaded, depError] = useK8sWatchResource<K8sResourceKind[]>(depConfig);
  const [rawSecrets, secretLoaded, secretError] =
    useK8sWatchResource<K8sResourceKind[]>(secretConfig);
  const [rawConfigMaps, cmLoaded, cmError] =
    useK8sWatchResource<K8sResourceKind[]>(configMapConfig);

  const secrets = useMemo(
    () => toKeyedResources(rawSecrets, secretLoaded),
    [rawSecrets, secretLoaded],
  );
  const configMaps = useMemo(
    () => toKeyedResources(rawConfigMaps, cmLoaded),
    [rawConfigMaps, cmLoaded],
  );

  return {
    knativeServices: knLoaded ? (knSvcs ?? []) : [],
    deployments: depLoaded ? (deps ?? []) : [],
    secrets,
    configMaps,
    loaded: knLoaded && depLoaded && secretLoaded && cmLoaded,
    error: knError || depError || secretError || cmError,
    generateKubeconfig: instance.generateKubeconfig.bind(instance),
  };
}
