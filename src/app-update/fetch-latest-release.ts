import { GITHUB_LATEST_RELEASE_API_URL } from './github-repo';
import { normalizeVersion } from './compare-versions';
import { Platform } from 'react-native';
import { getAppUpdateDownloadUrl } from './get-app-update-download-url';

type GitHubLatestRelease = {
  tag_name?: unknown;
  assets?: { name?: unknown; state?: unknown }[];
};

export async function fetchLatestRelease(
  platform: typeof Platform.OS = Platform.OS,
): Promise<{ latestVersion: string; downloadUrl: string } | null> {
  try {
    const response = await fetch(GITHUB_LATEST_RELEASE_API_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'weigh-way-app',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GitHubLatestRelease;
    if (typeof data.tag_name !== 'string' || data.tag_name.length === 0) {
      return null;
    }

    const assetName =
      platform === 'android' ? 'weigh-way.apk' : platform === 'ios' ? 'weigh-way.ipa' : null;
    if (
      !assetName ||
      !Array.isArray(data.assets) ||
      !data.assets.some((asset) => asset?.name === assetName && asset.state === 'uploaded')
    ) {
      return null;
    }

    const latestVersion = normalizeVersion(data.tag_name);
    const downloadUrl = getAppUpdateDownloadUrl(platform, data.tag_name);
    return latestVersion && downloadUrl ? { latestVersion, downloadUrl } : null;
  } catch {
    return null;
  }
}
