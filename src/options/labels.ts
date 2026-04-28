/**
 * Label/folder management for the options page.
 * Handles adding/removing label inputs, IMAP folder loading, and bulk import.
 */

declare const browser: any;

interface Folder {
  type: string;
  name: string;
  subFolders?: Folder[];
}

interface Account {
  folders: Folder[];
}

// ── Label Inputs ──────────────────────────────────────────────────

export function addLabelInput(
  value: string,
  labelsContainer: HTMLElement,
  onUpdateSaveState: () => void
): void {
  const labelItem = document.createElement('div');
  labelItem.className = 'label-item';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'label-input';
  input.placeholder = 'Enter category/folder name';
  input.value = value;
  input.addEventListener('input', onUpdateSaveState);

  const removeButton = document.createElement('button');
  removeButton.className = 'remove-label';
  removeButton.textContent = '×';
  removeButton.addEventListener('click', () => {
    labelItem.remove();
    onUpdateSaveState();

    const remainingLabels = labelsContainer.querySelectorAll('.label-input');
    if (remainingLabels.length === 0) {
      labelsContainer.innerHTML =
        '<div class="instruction-message">No folders/labels configured. Click "Load Folders from Mail Account" above or add custom labels below.</div>';
    }
  });

  labelItem.appendChild(input);
  labelItem.appendChild(removeButton);
  labelsContainer.appendChild(labelItem);
}

// ── IMAP Folder Loading ──────────────────────────────────────────

async function getAllFolders(account: Account): Promise<string[]> {
  const folders: string[] = [];

  async function processFolder(folder: Folder): Promise<void> {
    if (
      folder.type !== 'inbox' &&
      folder.type !== 'trash' &&
      folder.type !== 'sent' &&
      folder.type !== 'drafts' &&
      folder.type !== 'junk' &&
      folder.type !== 'templates' &&
      folder.type !== 'outbox' &&
      folder.type !== 'archives'
    ) {
      folders.push(folder.name);
    }

    if (folder.subFolders) {
      for (const subFolder of folder.subFolders) {
        await processFolder(subFolder);
      }
    }
  }

  for (const folder of account.folders) {
    await processFolder(folder);
  }

  return folders;
}

export async function loadFoldersFromImap(
  folderLoadingIndicator: HTMLElement,
  folderSelection: HTMLElement,
  foldersPreview: HTMLElement,
  folderCount: HTMLElement,
  showMessageFn: (msg: string, success?: boolean) => void
): Promise<string[]> {
  folderLoadingIndicator.style.display = 'block';
  folderSelection.style.display = 'none';

  try {
    const accounts: Account[] = await browser.accounts.list();
    const allFolders: string[] = [];

    for (const account of accounts) {
      const folderList = await getAllFolders(account);
      allFolders.push(...folderList);
    }

    const loadedFolders = [
      ...new Set(
        allFolders
          .filter(
            (f) =>
              ![
                'Inbox', 'Trash', 'Drafts', 'Sent', 'Spam', 'Junk',
                'Templates', 'Outbox', 'Archives',
              ].includes(f)
          )
          .map((f) => f.replace(/^INBOX\./i, '').trim())
      ),
    ].sort();

    if (loadedFolders.length === 0) {
      showMessageFn(
        'No folders found. You can create custom folders instead.',
        false
      );
      folderLoadingIndicator.style.display = 'none';
      return [];
    }

    folderCount.textContent = String(loadedFolders.length);
    foldersPreview.innerHTML =
      loadedFolders
        .slice(0, 10)
        .map((f) => `<div class="folder-preview-item">${f}</div>`)
        .join('') +
      (loadedFolders.length > 10
        ? `<div class="folder-preview-item">...and ${loadedFolders.length - 10} more</div>`
        : '');

    folderSelection.style.display = 'block';
    return loadedFolders;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    showMessageFn(`Error loading folders: ${msg}`, false);
    console.error('Error loading folders:', error);
    return [];
  } finally {
    folderLoadingIndicator.style.display = 'none';
  }
}

// ── Bulk Import ───────────────────────────────────────────────────

export function importLabelsFromBulk(
  bulkText: string,
  labelsContainer: HTMLElement,
  onUpdateSaveState: () => void,
  showMessageFn: (msg: string, success?: boolean) => void
): void {
  const labels = bulkText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');

  if (labels.length === 0) {
    showMessageFn(
      'Please add at least one folder/label before importing. Enter labels one per line.',
      false
    );
    return;
  }

  const existingLabels = Array.from(
    document.querySelectorAll<HTMLInputElement>('.label-input')
  )
    .map((input) => input.value.trim())
    .filter((label) => label !== '');

  if (existingLabels.length > 0) {
    if (
      !confirm(
        `This will replace your ${existingLabels.length} existing folders/labels with ${labels.length} new ones. Continue?`
      )
    ) {
      return;
    }
  }

  labelsContainer.innerHTML = '';

  labels.forEach((label) => {
    addLabelInput(label, labelsContainer, onUpdateSaveState);
  });

  onUpdateSaveState();
  showMessageFn(
    `Imported ${labels.length} categories/folders. Don't forget to save!`,
    true
  );
}
