import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const fileName = () => `ironwyrm-backup-${new Date().toISOString().slice(0, 10)}.json`;

/**
 * Writes the backup to a file and opens the share sheet, so it can be saved
 * to Drive, sent to yourself or kept in Files. A file avoids Android's size
 * limit on shared text, which a long training history would exceed.
 */
export async function shareBackup(json: string): Promise<boolean> {
  const file = new File(Paths.cache, fileName());
  file.create({ overwrite: true });
  file.write(json);
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Save your Ironwyrm backup', UTI: 'public.json' });
  return true;
}

/** Lets the lifter pick a backup file. Resolves to its text, or null if they cancel. */
export async function pickBackupText(): Promise<string | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', 'application/octet-stream'] });
  if (picked.canceled) return null;
  return picked.result.text();
}
