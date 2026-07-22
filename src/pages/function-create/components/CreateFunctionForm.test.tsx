import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  CreateFunctionForm,
  validateEnvVarName,
  findDuplicateEnvVarNames,
} from './CreateFunctionForm';
import { ForgeConnectionContext } from '../../../common/context/ForgeConnectionProvider';
import { ForgeUser } from '../../../common/services/types';

const testUser: ForgeUser = { name: 'testuser' };
const forgeContext = {
  isActive: true,
  user: testUser,
  connectionId: 0,
  connectToForge: vi.fn(),
};

function renderWithContext(ui: React.ReactElement) {
  return render(
    <ForgeConnectionContext.Provider value={forgeContext}>{ui}</ForgeConnectionContext.Provider>,
  );
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('@openshift-console/dynamic-plugin-sdk', () => ({
  useK8sWatchResource: () => [[], true, null],
}));

describe('validateEnvVarName', () => {
  it('returns null for a valid name', () => {
    expect(validateEnvVarName('API_KEY')).toBeNull();
  });

  it('returns null for names with dots, dashes, and underscores', () => {
    expect(validateEnvVarName('my.var')).toBeNull();
    expect(validateEnvVarName('my-var')).toBeNull();
    expect(validateEnvVarName('_PRIVATE')).toBeNull();
    expect(validateEnvVarName('.hidden')).toBeNull();
    expect(validateEnvVarName('-flag')).toBeNull();
  });

  it('returns an error for empty name', () => {
    expect(validateEnvVarName('')).toBe('Name is required');
  });

  it('returns an error for names starting with a digit', () => {
    expect(validateEnvVarName('1BAD')).toBe(
      'Must start with a letter, dot, dash, or underscore, followed by letters, digits, dots, dashes, or underscores',
    );
  });

  it('returns an error for names with invalid characters', () => {
    expect(validateEnvVarName('NO SPACES')).toBe(
      'Must start with a letter, dot, dash, or underscore, followed by letters, digits, dots, dashes, or underscores',
    );
    expect(validateEnvVarName('bad!')).toBe(
      'Must start with a letter, dot, dash, or underscore, followed by letters, digits, dots, dashes, or underscores',
    );
  });
});

describe('findDuplicateEnvVarNames', () => {
  it('returns empty set when no duplicates', () => {
    expect(findDuplicateEnvVarNames(['A', 'B', 'C'])).toEqual(new Set());
  });

  it('returns duplicate names', () => {
    expect(findDuplicateEnvVarNames(['A', 'B', 'A'])).toEqual(new Set(['A']));
  });

  it('ignores empty names', () => {
    expect(findDuplicateEnvVarNames(['', '', 'A'])).toEqual(new Set());
  });
});

describe('CreateFunctionForm', () => {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders all form fields', () => {
    renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    expect(screen.getByRole('textbox', { name: /Owner/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Repository/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Branch/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /^Name$/ })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: /Language/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Registry/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Namespace/ })).toBeInTheDocument();
  });

  it('presets owner from context and disables the field', () => {
    renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    const ownerInput = screen.getByRole('textbox', { name: /Owner/ });
    expect(ownerInput).toHaveValue('testuser');
    expect(ownerInput).toBeDisabled();
  });

  it('presets registry to OCP internal registry and disables the field', () => {
    renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    const registryInput = screen.getByRole('textbox', { name: /Registry/ });
    expect(registryInput).toHaveValue('image-registry.openshift-image-registry.svc:5000/');
    expect(registryInput).toBeDisabled();
  });

  it('updates registry to include namespace when namespace is typed', async () => {
    const user = userEvent.setup();

    renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    await user.type(screen.getByRole('textbox', { name: /Namespace/ }), 'my-ns');

    expect(screen.getByRole('textbox', { name: /Registry/ })).toHaveValue(
      'image-registry.openshift-image-registry.svc:5000/my-ns',
    );
  });

  it('renders Create and Cancel buttons', () => {
    renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    expect(screen.getByRole('button', { name: /Create/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
  });

  it('disables Create button when required fields are empty', () => {
    renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    expect(screen.getByRole('button', { name: /Create/ })).toBeDisabled();
  });

  it('disables Create button when isSubmitting is true', () => {
    renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={true} />,
    );

    expect(screen.getByRole('button', { name: /Create/ })).toBeDisabled();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup();

    renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    await user.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('calls onSubmit with form data when form is filled and Create is clicked', async () => {
    const user = userEvent.setup();

    renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    await user.type(screen.getByRole('textbox', { name: /Repository/ }), 'my-repo');
    await user.type(screen.getByRole('textbox', { name: /Branch/ }), 'main');
    await user.type(screen.getByRole('textbox', { name: /^Name$/ }), 'my-func');
    await user.type(screen.getByRole('textbox', { name: /Namespace/ }), 'default');

    await user.click(screen.getByRole('button', { name: /Create/ }));

    expect(onSubmit).toHaveBeenCalledWith({
      owner: 'testuser',
      repo: 'my-repo',
      branch: 'main',
      name: 'my-func',
      runtime: 'node',
      registry: 'image-registry.openshift-image-registry.svc:5000/default',
      namespace: 'default',
      plainEnvVars: [],
      secretEnvVars: [],
      configMapEnvVars: [],
    });
  });

  it('renders the Environment Variables section with empty row after expansion', async () => {
    const user = userEvent.setup();
    const { container } = renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    expect(screen.getByText('Environment Variables')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Add environment variable/ }));

    expect(screen.getAllByRole('button', { name: /Add key\/value/ })[0]).toBeInTheDocument();
    expect(container.querySelector('#env-name-0')).toBeInTheDocument();
    expect(container.querySelector('#env-value-0')).toBeInTheDocument();
  });

  it('renders Secrets and ConfigMaps groups', async () => {
    const user = userEvent.setup();
    renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    await user.click(screen.getByRole('button', { name: /Add environment variable/ }));

    expect(screen.getByText('Secrets')).toBeInTheDocument();
    expect(screen.getByText('ConfigMaps')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Add key\/value/ }).length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it('enables Create button when all required fields and valid env vars are filled', async () => {
    const user = userEvent.setup();

    const { container } = renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    await user.type(screen.getByRole('textbox', { name: /Repository/ }), 'my-repo');
    await user.type(screen.getByRole('textbox', { name: /Branch/ }), 'main');
    await user.type(screen.getByRole('textbox', { name: /^Name$/ }), 'my-func');
    await user.type(screen.getByRole('textbox', { name: /Namespace/ }), 'default');

    await user.click(screen.getByRole('button', { name: /Add environment variable/ }));
    await user.click(screen.getAllByRole('button', { name: /Add key\/value/ })[0]);

    const envName0 = container.querySelector('#env-name-0');
    const envValue0 = container.querySelector('#env-value-0');
    const envName1 = container.querySelector('#env-name-1');
    const envValue1 = container.querySelector('#env-value-1');

    if (!envName0 || !envValue0 || !envName1 || !envValue1) {
      throw new Error('Env var inputs not found');
    }

    await user.type(envName0, 'MY_VAR');
    await user.type(envValue0, 'my-value');
    await user.type(envName1, 'OTHER_VAR');
    await user.type(envValue1, 'other-value');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Create/ })).not.toBeDisabled();
    });
  });

  it('disables Create button when env var has empty name', async () => {
    const user = userEvent.setup();

    const { container } = renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    await user.type(screen.getByRole('textbox', { name: /Repository/ }), 'my-repo');
    await user.type(screen.getByRole('textbox', { name: /Branch/ }), 'main');
    await user.type(screen.getByRole('textbox', { name: /^Name$/ }), 'my-func');
    await user.type(screen.getByRole('textbox', { name: /Namespace/ }), 'default');

    await user.click(screen.getByRole('button', { name: /Add environment variable/ }));
    await user.click(screen.getAllByRole('button', { name: /Add key\/value/ })[0]);

    const envValueInput = container.querySelector('#env-value-0');
    if (!envValueInput) throw new Error('Env value input not found');

    await user.type(envValueInput, 'my-value');

    expect(screen.getByRole('button', { name: /Create/ })).toBeDisabled();
  });

  it('removes the last env var row when Remove is clicked', async () => {
    const user = userEvent.setup();

    const { container } = renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    await user.click(screen.getByRole('button', { name: /Add environment variable/ }));
    await user.click(screen.getAllByRole('button', { name: /Add key\/value/ })[0]);

    const envNameInputs = container.querySelectorAll('[id^="env-name-"]');
    expect(envNameInputs).toHaveLength(2);

    const removeButtons = screen.getAllByRole('button', { name: /^Remove$/ });
    await user.click(removeButtons[0]);

    const remaining = container.querySelectorAll('[id^="env-name-"]');
    expect(remaining).toHaveLength(1);
  });

  it('shows duplicate name error for repeated env var names', async () => {
    const user = userEvent.setup();

    const { container } = renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    await user.click(screen.getByRole('button', { name: /Add environment variable/ }));
    await user.click(screen.getAllByRole('button', { name: /Add key\/value/ })[0]);

    const envName0 = container.querySelector('#env-name-0');
    const envName1 = container.querySelector('#env-name-1');
    if (!envName0 || !envName1) throw new Error('Env name inputs not found');

    await user.type(envName0, 'SAME');
    await user.type(envName1, 'SAME');

    expect(screen.getAllByText('Duplicate name')).toHaveLength(2);
  });

  it('renders Secret resource and key dropdowns in the secrets group', async () => {
    const user = userEvent.setup();
    const { container } = renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    await user.click(screen.getByRole('button', { name: /Add environment variable/ }));

    expect(container.querySelector('#secret-name-0')).toBeInTheDocument();
    expect(container.querySelector('#secret-resource-0')).toBeInTheDocument();
    expect(container.querySelector('#secret-key-0')).toBeInTheDocument();
  });

  it('renders ConfigMap resource and key dropdowns in the configmaps group', async () => {
    const user = userEvent.setup();
    const { container } = renderWithContext(
      <CreateFunctionForm onSubmit={onSubmit} onCancel={onCancel} isSubmitting={false} />,
    );

    await user.click(screen.getByRole('button', { name: /Add environment variable/ }));

    expect(container.querySelector('#configmap-name-0')).toBeInTheDocument();
    expect(container.querySelector('#configmap-resource-0')).toBeInTheDocument();
    expect(container.querySelector('#configmap-key-0')).toBeInTheDocument();
  });
});
